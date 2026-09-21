import { CHAR_CLASS } from './alphabet';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Returns a validator for one ID layout.
 *
 * `layout` holds the expected CHAR_CLASS value at every position: 1 for an
 * alphabet character, 2 for a dash. The result checks type, length, and
 * then every position, accepting either letter case.
 *
 * No bounds check on the character code is needed: CHAR_CLASS is 128 wide,
 * so any code past it reads back `undefined`, which never equals a layout
 * entry.
 */
export function createLayoutValidator(
  layout: Uint8Array,
): (value: unknown) => value is string {
  const length = layout.length;
  return (value: unknown): value is string => {
    if (typeof value !== 'string' || value.length !== length) {
      return false;
    }
    for (let i = 0; i < length; i++) {
      if (CHAR_CLASS[value.charCodeAt(i)] !== layout[i]) {
        return false;
      }
    }
    return true;
  };
}
