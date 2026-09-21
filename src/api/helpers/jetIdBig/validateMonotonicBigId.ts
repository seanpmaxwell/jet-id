import { createLayoutValidator } from '@src/api/_common/validate';

import { LAYOUT } from './_internal';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

/**
 * Checks whether a value matches the 9-6-8-8-9 big-ID format.
 * Accepts both uppercase and lowercase letters.
 *
 * This is a shape check, not a provenance check. It confirms the length,
 * the alphabet and the dash positions; it cannot tell whether the sequence
 * segment came from this module's counter. A 28-character `jetId` never
 * passes, and neither does a big ID given to `jetId.test`.
 */
const validateMonotonicBigId = createLayoutValidator(LAYOUT);

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default validateMonotonicBigId;
