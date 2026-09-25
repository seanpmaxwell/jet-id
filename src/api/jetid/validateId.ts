import { createLayoutValidator } from '../_common/validate';

import { LAYOUT } from './_internal';

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

/**
 * Checks whether a value matches the jet-id format.
 * Accepts both uppercase and lowercase letters.
 */
const validateId = createLayoutValidator(LAYOUT);

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default validateId;
