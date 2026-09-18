import {
  CODES,
  DASH_CODE,
  DOUBLE_CODES,
  fillRandom,
  ID_LENGTH,
} from './_common';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Each ID fits neatly into seven groups of four bytes, so we can write
// four characters at a time.
const WORDS_PER_ID = ID_LENGTH >>> 2; // 7

// Each chunk becomes one string that we take individual IDs from.
// Keeping an ID may keep its whole chunk in memory, so we keep chunks small.
const CHUNK_IDS = 256;
const CHUNK_BYTES = ID_LENGTH * CHUNK_IDS; // 7168

// Fetch enough random bytes for several chunks at once to make fewer calls.
// This doesn't make the individual chunk strings any larger.
// Browsers allow up to 65,536 bytes per call, so CHUNKS must be 16 or less.
const CHUNKS = 4;

// Each ID uses 125 random bits for its 25 characters, taken from 16 bytes.
const CHUNK_RANDOM_BYTES = CHUNK_IDS * 16; // 4096
const CHUNK_RANDOM_WORDS = CHUNK_RANDOM_BYTES >>> 2; // 1024
const RANDOM_BYTES = CHUNK_RANDOM_BYTES * CHUNKS; // 16384

// The first chunk's random bytes share space with the characters we write.
// The other chunks' random bytes come after that shared space.
// The character pool comments below explain why this is safe.
const RANDOM_START = CHUNK_BYTES - CHUNK_RANDOM_BYTES; // 3072
const BUFFER_BYTES = RANDOM_START + RANDOM_BYTES; // 19456

// Put each dash in the right position for writing four bytes at a time.
const DASH_BYTE_1 = DASH_CODE << 8; // Second byte (ID positions 9 and 21).
const DASH_BYTE_3 = DASH_CODE << 24; // Fourth byte (ID position 15).

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

// ---- Character pool
// The first CHUNK_BYTES bytes hold the characters for the current chunk.
// Random bytes start at RANDOM_START, sharing some of that space for
// chunk 0. Later chunks' random bytes sit beyond the character area.
//
// We always build chunk 0 first. For each ID, we read its random bytes
// before writing its characters. Those writes never reach the random
// bytes we still need, so sharing the space is safe.
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
// A Node startup snapshot can save this module with unused IDs still
// waiting in the pool. Clear that saved state when the snapshot is restored
// so separate instances don't hand out IDs from the same saved batch.
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
// Our characters are all ASCII, so each option below gives the same text.
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
 * Returns a random ID using Crockford base32 characters in a 9-5-5-6 layout.
 *
 * All 25 characters come from the platform's secure random source;
 * only the dashes stay the same. IDs don't contain a timestamp,
 * and sorting them won't put them in creation order.
 */
function generateId(): string {
  if (poolOffset === CHUNK_BYTES) {
    refillPool();
  }
  const offset = poolOffset;
  const end = offset + ID_LENGTH;
  poolOffset = end;
  return poolStr.substring(offset, end);
}

/**
 * Builds the next chunk of IDs, including their dashes.
 * Fetches more random bytes when the current batch runs out.
 *
 * Each ID uses four random 32-bit values. Most characters are looked up
 * in pairs, with three handled individually. One of those three combines
 * leftover bits from the first three values. In total, we use 125 of the
 * 128 available bits and leave three unused.
 *
 * Here's where the characters and dashes go, four bytes at a time.
 * The c labels count characters, excluding dashes:
 *   w0: c0 c1 c2 c3      w1: c4 c5 c6 c7     w2: c8 - c9 c10
 *   w3: c11 c12 c13 -    w4: c14 c15 c16 c17 w5: c18 - c19 c20
 *   w6: c21 c22 c23 c24
 *
 * Use the shared arrays directly rather than adding local references
 * for the loop to keep track of.
 *
 * Used by: {@link generateId}
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
    id++, r += 4, w += WORDS_PER_ID
  ) {
    const r0 = randomWords[r];
    const r1 = randomWords[r + 1];
    const r2 = randomWords[r + 2];
    const r3 = randomWords[r + 3];

    poolWords[w] =
      DOUBLE_CODES[r0 & 1023] | (DOUBLE_CODES[(r0 >>> 10) & 1023] << 16);
    poolWords[w + 1] =
      DOUBLE_CODES[(r0 >>> 20) & 1023] | (DOUBLE_CODES[r1 & 1023] << 16);
    poolWords[w + 2] =
      CODES[(r3 >>> 20) & 31] |
      DASH_BYTE_1 |
      (DOUBLE_CODES[(r1 >>> 10) & 1023] << 16);
    poolWords[w + 3] =
      DOUBLE_CODES[(r1 >>> 20) & 1023] |
      (CODES[(r3 >>> 25) & 31] << 16) |
      DASH_BYTE_3;
    poolWords[w + 4] =
      DOUBLE_CODES[r2 & 1023] | (DOUBLE_CODES[(r2 >>> 10) & 1023] << 16);
    poolWords[w + 5] =
      CODES[(r0 >>> 30) | ((r1 >>> 30) << 2) | ((r2 >>> 26) & 16)] |
      DASH_BYTE_1 |
      (DOUBLE_CODES[(r2 >>> 20) & 1023] << 16);
    poolWords[w + 6] =
      DOUBLE_CODES[r3 & 1023] | (DOUBLE_CODES[(r3 >>> 10) & 1023] << 16);
  }

  nextChunk++;
  poolStr = decodePool();
  poolOffset = 0;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default generateId;
