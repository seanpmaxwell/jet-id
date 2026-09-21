import { beforeEach, describe, expect, it } from 'vitest';

import { resetGeneratorState } from '@src/api/helpers/jetIdBig/generateMonotonicBigId';
import jetId, { jetIdBig, jetKey } from '@src/index';

import {
  BIG_DASH_INDICES,
  BIG_ID_LENGTH,
  BIG_ID_PATTERN,
  NON_STRING_VALUES,
  TIMESTAMP_LIMIT,
  VALID_DUMMY_BIG_ID,
} from '@test/_common/constants';
import { decodeBase32, swap } from '@test/_common/utils';

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

// ---- `jetIdBig`
describe('jetIdBig()', () => {
  // The sequence lives in module state, so each case starts from a fresh
  // one instead of inheriting the counter the previous case left behind.
  beforeEach(resetGeneratorState);

  it('puts a dash at every layout boundary and nowhere else', () => {
    const id = jetIdBig();
    for (let i = 0; i < BIG_ID_LENGTH; i++) {
      const isDash = id[i] === '-';
      const shouldBeDash = BIG_DASH_INDICES.includes(i);
      expect(isDash, `index ${i}`).toBe(shouldBeDash);
    }
  });

  it('only uses Crockford base32 characters', () => {
    for (let i = 0; i < 1_000; i++) {
      const id = jetIdBig();
      expect(id).toMatch(BIG_ID_PATTERN);
    }
  });

  it('encodes the current time in the first nine characters', () => {
    // Decoded here rather than through `jetId.timed.parse`, which validates
    // the 28-character format and so rejects a big id outright.
    const id = jetIdBig();
    const timestamp = id.slice(0, 9);
    const epoch = decodeBase32(timestamp);
    const res = Math.abs(epoch - Date.now());
    expect(res).toBeLessThan(1_000);
  });

  it('generates unique ids across multiple pool refills', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      ids.add(jetIdBig());
    }
    expect(ids.size).toBe(10_000);
  });

  it('returns ids that sort in generation order', () => {
    const ids: string[] = [];
    for (let i = 0; i < 10_000; i++) {
      ids.push(jetIdBig());
    }
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });

  it('is a different format, so it fails the 28-character validator', () => {
    for (let i = 0; i < 100; i++) {
      const id = jetIdBig();
      const res = jetId.test(id);
      expect(res).toBe(false);
    }
  });
});

// ---- `jetIdBig.test`
describe('jetIdBig.test', () => {
  it('accepts a well-formed id, in either case', () => {
    const dummyRes = jetIdBig.test(VALID_DUMMY_BIG_ID);
    expect(dummyRes).toBe(true);
    for (let i = 0; i < 1_000; i++) {
      const id = jetIdBig();
      const res = jetIdBig.test(id);
      expect(res).toBe(true);
      const lower = id.toLowerCase();
      const lowerRes = jetIdBig.test(lower);
      expect(lowerRes).toBe(true);
    }
  });

  it('rejects non-strings', () => {
    for (const value of NON_STRING_VALUES) {
      const res = jetIdBig.test(value);
      expect(res).toBe(false);
    }
  });

  it('rejects the wrong length', () => {
    const tooLong = VALID_DUMMY_BIG_ID + 'Z';
    const tooShort = VALID_DUMMY_BIG_ID.slice(1);
    const spacePrefixed = ' ' + VALID_DUMMY_BIG_ID.slice(1);
    for (const value of [tooLong, tooShort, spacePrefixed]) {
      const res = jetIdBig.test(value);
      expect(res, value).toBe(false);
    }
  });

  it('rejects characters outside Crockford base32', () => {
    // I, L, O and U are excluded from the alphabet on purpose.
    for (const char of ['I', 'L', 'O', 'U', '@', 'é']) {
      const id = swap(VALID_DUMMY_BIG_ID, 0, char);
      const res = jetIdBig.test(id);
      expect(res, char).toBe(false);
    }
  });

  it('rejects code points past the lookup tables', () => {
    // The validator has no explicit bounds check: CHAR_CLASS is 128 wide, so
    // anything above it reads back `undefined` and fails the comparison.
    // Pinned because that behaviour is implicit and easy to break.
    const beyond = ['\u0080', '\u00e9', '\u0100', '\u4e00', '\uffff', '\ud800'];
    for (let i = 0; i < BIG_ID_LENGTH; i++) {
      for (const char of beyond) {
        const id = swap(VALID_DUMMY_BIG_ID, i, char);
        const res = jetIdBig.test(id);
        expect(res, `index ${i}, code point ${char.charCodeAt(0)}`).toBe(false);
      }
    }
  });

  it('rejects a dash at any non-dash index', () => {
    for (let i = 0; i < BIG_ID_LENGTH; i++) {
      if (!BIG_DASH_INDICES.includes(i)) {
        const id = swap(VALID_DUMMY_BIG_ID, i, '-');
        const res = jetIdBig.test(id);
        expect(res, `dash at index ${i}`).toBe(false);
      }
    }
  });

  it('rejects an alphabet character where a dash belongs', () => {
    for (const i of BIG_DASH_INDICES) {
      const id = swap(VALID_DUMMY_BIG_ID, i, 'A');
      const res = jetIdBig.test(id);
      expect(res, `index ${i}`).toBe(false);
    }
  });

  it('rejects the other formats in this package', () => {
    for (let i = 0; i < 100; i++) {
      const plain = jetId();
      const timed = jetId.timed();
      const key = jetKey();
      for (const value of [plain, timed, key]) {
        const res = jetIdBig.test(value);
        expect(res, value).toBe(false);
      }
    }
  });
});

