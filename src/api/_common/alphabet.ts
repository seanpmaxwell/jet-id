// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const DASH_CODE = 45; // '-'

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

// ---- Codes
// The character code of each alphabet index, for single-character writes.
const codesInit = new Uint8Array(32);
for (let i = 0; i < codesInit.length; i++) {
  codesInit[i] = ALPHABET.charCodeAt(i);
}
export const CODES = codesInit;

// ---- Double Codes
// Two character codes packed little-endian into 16 bits, indexed by a
// 10-bit value, so a pool writer can emit two characters per lookup.
const doubleCodesInit = new Uint16Array(1024);
for (let i = 0; i < doubleCodesInit.length; i++) {
  doubleCodesInit[i] =
    ALPHABET.charCodeAt(i >>> 5) | (ALPHABET.charCodeAt(i & 31) << 8);
}
export const DOUBLE_CODES = doubleCodesInit;

// ---- Pairs
// The same 10-bit split as DOUBLE_CODES, but as ready-made two-character
// strings. For the parts of an ID that are built by concatenation rather
// than written into a pool, one lookup here replaces two.
const pairsInit = new Array<string>(1024);
for (let i = 0; i < pairsInit.length; i++) {
  pairsInit[i] = ALPHABET[i >>> 5] + ALPHABET[i & 31];
}
export const PAIRS: readonly string[] = pairsInit;

// ---- Allowed characters and their values
// CHAR_CLASS marks alphabet characters as 1 and the dash as 2.
// Anything left at 0 isn't allowed. Uppercase and lowercase both accepted.
//
// CHAR_VALUES holds the alphabet index of each accepted character, so a
// validated ID can be decoded without a second case check or an
// intermediate uppercase copy.
//
// Both tables are 128 wide. A validator comparing CHAR_CLASS[code] against
// a layout entry with strict equality rejects codes >= 128 for free, since
// an out-of-range typed array read returns undefined.
const charClassInit = new Uint8Array(128);
const charValuesInit = new Uint8Array(128);
for (let i = 0; i < 32; i++) {
  const code = ALPHABET.charCodeAt(i);
  charClassInit[code] = 1;
  charValuesInit[code] = i;
  if (code >= 65) {
    charClassInit[code | 32] = 1; // Lowercase letter.
    charValuesInit[code | 32] = i;
  }
}
charClassInit[DASH_CODE] = 2;
export const CHAR_CLASS = charClassInit;
export const CHAR_VALUES = charValuesInit;
