import { TIMESTAMP_CHARS } from '../_common/timestamp';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// ---- Layout
// The 9-5-5-6 format: 25 Crockford characters and three dashes.
// Shared by the random variant (all 25 characters random) and the timed
// variant (first segment is a timestamp, remaining 16 characters random).
export const SEGMENT_1_LENGTH = TIMESTAMP_CHARS; // 9
export const SEGMENT_2_LENGTH = 5;
export const SEGMENT_3_LENGTH = 5;
export const SEGMENT_4_LENGTH = 6;

export const DASH_1_INDEX = SEGMENT_1_LENGTH; // 9
export const DASH_2_INDEX = DASH_1_INDEX + 1 + SEGMENT_2_LENGTH; // 15
export const DASH_3_INDEX = DASH_2_INDEX + 1 + SEGMENT_3_LENGTH; // 21
export const ID_LENGTH = DASH_3_INDEX + 1 + SEGMENT_4_LENGTH; // 28

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

// ---- Expected layout
// Every position needs an alphabet character, except the three dash spots.
// Values are CHAR_CLASS entries: 1 for a character, 2 for the dash.
const layoutInit = new Uint8Array(ID_LENGTH).fill(1);
layoutInit[DASH_1_INDEX] = 2;
layoutInit[DASH_2_INDEX] = 2;
layoutInit[DASH_3_INDEX] = 2;
export const LAYOUT = layoutInit;
