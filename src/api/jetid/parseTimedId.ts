import { CHAR_VALUES } from '../_common/alphabet';

import { SEGMENT_1_LENGTH } from './_internal';
import validateId from './validateId';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Extracts the Unix epoch timestamp in milliseconds from a timed ID.
 *
 * Accepts uppercase and lowercase alike, and any value at all: anything
 * that fails `validateId` throws, so callers with untyped input need no
 * cast.
 */
function parseTimedId(id: unknown): number {
  if (!validateId(id)) throw new TypeError('Invalid timed ID.');
  // Arithmetic preserves the full 45-bit timestamp.
  // Bitwise operations would truncate it to 32 bits.
  let epoch = 0;
  for (let i = 0; i < SEGMENT_1_LENGTH; i++) {
    epoch = epoch * 32 + CHAR_VALUES[id.charCodeAt(i)];
  }
  // Return
  return epoch;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default parseTimedId;
