import {
  ALPHABET,
  CODES,
  DASH_CODE,
  DOUBLE_CODES,
  fillRandom,
  ID_LENGTH,
  SEGMENT_1_LENGTH,
} from './_common';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Nine Crockford base32 characters can represent 45 bits.
// Reject timestamps outside that range rather than silently truncate them.
const TIMESTAMP_LIMIT = 32 ** SEGMENT_1_LENGTH;

// Only the suffix is pooled: "-xxxxx-xxxxx-xxxxxx".
// Add one internal padding byte so each slot can be written four bytes
// at a time. That padding byte is never included in a returned ID.
const SUFFIX_LENGTH = ID_LENGTH - SEGMENT_1_LENGTH; // 19
const SLOT_BYTES = (SUFFIX_LENGTH + 3) & ~3; // 20
const WORDS_PER_ID = SLOT_BYTES >>> 2; // 5

// Each chunk becomes one string that we take individual suffixes from.
// Keeping an ID may keep its suffix's whole chunk in memory.
const CHUNK_IDS = 256;
const CHUNK_BYTES = SLOT_BYTES * CHUNK_IDS; // 5120

// Fetch enough random bytes for several chunks at once to make fewer calls.
// This doesn't make the individual chunk strings any larger.
// Browsers allow up to 65,536 bytes per call, so CHUNKS must be 21 or less.
const CHUNKS = 4;

// Each suffix uses 80 random bits for its 16 characters.
// Read three aligned 32-bit words per suffix and leave 16 bits unused.
const CHUNK_RANDOM_BYTES = CHUNK_IDS * 12; // 3072
const CHUNK_RANDOM_WORDS = CHUNK_RANDOM_BYTES >>> 2; // 768
const RANDOM_BYTES = CHUNK_RANDOM_BYTES * CHUNKS; // 12288

// The first chunk's random bytes share space with the characters we write.
// The other chunks' random bytes come after that shared space.
// The character pool comments below explain why this is safe.
const RANDOM_START = CHUNK_BYTES - CHUNK_RANDOM_BYTES; // 2048
const BUFFER_BYTES = RANDOM_START + RANDOM_BYTES; // 14336

// The middle suffix dash occupies the third byte of its output word.
// The other two suffix dashes occupy the first byte of their words.
const DASH_BYTE_2 = DASH_CODE << 16;

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

// ---- Character pool
// The first CHUNK_BYTES bytes hold the suffix slots for the current chunk.
// Random bytes start at RANDOM_START, sharing some of that space for
// chunk 0. Later chunks' random bytes sit beyond the character area.
//
// We always build chunk 0 first. For each suffix, we read all three random
// words before writing its five output words. After k suffixes, output
// ends at 20k and unread randomness starts at 2048 + 12k. The output
// cannot reach unread randomness while k is at most 256.
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
let poolOffset = CHUNK_BYTES; // Start empty; wait until an ID is requested.
let nextChunk = CHUNKS; // Fetch fresh random bytes on the first refill.

// ---- Snapshot safety
// A Node startup snapshot can save this module with unused suffixes still
// waiting in the pool. Clear that saved state when the snapshot is restored
// so separate instances don't hand out suffixes from the same saved batch.
// This does nothing outside Node.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const v8 = (globalThis as any).process?.getBuiltinModule?.('node:v8');
if (v8?.startupSnapshot?.isBuildingSnapshot()) {
  v8.startupSnapshot.addDeserializeCallback(() => {
    poolOffset = CHUNK_BYTES;
    nextChunk = CHUNKS;
  });
}

