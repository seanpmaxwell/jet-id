// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Nine Crockford base32 characters hold 45 bits of milliseconds, which runs
// to the year 3084. Both timestamped formats use this width, so a layout's
// first segment must be TIMESTAMP_CHARS long.
export const TIMESTAMP_CHARS = 9;
export const TIMESTAMP_LIMIT = 32 ** TIMESTAMP_CHARS; // 2^45

// The 9-6-5-5 format: 25 Crockford characters and three dashes.
// Shared by the random variant (all 25 characters random) and the timed
// variant (first segment is a timestamp, remaining 16 characters random).
export const SEGMENT_1_LENGTH = TIMESTAMP_CHARS; // 9
export const SEGMENT_2_LENGTH = 6;
export const SEGMENT_3_LENGTH = 5;
export const SEGMENT_4_LENGTH = 5;

export const DASH_1_INDEX = SEGMENT_1_LENGTH; // 9
export const DASH_2_INDEX = DASH_1_INDEX + 1 + SEGMENT_2_LENGTH; // 16
export const DASH_3_INDEX = DASH_2_INDEX + 1 + SEGMENT_3_LENGTH; // 22
export const ID_LENGTH = DASH_3_INDEX + 1 + SEGMENT_4_LENGTH; // 28
