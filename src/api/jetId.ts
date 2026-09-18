// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DASH_CODE = 45; // '-'

const SEGMENT_1_LENGTH = 6;
const SEGMENT_2_LENGTH = 6;
const SEGMENT_3_LENGTH = 7;
const SEGMENT_4_LENGTH = 6;

const DASH_1_INDEX = SEGMENT_1_LENGTH; // 6
const DASH_2_INDEX = DASH_1_INDEX + 1 + SEGMENT_2_LENGTH; // 13
const DASH_3_INDEX = DASH_2_INDEX + 1 + SEGMENT_3_LENGTH; // 21
const ID_LENGTH = DASH_3_INDEX + 1 + SEGMENT_4_LENGTH; // 28

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
const DASH_BYTE_1 = DASH_CODE << 8; // Second byte (ID positions 13 and 21).
const DASH_BYTE_2 = DASH_CODE << 16; // Third byte (ID position 6).

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

// ---- Platform check
// We write characters four bytes at a time and rely on little-endian byte
// order. Stop at startup if the platform uses a different order, rather
// than silently produce broken IDs.
if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {
  throw new Error('jet-id requires a little-endian platform.');
}

// ---- Random source
// Use Node's randomFillSync when available to skip some extra checks.
// Looking it up this way avoids asking bundlers to include 'node:crypto'
// or a replacement for it. Everywhere else, use Web Crypto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeCrypto = (globalThis as any).process?.getBuiltinModule?.(
  'node:crypto',
);
const fillRandom: (buffer: Uint8Array) => unknown =
  typeof nodeCrypto?.randomFillSync === 'function'
    ? nodeCrypto.randomFillSync
    : globalThis.crypto.getRandomValues.bind(globalThis.crypto);

// ---- Character lookup tables
// Precompute character pairs so we can look up two characters at once.
// Each pair uses ten random bits, with the first character in the low byte.
const DOUBLE_CODES = new Uint16Array(1024);
for (let i = 0; i < DOUBLE_CODES.length; i++) {
  DOUBLE_CODES[i] =
    ALPHABET.charCodeAt(i >>> 5) | (ALPHABET.charCodeAt(i & 31) << 8);
}

// The three characters that don't fit into pairs get their own lookup.
// Each one uses five random bits.
const CODES = new Uint8Array(32);
for (let i = 0; i < 32; i++) {
  CODES[i] = ALPHABET.charCodeAt(i);
}

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
 * Returns a random ID using Crockford base32 characters in a 6-6-7-6 layout.
 *
 * All 25 characters come from the platform's secure random source;
 * only the dashes stay the same. IDs don't contain a timestamp,
 * and sorting them won't put them in creation order.
 */
function jetId(): string {
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
 *   w0: c0 c1 c2 c3      w1: c4 c5 -  c6      w2: c7 c8 c9 c10
 *   w3: c11 - c12 c13    w4: c14 c15 c16 c17  w5: c18 - c19 c20
 *   w6: c21 c22 c23 c24
 *
 * Use the shared arrays directly rather than adding local references
 * for the loop to keep track of.
 *
 * Used by: {@link jetId}
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
      DOUBLE_CODES[(r0 >>> 20) & 1023] |
      DASH_BYTE_2 |
      (CODES[(r3 >>> 20) & 31] << 24);
    poolWords[w + 2] =
      DOUBLE_CODES[r1 & 1023] | (DOUBLE_CODES[(r1 >>> 10) & 1023] << 16);
    poolWords[w + 3] =
      CODES[(r3 >>> 25) & 31] |
      DASH_BYTE_1 |
      (DOUBLE_CODES[(r1 >>> 20) & 1023] << 16);
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
//                                   TEST                                    //
// ========================================================================= //

// ---- Allowed characters
// Mark alphabet characters as 1 and the dash as 2.
// Accept both uppercase and lowercase letters.
// Anything left at 0 isn't allowed.
const CHAR_CLASS = new Uint8Array(128);
for (let i = 0; i < 32; i++) {
  const code = ALPHABET.charCodeAt(i);
  CHAR_CLASS[code] = 1;
  if (code >= 65) {
    CHAR_CLASS[code | 32] = 1; // Allow the lowercase version too.
  }
}
CHAR_CLASS[DASH_CODE] = 2;

// ---- Expected layout
// Every position needs an alphabet character, except the three dash spots.
const LAYOUT = new Uint8Array(ID_LENGTH).fill(1);
LAYOUT[DASH_1_INDEX] = 2;
LAYOUT[DASH_2_INDEX] = 2;
LAYOUT[DASH_3_INDEX] = 2;

/**
 * Checks whether a value matches the jet-id format.
 * Accepts both uppercase and lowercase letters.
 */
jetId.test = function (value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== ID_LENGTH) {
    return false;
  }
  for (let i = 0; i < ID_LENGTH; i++) {
    const c = value.charCodeAt(i);
    if (c > 127 || CHAR_CLASS[c] !== LAYOUT[i]) {
      return false;
    }
  }
  return true;
};

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetId;
