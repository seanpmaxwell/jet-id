import {
  ALPHABET,
  DASH_1_INDEX,
  DASH_2_INDEX,
  DASH_3_INDEX,
  DASH_CODE,
  ID_LENGTH,
} from './_common';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// ---- Allowed characters
// Mark alphabet characters as 1 and the dash as 2.
// Accept both uppercase and lowercase letters.
// Anything left at 0 isn't allowed.
const CHAR_CLASS = new Uint8Array(128);
for (let i = 0; i < 32; i++) {
  const code = ALPHABET.charCodeAt(i);
  CHAR_CLASS[code] = 1;
  if (code >= 65) {
    CHAR_CLASS[code | 32] = 1; // Allow the lowercase version too.
  }
}
CHAR_CLASS[DASH_CODE] = 2;

// ---- Character values
// The alphabet index of each character, so a validated ID can be decoded
// without a second case check or an intermediate uppercase copy.
export const CHAR_VALUES = new Uint8Array(128);
for (let i = 0; i < 32; i++) {
  const code = ALPHABET.charCodeAt(i);
  CHAR_VALUES[code] = i;
  if (code >= 65) {
    CHAR_VALUES[code | 32] = i; // Decode the lowercase version too.
  }
}

// ---- Expected layout
// Every position needs an alphabet character, except the three dash spots.
const LAYOUT = new Uint8Array(ID_LENGTH).fill(1);
LAYOUT[DASH_1_INDEX] = 2;
LAYOUT[DASH_2_INDEX] = 2;
LAYOUT[DASH_3_INDEX] = 2;

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Checks whether a value matches the jet-id format.
 * Accepts both uppercase and lowercase letters.
 */
function validateId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== ID_LENGTH) {
    return false;
  }
  for (let i = 0; i < ID_LENGTH; i++) {
    const c = value.charCodeAt(i);
    if (c > 127 || CHAR_CLASS[c] !== LAYOUT[i]) {
      return false;
    }
  }
  return true;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default validateId;
