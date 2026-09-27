import { decodeChars } from '@Alphabet';

import {
  DASH_1_INDEX,
  DASH_2_INDEX,
  SEGMENT_1_LENGTH,
} from '@cmn/constants/segments';
import validateId from '@cmn/utils/validateId';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Reads a monotonic ID back into its two encoded parts.
 *
 * Accepts uppercase and lowercase alike, and any value at all: anything
 * that fails `validateId` throws, so callers with untyped input
 * need no cast.
 *
 * `epoch` is the one to use as a timestamp: it is whole milliseconds and
 * feeds `new Date()` directly.
 *
 * `sequence` orders two IDs from the same millisecond: the later ID has the
 * higher value. It is the whole second segment read as one number, so the
 * fraction/counter split inside it stays private. Treat it as an ordering
 * key, not as a finer clock:
 *
 *   - The counter half is not time at all. It counts IDs issued while the
 *     clock stood still, so it advances fastest when time does not.
 *   - The fraction half is only as good as the host's clock.
 *     `performance.now()` is coarsened against timing attacks, so measured
 *     granularity is roughly 1us on Node, 0.1ms on Chromium, and a full
 *     millisecond on Firefox and WebKit, where the fraction never changes
 *     and the counter does all the work.
 *
 * Comparing `sequence` across processes is meaningless as well, since each
 * keeps its own counter and anchors to its own `performance.timeOrigin`.
 */
function parseMonoId(id: unknown): {
  epoch: number;
  sequence: number;
} {
  if (!validateId(id)) {
    throw new TypeError('Invalid mono ID.');
  }
  return {
    epoch: decodeChars(id, 0, SEGMENT_1_LENGTH),
    sequence: decodeChars(id, DASH_1_INDEX + 1, DASH_2_INDEX),
  };
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default parseMonoId;
