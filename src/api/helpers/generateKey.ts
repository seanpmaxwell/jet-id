import { DOUBLE_CODES } from '../_common/alphabet';
import { createPoolDecoder, onSnapshotRestore } from '../_common/pool';
import { fillBufferWithRandomBytes } from '../_common/random';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const ID_LENGTH = 52;

// Write four characters at a time.
const WORDS_PER_ID = ID_LENGTH >>> 2; // 13

// Keep chunks small to limit memory retained by individual key strings.
const CHUNK_IDS = 256;
const CHUNK_BYTES = ID_LENGTH * CHUNK_IDS; // 13312

// Each key uses 260 random bits for its 52 characters.
// Read nine 32-bit words (288 bits), leaving 28 bits unused.
const RANDOM_WORDS_PER_ID = 9;
const CHUNK_RANDOM_WORDS = CHUNK_IDS * RANDOM_WORDS_PER_ID; // 2304
const CHUNK_RANDOM_BYTES = CHUNK_RANDOM_WORDS * 4; // 9216

// Browsers allow up to 65,536 random bytes per call.
// With this chunk size, CHUNKS must be 7 or less.
const CHUNKS = 4;
const RANDOM_BYTES = CHUNK_RANDOM_BYTES * CHUNKS; // 36864

// The first chunk's random bytes share space with its output characters.
const RANDOM_START = CHUNK_BYTES - CHUNK_RANDOM_BYTES; // 4096
const BUFFER_BYTES = RANDOM_START + RANDOM_BYTES; // 40960

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

// ---- Character Pool
// The first CHUNK_BYTES bytes hold the current chunk's characters.
// Chunk 0's random bytes overlap that character area. Later chunks'
// random bytes sit beyond it.
//
// Read all nine random words for a key before writing its characters.
// Each key expands 36 random bytes into 52 character bytes. The initial
// 4096-byte gap prevents writes from reaching unread random bytes.
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

// ---- Snapshot safety
// Discard saved pool state when a Node startup snapshot is restored,
// preventing separate instances from returning the same saved keys.
// Dropping poolStr also lets the saved chunk string be collected.
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
 * Returns a random 52-character key using Crockford base32 characters.
 *
 * All 52 characters come from the platform's secure random source. Keys
 * contain no separators and no timestamp, and they are not jet-ids: at 52
 * characters they fail `jetid.test` and `jetid.mono.test` alike.
 */
function generateKey(): string {
  if (poolOffset === CHUNK_BYTES) {
    refillPool();
  }
  const offset = poolOffset;
  const end = offset + ID_LENGTH;
  poolOffset = end;
  return poolStr.substring(offset, end);
}

/**
 * Builds the next chunk of 52-character keys.
 * Fetches more random bytes when the current batch runs out.
 *
 * The first eight random words each supply three character pairs.
 * The ninth supplies two more pairs, giving 52 characters total.
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
    // Read every random word before writing into the overlapping buffer.
    const r0 = randomWords[r];
    const r1 = randomWords[r + 1];
    const r2 = randomWords[r + 2];
    const r3 = randomWords[r + 3];
    const r4 = randomWords[r + 4];
    const r5 = randomWords[r + 5];
    const r6 = randomWords[r + 6];
    const r7 = randomWords[r + 7];
    const r8 = randomWords[r + 8];

    poolWords[w] =
      DOUBLE_CODES[r0 & 1023] | (DOUBLE_CODES[(r0 >>> 10) & 1023] << 16);

    poolWords[w + 1] =
      DOUBLE_CODES[(r0 >>> 20) & 1023] | (DOUBLE_CODES[r1 & 1023] << 16);

    poolWords[w + 2] =
      DOUBLE_CODES[(r1 >>> 10) & 1023] |
      (DOUBLE_CODES[(r1 >>> 20) & 1023] << 16);

    poolWords[w + 3] =
      DOUBLE_CODES[r2 & 1023] | (DOUBLE_CODES[(r2 >>> 10) & 1023] << 16);

    poolWords[w + 4] =
      DOUBLE_CODES[(r2 >>> 20) & 1023] | (DOUBLE_CODES[r3 & 1023] << 16);

    poolWords[w + 5] =
      DOUBLE_CODES[(r3 >>> 10) & 1023] |
      (DOUBLE_CODES[(r3 >>> 20) & 1023] << 16);

    poolWords[w + 6] =
      DOUBLE_CODES[r4 & 1023] | (DOUBLE_CODES[(r4 >>> 10) & 1023] << 16);

    poolWords[w + 7] =
      DOUBLE_CODES[(r4 >>> 20) & 1023] | (DOUBLE_CODES[r5 & 1023] << 16);

    poolWords[w + 8] =
      DOUBLE_CODES[(r5 >>> 10) & 1023] |
      (DOUBLE_CODES[(r5 >>> 20) & 1023] << 16);

    poolWords[w + 9] =
      DOUBLE_CODES[r6 & 1023] | (DOUBLE_CODES[(r6 >>> 10) & 1023] << 16);

    poolWords[w + 10] =
      DOUBLE_CODES[(r6 >>> 20) & 1023] | (DOUBLE_CODES[r7 & 1023] << 16);

    poolWords[w + 11] =
      DOUBLE_CODES[(r7 >>> 10) & 1023] |
      (DOUBLE_CODES[(r7 >>> 20) & 1023] << 16);

    poolWords[w + 12] =
      DOUBLE_CODES[r8 & 1023] | (DOUBLE_CODES[(r8 >>> 10) & 1023] << 16);
  }

  nextChunk++;
  poolStr = decodePool();
  poolOffset = 0;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default generateKey;
