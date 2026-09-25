import { TIMESTAMP_CHARS } from '@src/api/_common/timestamp';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// ---- Layout
// The 9-6-8-8-9 format: 40 Crockford characters and four dashes.
export const SEGMENT_1_LENGTH = TIMESTAMP_CHARS; // 9
export const SEGMENT_2_LENGTH = 6;
export const SEGMENT_3_LENGTH = 8;
export const SEGMENT_4_LENGTH = 8;
export const SEGMENT_5_LENGTH = 9;

export const DASH_1_INDEX = SEGMENT_1_LENGTH; // 9
export const DASH_2_INDEX = DASH_1_INDEX + 1 + SEGMENT_2_LENGTH; // 16
export const DASH_3_INDEX = DASH_2_INDEX + 1 + SEGMENT_3_LENGTH; // 25
export const DASH_4_INDEX = DASH_3_INDEX + 1 + SEGMENT_4_LENGTH; // 34
export const ID_LENGTH = DASH_4_INDEX + 1 + SEGMENT_5_LENGTH; // 44

// ---- Monotonic sequence
// The second segment splits into two fractional-time characters (10 bits)
// and four counter characters (20 bits). The fraction sits above the
// counter, so a later time reading always sorts after every counter value
// belonging to an earlier one.
const FRACTION_CHARS = 2;
export const COUNTER_CHARS = SEGMENT_2_LENGTH - FRACTION_CHARS; // 4

export const FRACTION_STEPS = 2 ** (FRACTION_CHARS * 5); // 1024
export const COUNTER_LIMIT = 2 ** (COUNTER_CHARS * 5); // 1048576

// String offsets of each part, for reading an ID back.
export const FRACTION_INDEX = DASH_1_INDEX + 1; // 10
export const COUNTER_INDEX = FRACTION_INDEX + FRACTION_CHARS; // 12

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

// ---- Expected layout
// Every position needs an alphabet character, except the four dash spots.
// Values are CHAR_CLASS entries: 1 for a character, 2 for the dash.
const layoutInit = new Uint8Array(ID_LENGTH).fill(1);
layoutInit[DASH_1_INDEX] = 2;
layoutInit[DASH_2_INDEX] = 2;
layoutInit[DASH_3_INDEX] = 2;
layoutInit[DASH_4_INDEX] = 2;
export const LAYOUT = layoutInit;
