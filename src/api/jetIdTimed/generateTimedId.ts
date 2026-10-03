import { CODES, DASH_CODE, DOUBLE_CODES } from '@Alphabet';

import {
  ID_LENGTH,
  SEGMENT_1_LENGTH,
  TIMESTAMP_LIMIT,
} from '@cmn/constants/segments';
import createPool from '@cmn/utils/createPool';
import encodeTimestamp from '@cmn/utils/encodeTimestamp';
import generateSegments from '@cmn/utils/generateSegments';
import resolveEntropy from '@cmn/utils/resolveEntropy';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// --- Character pool ---
// Only the suffix is pooled: "-xxxxxx-xxxxx-xxxxx".
// Add one internal padding byte so each slot can be written four bytes
// at a time. That padding byte is never included in a returned ID.
const SUFFIX_LENGTH = ID_LENGTH - SEGMENT_1_LENGTH; // 19
const SLOT_BYTES = (SUFFIX_LENGTH + 3) & ~3; // 20
const WORDS_PER_ID = SLOT_BYTES >>> 2; // 5

// Each suffix uses 80 random bits for its 16 characters.
// Read three aligned 32-bit words per suffix and leave 16 bits unused.
const RANDOM_WORDS_PER_ID = 3;

// The middle suffix dash occupies the fourth byte of its output word.
// The first dash is byte zero; the final dash is byte one of its word.
const DASH_BYTE_3 = DASH_CODE << 24;
const DASH_BYTE_1 = DASH_CODE << 8;

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

export interface TimedIdOptions {
  epoch?: number;
  entropy?: number;
}

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

const {
  next: nextSuffix,
  out,
  random,
} = createPool(SLOT_BYTES, SUFFIX_LENGTH, RANDOM_WORDS_PER_ID, writeChunk);

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Returns a timestamped ID using Crockford base32 in a 9-6-5-5 layout.
 *
 * The first nine characters encode options.epoch, defaulting to Date.now():
 * milliseconds since the Unix epoch, most-significant digit first and
 * zero-padded to nine digits.
 *
 * By default the remaining 16 characters contain 80 random bits. The entropy
 * option selects the shortest layout meeting 80–1024 random bits,
 * subject to the fixed prefix and at least one trailing 5–10 character segment.
 *
 * IDs sort lexicographically by their encoded timestamps. Ordering within
 * the same millisecond is random, and the system clock can move backward,
 * so IDs are not guaranteed to increase monotonically.
 */
function generateTimedId(options?: TimedIdOptions): string {
  // Validate `options` parameter
  if (
    options !== undefined &&
    (options === null || typeof options !== 'object' || Array.isArray(options))
  ) {
    throw new TypeError('Timed ID options must be an object.');
  }
  let epoch = options?.epoch;
  if (epoch === undefined) epoch = Date.now();
  const entropy = options?.entropy;

  // Validate `epoch range`
  if (!Number.isSafeInteger(epoch) || epoch < 0 || epoch >= TIMESTAMP_LIMIT) {
    throw new RangeError(
      'Timestamp must be a nonnegative integer that fits in nine Crockford base32 characters.',
    );
  }

  // The range check above is the precondition `encodeTimestamp` relies on.
  const timestamp = encodeTimestamp(epoch);

  if (entropy !== undefined) {
    const layout = resolveEntropy(entropy, 6);
    return timestamp + generateSegments(layout, 1);
  }

  return timestamp + nextSuffix();
}

/**
 * Builds one chunk of random suffixes, including their dashes.
 *
 * Each suffix uses three random 32-bit words. The first two supply
 * 30 bits each, and the third supplies 20 bits, for 80 random bits total.
 * The remaining 16 source bits are unused (r0 and r1 bits 30-31,
 * r2 bits 20-31).
 *
 * Here's where the characters, dashes, and padding go.
 * The c labels count the 16 random characters, excluding dashes:
 *   w0: -   c0  c1  c2
 *   w1: c3  c4  c5  -
 *   w2: c6  c7  c8  c9
 *   w3: c10 -   c11 c12
 *   w4: c13 c14 c15 pad
 *
 * The final padding byte is zero and is never returned.
 *
 * Used by: {@link createPool}
 *
 * @private
 */
function writeChunk(r: number): void {
  for (let w = 0; w < out.length; w += WORDS_PER_ID, r += RANDOM_WORDS_PER_ID) {
    // Read all three words before writing into the overlapping buffer.
    const r0 = random[r];
    const r1 = random[r + 1];
    const r2 = random[r + 2];

    out[w] =
      DASH_CODE | (DOUBLE_CODES[r0 & 1023] << 8) | (CODES[r2 & 31] << 24);

    out[w + 1] =
      DOUBLE_CODES[(r0 >>> 10) & 1023] |
      (CODES[(r2 >>> 5) & 31] << 16) |
      DASH_BYTE_3;

    out[w + 2] =
      DOUBLE_CODES[(r0 >>> 20) & 1023] | (DOUBLE_CODES[r1 & 1023] << 16);

    out[w + 3] =
      CODES[(r1 >>> 15) & 31] |
      DASH_BYTE_1 |
      (CODES[(r1 >>> 10) & 31] << 16) |
      (CODES[(r2 >>> 10) & 31] << 24);

    out[w + 4] =
      DOUBLE_CODES[(r1 >>> 20) & 1023] | (CODES[(r2 >>> 15) & 31] << 16);
  }
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default generateTimedId;
