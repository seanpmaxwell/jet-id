import {
  ALPHABET,
  CODES,
  DASH_CODE,
  DOUBLE_CODES,
  PAIRS,
} from '@src/api/_common/alphabet';
import { createPoolDecoder, onSnapshotRestore } from '@src/api/_common/pool';
import { fillBufferWithRandomBytes } from '@src/api/_common/random';
import { encodeTimestamp, TIMESTAMP_LIMIT } from '@src/api/_common/timestamp';

import {
  COUNTER_CHARS,
  COUNTER_LIMIT,
  FRACTION_STEPS,
  SEGMENT_3_LENGTH,
  SEGMENT_4_LENGTH,
  SEGMENT_5_LENGTH,
} from './_internal';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// ---- Monotonic sequence
// The split lives in _internal so the parser reads it back the same way.
// Keep it aligned with the direct character encoding below.
const COUNTER_ZERO = ALPHABET[0].repeat(COUNTER_CHARS); // counter === 0

// ---- Character pool
// Only the random tail is pooled: "-xxxxxxxx-xxxxxxxx-xxxxxxxxx".
// Each tail is already four-byte aligned, so no padding is needed.
const TAIL_LENGTH =
  1 + SEGMENT_3_LENGTH + 1 + SEGMENT_4_LENGTH + 1 + SEGMENT_5_LENGTH; // 28
const SLOT_BYTES = TAIL_LENGTH; // 28
const WORDS_PER_SLOT = SLOT_BYTES >>> 2; // 7
const CHUNK_IDS = 256;
const CHUNK_BYTES = SLOT_BYTES * CHUNK_IDS; // 7168

// Each tail uses 125 random bits from four 32-bit words.
// Three source bits are unused.
const RANDOM_WORDS_PER_SLOT = 4;
const CHUNK_RANDOM_WORDS = CHUNK_IDS * RANDOM_WORDS_PER_SLOT; // 1024
const CHUNK_RANDOM_BYTES = CHUNK_RANDOM_WORDS * 4; // 4096

// Browser getRandomValues calls cannot exceed 65,536 bytes.
// With this chunk size, CHUNKS must be 16 or less.
const CHUNKS = 4;
const RANDOM_BYTES = CHUNK_RANDOM_BYTES * CHUNKS; // 16384

// Chunk 0's random bytes overlap the output area.
// Later chunks' random bytes sit beyond that area.
const RANDOM_START = CHUNK_BYTES - CHUNK_RANDOM_BYTES; // 3072
const BUFFER_BYTES = RANDOM_START + RANDOM_BYTES; // 19456
const DASH_BYTE_1 = DASH_CODE << 8;
const DASH_BYTE_2 = DASH_CODE << 16;

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

// ---- Shared character/random pool
// Each slot expands 16 random bytes into 28 output bytes.
// Reading all four words before writing, together with the initial
// 3072-byte gap, prevents overwriting unread randomness in chunk 0.
const poolBytes = new Uint8Array(BUFFER_BYTES);
const chunkBytes = poolBytes.subarray(0, CHUNK_BYTES);
const poolWords = new Uint32Array(poolBytes.buffer, 0, CHUNK_BYTES >>> 2);
const randomBytes = poolBytes.subarray(RANDOM_START);
const randomWords = new Uint32Array(
  poolBytes.buffer,
  RANDOM_START,
  RANDOM_BYTES >>> 2,
);

let poolStr = '';
let poolOffset = CHUNK_BYTES;
let nextChunk = CHUNKS;

// ---- Monotonic state
// The last encoded time bucket and how many IDs it has issued. The encoded
// timestamp string itself is memoized inside `encodeTimestamp`.
let lastEpoch = -1;
let lastFraction = -1;
let lastCounter = 0;

// ---- Snapshot safety
onSnapshotRestore(resetGeneratorState);

// ---- Turn the pool into a string
const decodePool = createPoolDecoder(chunkBytes);

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Returns a monotonic ID in a 9-6-8-8-9 layout:
 *
 *   milliseconds-fractionAndCounter-random-random-random
 *
 * The second segment contains:
 *   - two characters of fractional-millisecond time
 *   - four characters of counter
 *
 * Fractional buckets represent approximately 0.98 microseconds, but
 * actual clock resolution depends on the runtime and privacy settings.
 * Coarsened clocks can remain in one observed bucket for much longer.
 *
 * Up to 1,048,576 IDs can be generated in one observed time bucket.
 * Exhaustion throws rather than wrapping or inventing a later timestamp.
 *
 * The final 25 characters, excluding dashes, contain 125 bits of secure
 * randomness. No characters are reserved for tags.
 *
 * Time is anchored to performance.timeOrigin; it does not follow
 * subsequent wall-clock corrections.
 *
 * Ordering is local to this module instance and does not span resets.
 */
