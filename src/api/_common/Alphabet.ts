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
const codes = new Uint8Array(32);
for (let i = 0; i < codes.length; i++) {
  codes[i] = ALPHABET.charCodeAt(i);
}

// ---- Double Codes
// Two character codes packed little-endian into 16 bits, indexed by a
// 10-bit value, so a pool writer can emit two characters per lookup.
const doubleCodes = new Uint16Array(1024);
for (let i = 0; i < doubleCodes.length; i++) {
  doubleCodes[i] =
    ALPHABET.charCodeAt(i >>> 5) | (ALPHABET.charCodeAt(i & 31) << 8);
}

// ---- Pairs
// The same 10-bit split as DOUBLE_CODES, but as ready-made two-character
// strings. For the parts of an ID that are built by concatenation rather
// than written into a pool, one lookup here replaces two.
const pairs = new Array<string>(1024);
for (let i = 0; i < pairs.length; i++) {
  pairs[i] = ALPHABET[i >>> 5] + ALPHABET[i & 31];
}

// ---- Allowed characters and their values
// CHAR_CLASS marks alphabet characters as 1 and the dash as 2.
// Anything left at 0 isn't allowed. Uppercase and lowercase both accepted.
//
// charValues holds the alphabet index of each accepted character, so a
// validated ID can be decoded without a second case check or an
// intermediate uppercase copy.
//
// Both tables are 128 wide. A validator comparing CHAR_CLASS[code] against
// a layout entry with strict equality rejects codes >= 128 for free, since
// an out-of-range typed array read returns undefined.
const charClass = new Uint8Array(128);
const charValues = new Uint8Array(128);
for (let i = 0; i < 32; i++) {
  const code = ALPHABET.charCodeAt(i);
  charClass[code] = 1;
  charValues[code] = i;
  if (code >= 65) {
    charClass[code | 32] = 1; // Lowercase letter.
    charValues[code | 32] = i;
  }
}
charClass[DASH_CODE] = 2;

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Decodes `id[start, end)` of an already-validated ID. Arithmetic rather
 * than bitwise ops, so the 45-bit timestamp isn't truncated to 32 bits.
 */
export function decodeChars(id: string, start: number, end: number): number {
  let value = 0;
  for (let i = start; i < end; i++) {
    value = value * 32 + charValues[id.charCodeAt(i)];
  }
  return value;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export const CODES: Readonly<Uint8Array> = codes;
export const DOUBLE_CODES: Readonly<Uint16Array> = doubleCodes;
export const PAIRS: Readonly<string[]> = pairs;
export const CHAR_CLASS: Readonly<Uint8Array> = charClass;
