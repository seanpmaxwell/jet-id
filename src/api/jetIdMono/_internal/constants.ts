import { SEGMENT_2_LENGTH } from '@cmn/constants/segments';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// ---- Monotonic sequence
// The second segment splits into two fractional-time characters (10 bits)
// and four counter characters (20 bits). The fraction sits above the
// counter, so a later time reading always sorts after every counter value
// belonging to an earlier one. `parse` reads the whole segment back as one
// `sequence`, so this split is never part of the public API.
const FRACTION_CHARS = 2;
export const COUNTER_CHARS = SEGMENT_2_LENGTH - FRACTION_CHARS; // 4

export const FRACTION_STEPS = 2 ** (FRACTION_CHARS * 5); // 1024
export const COUNTER_LIMIT = 2 ** (COUNTER_CHARS * 5); // 1048576