// ---- `jetIdBig.parse`
describe('jetIdBig.parse', () => {
  beforeEach(resetGeneratorState);

  it('reads back every field the generator encoded', () => {
    for (let i = 0; i < 1_000; i++) {
      const id = jetIdBig();
      const parsed = jetIdBig.parse(id);
      const epoch = decodeBase32(id.slice(0, 9));
      const fraction = decodeBase32(id.slice(10, 12));
      const counter = decodeBase32(id.slice(12, 16));
      expect(parsed).toEqual({ epoch, fraction, counter });
    }
  });

  it('keeps each field inside the width its characters allow', () => {
    for (let i = 0; i < 1_000; i++) {
      const id = jetIdBig();
      const { epoch, fraction, counter } = jetIdBig.parse(id);
      const epochIsSafe = Number.isSafeInteger(epoch);
      expect(epochIsSafe).toBe(true);
      expect(epoch).toBeGreaterThanOrEqual(0);
      expect(epoch).toBeLessThan(TIMESTAMP_LIMIT);
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThan(1024); // two characters, 10 bits
      expect(counter).toBeGreaterThanOrEqual(0);
      expect(counter).toBeLessThan(1_048_576); // four characters, 20 bits
    }
  });

  it('accepts lowercase', () => {
    const id = jetIdBig();
    const lowercaseId = id.toLowerCase();
    const lowerCaseParse = jetIdBig.parse(lowercaseId);
    const normalParse = jetIdBig.parse(id);
    expect(lowerCaseParse).toEqual(normalParse);
  });

  it('throws on a malformed id', () => {
    const tooShort = VALID_DUMMY_BIG_ID.slice(1);
    const badChar = swap(VALID_DUMMY_BIG_ID, 0, 'I');
    const badDash = swap(VALID_DUMMY_BIG_ID, 0, '-');
    const plainId = jetId();

    expect(() => jetIdBig.parse('')).toThrow(TypeError);
    expect(() => jetIdBig.parse(tooShort)).toThrow(TypeError);
    expect(() => jetIdBig.parse(badChar)).toThrow(TypeError);
    expect(() => jetIdBig.parse(badDash)).toThrow(TypeError);
    expect(() => jetIdBig.parse(plainId)).toThrow(TypeError);
  });

  it('throws on non-strings', () => {
    for (const value of NON_STRING_VALUES) {
      expect(() => jetIdBig.parse(value as string)).toThrow(TypeError);
    }
  });
});
