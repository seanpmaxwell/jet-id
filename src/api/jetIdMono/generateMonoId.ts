import { ALPHABET, CODES, DASH_CODE, DOUBLE_CODES, PAIRS } from '@Alphabet';

import { TIMESTAMP_LIMIT } from '@cmn/constants/segments';
import createPool from '@cmn/utils/createPool';
import encodeTimestamp from '@cmn/utils/encodeTimestamp';
import generateSegments from '@cmn/utils/generateSegments';
import onSnapshotRestore from '@cmn/utils/onSnapshotRestore';
import resolveEntropy from '@cmn/utils/resolveEntropy';

import {
  COUNTER_CHARS,
  COUNTER_LIMIT,
  FRACTION_STEPS,
} from './_internal/constants';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// --- Monotonic sequence ---
// The fraction/counter split lives in _internal. Keep it aligned with the
// direct character encoding below.
const COUNTER_ZERO = ALPHABET[0].repeat(COUNTER_CHARS); // counter === 0

// --- Character pool ---
// Only the random tail is pooled: "-xxxxx-xxxxx" (50 random bits).
// Each tail is four-byte aligned; no padding is needed.
const TAIL_LENGTH = 12;
const WORDS_PER_SLOT = TAIL_LENGTH >>> 2; // 3

// Two random words supply 30 + 20 bits; the remaining 14 bits are unused.
const RANDOM_WORDS_PER_SLOT = 2;
const DASH_BYTE_2 = DASH_CODE << 16;

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

const {
  next: nextTail,
  reset: resetPool,
  out,
  random,
} = createPool(TAIL_LENGTH, TAIL_LENGTH, RANDOM_WORDS_PER_SLOT, writeChunk);

// --- Monotonic state ---
// The last encoded time bucket and how many IDs it has issued. The encoded
// timestamp string itself is memoized inside `encodeTimestamp`.
let lastEpoch = -1;
let lastFraction = -1;
let lastCounter = 0;

// --- Snapshot safety ---
onSnapshotRestore(resetGeneratorState);

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Returns a monotonic ID in a 9-6-5-5 layout:
 *
 *   milliseconds-sequence-random-random
 *
 * The second segment, the sequence, contains:
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
 * The final 10 characters by default, excluding dashes, contain 50 bits of secure
 * randomness. Pass entropy (80–1024) to select the shortest layout meeting
 * that minimum, with at least one trailing segment of 5–10 characters.
 *
 * Time is anchored to performance.timeOrigin; it does not follow
 * subsequent wall-clock corrections.
 *
 * Ordering is local to this module instance and does not span resets.
 */
function generateMonoId(entropy?: number): string {
  const layout = entropy === undefined ? undefined : resolveEntropy(entropy, 0);
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

  const tail = layout ? generateSegments(layout, 2) : nextTail();
  const id = timestamp + '-' + sequence + tail;

  // Commit state only after successful construction.
  lastEpoch = epoch;
  lastFraction = fraction;
  lastCounter = counter;

  return id;
}

/**
 * Builds one chunk of random tails.
 *
 * Each tail uses 50 of 64 available random bits (r0 bits 0-29 and
 * r1 bits 0-19). Pairs and single characters use disjoint source bits.
 *
 * Output layout:
 *   w0: -  c0 c1 c2
 *   w1: c3 c4 -  c5
 *   w2: c6 c7 c8 c9
 *
 * Used by: {@link createPool}
 *
 * @private
 */
function writeChunk(r: number): void {
  for (
    let w = 0;
    w < out.length;
    w += WORDS_PER_SLOT, r += RANDOM_WORDS_PER_SLOT
  ) {
    // Read both words before writing into the overlapping buffer.
    const r0 = random[r];
    const r1 = random[r + 1];

    out[w] =
      DASH_CODE |
      (DOUBLE_CODES[r0 & 1023] << 8) |
      (CODES[(r0 >>> 10) & 31] << 24);
    out[w + 1] =
      DOUBLE_CODES[(r0 >>> 15) & 1023] |
      DASH_BYTE_2 |
      (CODES[(r0 >>> 25) & 31] << 24);
    out[w + 2] =
      DOUBLE_CODES[r1 & 1023] | (DOUBLE_CODES[(r1 >>> 10) & 1023] << 16);
  }
}

/**
 * Discards buffered IDs and resets monotonic state.
 *
 * Used for Node startup snapshot restoration and between unit tests.
 * The next generation fetches fresh randomness and reads the current
 * global Performance clock.
 *
 * This deliberately ends the previous monotonic run of IDs.
 * Do not call it between normal ID generations.
 *
 * Keep this export internal by not re-exporting it from src/index.ts.
 */
export function resetGeneratorState(): void {
  resetPool();

  lastEpoch = -1;
  lastFraction = -1;
  lastCounter = 0;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default generateMonoId;