function generateMonotonicBigId(): string {
  // Read the current global clock so tests can replace Performance
  // without reloading this module.
  const clock = globalThis.performance;
  if (!clock || typeof clock.now !== 'function') {
    throw new Error(
      'jet-id requires performance.now() and performance.timeOrigin.',
    );
  }

  const origin = clock.timeOrigin;
  const now = clock.now();

  if (!Number.isFinite(origin) || !Number.isFinite(now) || now < 0) {
    throw new RangeError(
      'Clock must provide a finite time origin and finite, nonnegative elapsed time.',
    );
  }

  // Combine integer and fractional portions separately to avoid
  // unnecessary precision loss from adding a large Unix timestamp.
  const originMs = Math.floor(origin);
  const elapsedMs = Math.floor(now);
  const fractionalMs = origin - originMs + (now - elapsedMs);
  const carry = fractionalMs >= 1 ? 1 : 0;

  let epoch = originMs + elapsedMs + carry;
  let fraction = Math.floor((fractionalMs - carry) * FRACTION_STEPS);

  // epoch is an integer by construction; only the range needs checking.
  if (epoch < 0 || epoch >= TIMESTAMP_LIMIT) {
    throw new RangeError(
      'Timestamp must be a nonnegative integer that fits in nine Crockford base32 characters.',
    );
  }

  let counter = 0;

  // Repeated or earlier readings retain the last encoded time.
  if (epoch < lastEpoch || (epoch === lastEpoch && fraction <= lastFraction)) {
    epoch = lastEpoch;
    fraction = lastFraction;
    counter = lastCounter + 1;

    if (counter >= COUNTER_LIMIT) {
      throw new RangeError(
        'Counter exhausted; the clock must advance to a later time bucket.',
      );
    }
  }

  // The range check above is the precondition `encodeTimestamp` relies on.
  const timestamp = encodeTimestamp(epoch);

  // The 10-bit fraction is one pair; the 20-bit counter is two.
  const sequence =
    PAIRS[fraction] +
    (counter === 0
      ? COUNTER_ZERO
      : PAIRS[counter >>> 10] + PAIRS[counter & 1023]);

  if (poolOffset === CHUNK_BYTES) {
    refillPool();
  }

  const offset = poolOffset;
  const id =
    timestamp +
    '-' +
    sequence +
    poolStr.substring(offset, offset + TAIL_LENGTH);

  // Commit state only after successful construction.
  poolOffset = offset + SLOT_BYTES;
  lastEpoch = epoch;
  lastFraction = fraction;
  lastCounter = counter;

  return id;
}

/**
 * Builds the next chunk of random tails.
 *
 * Each tail uses 125 of the 128 available random bits.
 * Eleven character pairs supply 22 characters; three single-character
 * lookups supply the remaining three.
 *
 * One single-character lookup combines unused high bits from the
 * first three random words.
 *
 * Output layout:
 *   w0: -   c0  c1  c2
 *   w1: c3  c4  c5  c6
 *   w2: c7  -   c8  c9
 *   w3: c10 c11 c12 c13
 *   w4: c14 c15 -   c16
 *   w5: c17 c18 c19 c20
 *   w6: c21 c22 c23 c24
 *
 * @private
 */
function refillPool(): void {
  if (nextChunk === CHUNKS) {
    fillBufferWithRandomBytes(randomBytes);
    nextChunk = 0;
  }

  for (
    let id = 0, r = nextChunk * CHUNK_RANDOM_WORDS, w = 0;
    id < CHUNK_IDS;
    id++, r += RANDOM_WORDS_PER_SLOT, w += WORDS_PER_SLOT
  ) {
    // Read all four words before writing into the overlapping buffer.
    const r0 = randomWords[r];
    const r1 = randomWords[r + 1];
    const r2 = randomWords[r + 2];
    const r3 = randomWords[r + 3];

    poolWords[w] =
      DASH_CODE |
      (DOUBLE_CODES[r0 & 1023] << 8) |
      (CODES[(r3 >>> 20) & 31] << 24);

    poolWords[w + 1] =
      DOUBLE_CODES[(r0 >>> 10) & 1023] |
      (DOUBLE_CODES[(r0 >>> 20) & 1023] << 16);

    poolWords[w + 2] =
      CODES[(r0 >>> 30) | ((r1 >>> 30) << 2) | ((r2 >>> 26) & 16)] |
      DASH_BYTE_1 |
      (DOUBLE_CODES[r1 & 1023] << 16);

    poolWords[w + 3] =
      DOUBLE_CODES[(r1 >>> 10) & 1023] |
      (DOUBLE_CODES[(r1 >>> 20) & 1023] << 16);

    poolWords[w + 4] =
      DOUBLE_CODES[r2 & 1023] | DASH_BYTE_2 | (CODES[(r3 >>> 25) & 31] << 24);

    poolWords[w + 5] =
      DOUBLE_CODES[(r2 >>> 10) & 1023] |
      (DOUBLE_CODES[(r2 >>> 20) & 1023] << 16);

    poolWords[w + 6] =
      DOUBLE_CODES[r3 & 1023] | (DOUBLE_CODES[(r3 >>> 10) & 1023] << 16);
  }

  nextChunk++;
  poolStr = decodePool();
  poolOffset = 0;
}

/**
 * Discards buffered IDs and resets monotonic state.
 *
 * Used for Node startup snapshot restoration and between unit tests.
 * The next generation fetches fresh randomness and reads the current
 * global Performance clock.
 *
 * This deliberately ends the previous monotonic sequence.
 * Do not call it between normal ID generations.
 *
 * Keep this export internal by not re-exporting it from src/index.ts.
 */
export function resetGeneratorState(): void {
  poolStr = '';
  poolOffset = CHUNK_BYTES;
  nextChunk = CHUNKS;

  lastEpoch = -1;
  lastFraction = -1;
  lastCounter = 0;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default generateMonotonicBigId;
