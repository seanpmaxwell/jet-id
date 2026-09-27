// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //
//
// Values duplicated across two or more test files. Anything used by a single
// file stays in that file.

// ---- Alphabet
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// ---- The 9-6-5-5 format, shared by every variant
export const ID_LENGTH = 28;
export const DASH_INDICES: readonly number[] = [9, 16, 22];
export const VALID_DUMMY_ID = '0123456AB-CDEFGH-JKMNP-QRSTV';

export const MONO_ID_PATTERN = new RegExp(
  `^[${ALPHABET}]{9}-[${ALPHABET}]{6}-[${ALPHABET}]{5}-[${ALPHABET}]{5}$`,
);

// ---- Timestamps
export const TIMESTAMP_LIMIT = 32 ** 9;

// ---- Rejection cases
export const NON_STRING_VALUES: readonly unknown[] = [
  undefined,
  null,
  123,
  0,
  NaN,
  true,
  {},
  [VALID_DUMMY_ID],
  () => VALID_DUMMY_ID,
  Symbol('id'),
  new String(VALID_DUMMY_ID), // An object, not a primitive string.
] as const;
