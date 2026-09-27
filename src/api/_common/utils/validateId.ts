import { CHAR_CLASS } from '@Alphabet';

import { LAYOUTS_BY_LENGTH } from './_internal/layouts';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Checks every character against the canonical layout for the total length.
 */
function validateId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const layout = LAYOUTS_BY_LENGTH[value.length];
  if (!layout) return false;
  for (let i = 0; i < value.length; i++) {
    if (CHAR_CLASS[value.charCodeAt(i)] !== layout.classes[i]) return false;
  }
  return true;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default validateId;
