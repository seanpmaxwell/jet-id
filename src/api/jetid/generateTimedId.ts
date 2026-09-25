import { CODES, DASH_CODE, DOUBLE_CODES } from '../_common/alphabet';
import { createPoolDecoder, onSnapshotRestore } from '../_common/pool';
import { fillBufferWithRandomBytes } from '../_common/random';
import { encodeTimestamp, TIMESTAMP_LIMIT } from '../_common/timestamp';

import { ID_LENGTH, SEGMENT_1_LENGTH } from './_internal';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// ---- Character pool
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
const RANDOM_WORDS_PER_ID = 3;
const CHUNK_RANDOM_BYTES = CHUNK_IDS * RANDOM_WORDS_PER_ID * 4; // 3072
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
// words before writing its five output words. Suffix i writes words
// 5i..5i+4 and suffix i+1 reads from word 512+3(i+1); since
// 5i+4 < 515+3i for all i < 255, and suffix 255 reads its own words
// before writing, no unread randomness is ever overwritten. Re-check this
// inequality if CHUNK_IDS, SLOT_BYTES, or RANDOM_START change.
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
// Dropping poolStr also lets the saved chunk string be collected.
// This does nothing outside Node.
onSnapshotRestore(() => {
  poolStr = '';
  poolOffset = CHUNK_BYTES;
  nextChunk = CHUNKS;
});

// ---- Turn the pool into a string
const decodePool = createPoolDecoder(chunkBytes);

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
  if (!Number.isSafeInteger(epoch) || epoch < 0 || epoch >= TIMESTAMP_LIMIT) {
    throw new RangeError(
      'Timestamp must be a nonnegative integer that fits in nine Crockford base32 characters.',
    );
  }

  // The range check above is the precondition `encodeTimestamp` relies on.
  const timestamp = encodeTimestamp(epoch);

  if (poolOffset === CHUNK_BYTES) {
    refillPool();
  }

  const offset = poolOffset;
  poolOffset = offset + SLOT_BYTES;
  return timestamp + poolStr.substring(offset, offset + SUFFIX_LENGTH);
}

/**
 * Builds the next chunk of random suffixes, including their dashes.
 * Fetches more random bytes when the current batch runs out.
 *
 * Each suffix uses three random 32-bit words. The first two supply
 * 30 bits each, and the third supplies 20 bits, for 80 random bits total.
 * The remaining 16 source bits are unused (r0 and r1 bits 30-31,
 * r2 bits 20-31).
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
    fillBufferWithRandomBytes(randomBytes);
    nextChunk = 0;
  }

  for (
    let id = 0, r = nextChunk * CHUNK_RANDOM_WORDS, w = 0;
    id < CHUNK_IDS;
    id++, r += RANDOM_WORDS_PER_ID, w += WORDS_PER_ID
  ) {
    // Read all three words before writing into the overlapping buffer.
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
