import { decodeChars } from '@Alphabet';

import { SEGMENT_1_LENGTH } from '@cmn/constants/segments';
import validateId from '@cmn/utils/validateId';

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
  return decodeChars(id, 0, SEGMENT_1_LENGTH);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default parseTimedId;
