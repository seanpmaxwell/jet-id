// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const DASH_CODE = 45; // '-'

export const SEGMENT_1_LENGTH = 9;
const SEGMENT_2_LENGTH = 5;
const SEGMENT_3_LENGTH = 5;
const SEGMENT_4_LENGTH = 6;

export const DASH_1_INDEX = SEGMENT_1_LENGTH; // 9
export const DASH_2_INDEX = DASH_1_INDEX + 1 + SEGMENT_2_LENGTH; // 15
export const DASH_3_INDEX = DASH_2_INDEX + 1 + SEGMENT_3_LENGTH; // 21
export const ID_LENGTH = DASH_3_INDEX + 1 + SEGMENT_4_LENGTH; // 28

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

// ---- Platform check
if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {
  throw new Error('jet-id requires a little-endian platform.');
}

// ============================== .fillRandom ============================== //

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeCrypto = (globalThis as any).process?.getBuiltinModule?.(
  'node:crypto',
);

export const fillRandom: (buffer: Uint8Array) => unknown =
  typeof nodeCrypto?.randomFillSync === 'function'
    ? nodeCrypto.randomFillSync
    : globalThis.crypto.getRandomValues.bind(globalThis.crypto);

// ============================= Lookup Tables ============================= //

// ---- Double Codes
const doubleCodesInit = new Uint16Array(1024);
for (let i = 0; i < doubleCodesInit.length; i++) {
  doubleCodesInit[i] =
    ALPHABET.charCodeAt(i >>> 5) | (ALPHABET.charCodeAt(i & 31) << 8);
}
export const DOUBLE_CODES = doubleCodesInit;

// ---- Codes
const codesInit = new Uint8Array(32);
for (let i = 0; i < codesInit.length; i++) {
  codesInit[i] = ALPHABET.charCodeAt(i);
}
export const CODES = codesInit;
