import { CODES, DASH_CODE, DOUBLE_CODES } from '@Alphabet';

import { ID_LENGTH } from '@cmn/constants/segments';
import createPool from '@cmn/utils/createPool';
import generateSegments from '@cmn/utils/generateSegments';
import resolveEntropy from '@cmn/utils/resolveEntropy';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Each ID fits neatly into seven groups of four bytes, so we can write
// four characters at a time.
const WORDS_PER_ID = ID_LENGTH >>> 2; // 7

// Each ID uses 125 random bits for its 25 characters, taken from four words.
const RANDOM_WORDS_PER_ID = 4;

// Put each dash in the right position for writing four bytes at a time.
const DASH_BYTE_1 = DASH_CODE << 8; // Second byte (ID position 9).
const DASH_BYTE_2 = DASH_CODE << 16; // Third byte (ID position 22).

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

const {
  next: nextId,
  out,
  random,
} = createPool(ID_LENGTH, ID_LENGTH, RANDOM_WORDS_PER_ID, writeChunk);

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Returns a random ID using Crockford base32 characters in a 9-6-5-5 layout.
 *
 * By default, all 25 characters come from the platform's secure random source;
 * only the dashes stay the same. IDs don't contain a timestamp,
 * and sorting them won't put them in creation order. Pass entropy (80–1024)
 * to select the shortest layout that meets that minimum, subject to the
 * fixed 9-6 prefix and at least one trailing segment of 5–10 characters.
 */
function generateId(entropy?: number): string {
  if (entropy !== undefined) {
    const layout = resolveEntropy(entropy, 15);
    return generateSegments(layout, 0);
  }
  return nextId();
}

/**
 * Builds one chunk of IDs, including their dashes.
 *
 * Each ID uses four random 32-bit values. Most characters are looked up
 * in pairs, with three handled individually. One of those three combines
 * leftover bits from the first three values. In total, we use 125 of the
 * 128 available bits and leave three unused (r2 bit 31, r3 bits 30-31).
 *
 * Here's where the characters and dashes go, four bytes at a time.
 * The c labels count characters, excluding dashes:
 *   w0: c0 c1 c2 c3      w1: c4 c5 c6 c7     w2: c8 - c9 c10
 *   w3: c11 c12 c13 c14  w4: - c15 c16 c17   w5: c18 c19 - c20
 *   w6: c21 c22 c23 c24
 *
 * Used by: {@link createPool}
 *
 * @private
 */
function writeChunk(r: number): void {
  for (let w = 0; w < out.length; w += WORDS_PER_ID, r += RANDOM_WORDS_PER_ID) {
    // Read all four words before writing into the overlapping buffer.
    const r0 = random[r];
    const r1 = random[r + 1];
    const r2 = random[r + 2];
    const r3 = random[r + 3];

    out[w] = DOUBLE_CODES[r0 & 1023] | (DOUBLE_CODES[(r0 >>> 10) & 1023] << 16);
    out[w + 1] =
      DOUBLE_CODES[(r0 >>> 20) & 1023] | (DOUBLE_CODES[r1 & 1023] << 16);
    out[w + 2] =
      CODES[(r0 >>> 30) | ((r1 >>> 30) << 2) | ((r2 >>> 26) & 16)] |
      DASH_BYTE_1 |
      (DOUBLE_CODES[(r1 >>> 10) & 1023] << 16);
    out[w + 3] =
      DOUBLE_CODES[(r1 >>> 20) & 1023] | (DOUBLE_CODES[r2 & 1023] << 16);
    out[w + 4] =
      DASH_CODE |
      (CODES[(r3 >>> 20) & 31] << 8) |
      (DOUBLE_CODES[(r2 >>> 10) & 1023] << 16);
    out[w + 5] =
      DOUBLE_CODES[(r2 >>> 20) & 1023] |
      DASH_BYTE_2 |
      (CODES[(r3 >>> 25) & 31] << 24);
    out[w + 6] =
      DOUBLE_CODES[r3 & 1023] | (DOUBLE_CODES[(r3 >>> 10) & 1023] << 16);
  }
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default generateId;