// ---- Turn the pool into a string
// Our characters and zero padding bytes are all ASCII, so each option
// below gives the same text. Padding is excluded when taking suffixes.
// Use Buffer's direct latin1Slice method when available, or its regular
// toString method otherwise. Without Buffer, use TextDecoder.
let decodePool: () => string;
if (typeof Buffer !== 'undefined') {
  const view = Buffer.from(poolBytes.buffer, 0, CHUNK_BYTES) as Buffer & {
    latin1Slice?: (start: number, end: number) => string;
  };
  decodePool =
    typeof view.latin1Slice === 'function'
      ? () => view.latin1Slice!(0, CHUNK_BYTES)
      : () => view.toString('latin1');
} else {
  const decoder = new TextDecoder('latin1');
  decodePool = () => decoder.decode(chunkBytes);
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Returns a timestamped ID using Crockford base32 in a 9-5-5-6 layout.
 *
 * The first nine characters encode Date.now(): milliseconds since the
 * Unix epoch, most-significant digit first and zero-padded to nine digits.
 *
 * The remaining 16 characters contain 80 bits of secure randomness.
 *
 * IDs sort lexicographically by their encoded timestamps. Ordering within
 * the same millisecond is random, and the system clock can move backward,
 * so IDs are not guaranteed to increase monotonically.
 */
function generateTimedId(epoch = Date.now()): string {
  // Validate epoch
  if (!Number.isSafeInteger(epoch) || epoch < 0 || epoch >= TIMESTAMP_LIMIT) {
    throw new RangeError(
      'Timestamp must be a nonnegative integer that fits in nine Crockford base32 characters.',
    );
  }
  // Arithmetic division preserves all timestamp bits. JavaScript's
  // bitwise shifts would truncate the timestamp to 32 bits.
  let remaining = epoch;
  let timestamp = '';
  for (let i = 0; i < SEGMENT_1_LENGTH; i++) {
    timestamp = ALPHABET[remaining % 32] + timestamp;
    remaining = Math.floor(remaining / 32);
  }
  if (poolOffset === CHUNK_BYTES) refillPool();
  const offset = poolOffset;
  poolOffset = offset + SLOT_BYTES;
  // Return
  return timestamp + poolStr.substring(offset, offset + SUFFIX_LENGTH);
}

/**
 * Builds the next chunk of random suffixes, including their dashes.
 * Fetches more random bytes when the current batch runs out.
 *
 * Each suffix uses three random 32-bit words. The first two supply
 * 30 bits each, and the third supplies 20 bits, for 80 random bits total.
 * The remaining 16 source bits are unused.
 *
 * Here's where the characters, dashes, and padding go.
 * The c labels count the 16 random characters, excluding dashes:
 *   w0: -   c0  c1  c2
 *   w1: c3  c4  -   c5
 *   w2: c6  c7  c8  c9
 *   w3: -   c10 c11 c12
 *   w4: c13 c14 c15 pad
 *
 * The final padding byte is zero and is never returned.
 *
 * Used by: {@link generateTimedId}
 *
 * @private
 */
function refillPool(): void {
  if (nextChunk === CHUNKS) {
    fillRandom(randomBytes);
    nextChunk = 0;
  }

  for (
    let id = 0, r = nextChunk * CHUNK_RANDOM_WORDS, w = 0;
    id < CHUNK_IDS;
    id++, r += 3, w += WORDS_PER_ID
  ) {
    const r0 = randomWords[r];
    const r1 = randomWords[r + 1];
    const r2 = randomWords[r + 2];

    poolWords[w] =
      DASH_CODE | (DOUBLE_CODES[r0 & 1023] << 8) | (CODES[r2 & 31] << 24);

    poolWords[w + 1] =
      DOUBLE_CODES[(r0 >>> 10) & 1023] |
      DASH_BYTE_2 |
      (CODES[(r2 >>> 5) & 31] << 24);

    poolWords[w + 2] =
      DOUBLE_CODES[(r0 >>> 20) & 1023] | (DOUBLE_CODES[r1 & 1023] << 16);

    poolWords[w + 3] =
      DASH_CODE |
      (DOUBLE_CODES[(r1 >>> 10) & 1023] << 8) |
      (CODES[(r2 >>> 10) & 31] << 24);

    poolWords[w + 4] =
      DOUBLE_CODES[(r1 >>> 20) & 1023] | (CODES[(r2 >>> 15) & 31] << 16);
  }

  nextChunk++;
  poolStr = decodePool();
  poolOffset = 0;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default generateTimedId;
