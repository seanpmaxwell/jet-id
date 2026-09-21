// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //
//
// Values duplicated across two or more test files. Anything used by a single
// file stays in that file.

// ---- Alphabet
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// ---- `jetId`, the 9-5-5-6 format
export const ID_LENGTH = 28;
export const DASH_INDICES = [9, 15, 21];
export const VALID_DUMMY_ID = '0123456AB-CDEFG-HJKMN-PQRSTV';

// ---- `jetIdMono`, the 9-6-8-8-9 format
export const MONO_ID_LENGTH = 44;
export const MONO_DASH_INDICES = [9, 16, 25, 34];
export const VALID_DUMMY_MONO_ID =
  '0123456AB-CDEFGH-JKMNPQRS-TVWXYZ01-23456789A';

export const MONO_ID_PATTERN = new RegExp(
  `^[${ALPHABET}]{9}-[${ALPHABET}]{6}-[${ALPHABET}]{8}-` +
    `[${ALPHABET}]{8}-[${ALPHABET}]{9}$`,
);

// ---- Timestamps
export const TIMESTAMP_LIMIT = 32 ** 9;

// ---- Rejection cases
export const NON_STRING_VALUES: unknown[] = [
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
