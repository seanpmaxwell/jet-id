import { CHAR_VALUES } from '@src/api/_common/alphabet';

import {
  COUNTER_CHARS,
  COUNTER_INDEX,
  FRACTION_INDEX,
  SEGMENT_1_LENGTH,
} from './_internal';
import validateMonotonicBigId from './validateMonotonicBigId';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Reads a big ID back into its three encoded parts.
 *
 * Accepts uppercase and lowercase alike, and any value at all: anything
 * that fails `validateMonotonicBigId` throws, so callers with untyped input
 * need no cast.
 *
 * `epoch` is the one to use as a timestamp: it is whole milliseconds and
 * feeds `new Date()` directly.
 *
 * `fraction` and `counter` are what order two IDs from the same
 * millisecond. Treat them as an ordering key, not as a finer clock:
 *
 *   - `counter` is not time at all. It counts IDs issued while the clock
 *     stood still, so it advances fastest when time does not.
 *   - `fraction` is only as good as the host's clock. `performance.now()`
 *     is coarsened against timing attacks, so measured granularity is
 *     roughly 1us on Node, 0.1ms on Chromium, and a full millisecond on
 *     Firefox and WebKit, where `fraction` never changes and `counter`
 *     does all the work.
 *
 * So `epoch + fraction / 1024` looks like a sub-millisecond timestamp but
 * silently degrades to `epoch` on most browsers. Comparing either field
 * across processes is meaningless as well, since each anchors to its own
 * `performance.timeOrigin`.
 */
function parseMonotonicBigId(id: unknown): {
  epoch: number;
  fraction: number;
  counter: number;
} {
  if (!validateMonotonicBigId(id)) {
    throw new TypeError('Invalid big ID.');
  }
  // Arithmetic preserves the full 45-bit timestamp.
  // Bitwise operations would truncate it to 32 bits.
  let epoch = 0;
  for (let i = 0; i < SEGMENT_1_LENGTH; i++) {
    epoch = epoch * 32 + CHAR_VALUES[id.charCodeAt(i)];
  }
  // The sequence: two characters of fraction, then four of counter.
  let fraction = 0;
  for (let i = FRACTION_INDEX; i < COUNTER_INDEX; i++) {
    fraction = fraction * 32 + CHAR_VALUES[id.charCodeAt(i)];
  }
  let counter = 0;
  for (let i = COUNTER_INDEX; i < COUNTER_INDEX + COUNTER_CHARS; i++) {
    counter = counter * 32 + CHAR_VALUES[id.charCodeAt(i)];
  }
  // Return
  return { epoch, fraction, counter };
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default parseMonotonicBigId;
