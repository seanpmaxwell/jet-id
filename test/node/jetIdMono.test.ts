import { beforeEach, describe, expect, it } from 'vitest';

import { resetGeneratorState } from '@src/api/helpers/jetIdMono/generateMonoId';
import jetId, { jetIdMono, jetKey } from '@src/index';

import {
  MONO_DASH_INDICES,
  MONO_ID_LENGTH,
  MONO_ID_PATTERN,
  NON_STRING_VALUES,
  TIMESTAMP_LIMIT,
  VALID_DUMMY_MONO_ID,
} from '@test/_common/constants';
import { decodeBase32, swap } from '@test/_common/utils';

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

// ---- `jetIdMono`
describe('jetIdMono()', () => {
  // The sequence lives in module state, so each case starts from a fresh
  // one instead of inheriting the counter the previous case left behind.
  beforeEach(resetGeneratorState);

  it('puts a dash at every layout boundary and nowhere else', () => {
    const id = jetIdMono();
    for (let i = 0; i < MONO_ID_LENGTH; i++) {
      const isDash = id[i] === '-';
      const shouldBeDash = MONO_DASH_INDICES.includes(i);
      expect(isDash, `index ${i}`).toBe(shouldBeDash);
    }
  });

  it('only uses Crockford base32 characters', () => {
    for (let i = 0; i < 1_000; i++) {
      const id = jetIdMono();
      expect(id).toMatch(MONO_ID_PATTERN);
    }
  });

  it('encodes the current time in the first nine characters', () => {
    // Decoded here rather than through `jetId.timed.parse`, which validates
    // the 28-character format and so rejects a mono id outright.
    const id = jetIdMono();
    const timestamp = id.slice(0, 9);
    const epoch = decodeBase32(timestamp);
    const res = Math.abs(epoch - Date.now());
    expect(res).toBeLessThan(1_000);
  });

  it('generates unique ids across multiple pool refills', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      ids.add(jetIdMono());
    }
    expect(ids.size).toBe(10_000);
  });

  it('returns ids that sort in generation order', () => {
    const ids: string[] = [];
    for (let i = 0; i < 10_000; i++) {
      ids.push(jetIdMono());
    }
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });

  it('is a different format, so it fails the 28-character validator', () => {
    for (let i = 0; i < 100; i++) {
      const id = jetIdMono();
      const res = jetId.test(id);
      expect(res).toBe(false);
    }
  });
});

// ---- `jetIdMono.test`
describe('jetIdMono.test', () => {
  it('accepts a well-formed id, in either case', () => {
    const dummyRes = jetIdMono.test(VALID_DUMMY_MONO_ID);
    expect(dummyRes).toBe(true);
    for (let i = 0; i < 1_000; i++) {
      const id = jetIdMono();
      const res = jetIdMono.test(id);
      expect(res).toBe(true);
      const lower = id.toLowerCase();
      const lowerRes = jetIdMono.test(lower);
      expect(lowerRes).toBe(true);
    }
  });

  it('rejects non-strings', () => {
    for (const value of NON_STRING_VALUES) {
      const res = jetIdMono.test(value);
      expect(res).toBe(false);
    }
  });

  it('rejects the wrong length', () => {
    const tooLong = VALID_DUMMY_MONO_ID + 'Z';
    const tooShort = VALID_DUMMY_MONO_ID.slice(1);
    const spacePrefixed = ' ' + VALID_DUMMY_MONO_ID.slice(1);
    for (const value of [tooLong, tooShort, spacePrefixed]) {
      const res = jetIdMono.test(value);
      expect(res, value).toBe(false);
    }
  });

  it('rejects characters outside Crockford base32', () => {
    // I, L, O and U are excluded from the alphabet on purpose.
    for (const char of ['I', 'L', 'O', 'U', '@', 'é']) {
      const id = swap(VALID_DUMMY_MONO_ID, 0, char);
      const res = jetIdMono.test(id);
      expect(res, char).toBe(false);
    }
  });

  it('rejects code points past the lookup tables', () => {
    // The validator has no explicit bounds check: CHAR_CLASS is 128 wide, so
    // anything above it reads back `undefined` and fails the comparison.
    // Pinned because that behaviour is implicit and easy to break.
    const beyond = ['\u0080', '\u00e9', '\u0100', '\u4e00', '\uffff', '\ud800'];
    for (let i = 0; i < MONO_ID_LENGTH; i++) {
      for (const char of beyond) {
        const id = swap(VALID_DUMMY_MONO_ID, i, char);
        const res = jetIdMono.test(id);
        expect(res, `index ${i}, code point ${char.charCodeAt(0)}`).toBe(false);
      }
    }
  });

  it('rejects a dash at any non-dash index', () => {
    for (let i = 0; i < MONO_ID_LENGTH; i++) {
      if (!MONO_DASH_INDICES.includes(i)) {
        const id = swap(VALID_DUMMY_MONO_ID, i, '-');
        const res = jetIdMono.test(id);
        expect(res, `dash at index ${i}`).toBe(false);
      }
    }
  });

  it('rejects an alphabet character where a dash belongs', () => {
    for (const i of MONO_DASH_INDICES) {
      const id = swap(VALID_DUMMY_MONO_ID, i, 'A');
      const res = jetIdMono.test(id);
      expect(res, `index ${i}`).toBe(false);
    }
  });

  it('rejects the other formats in this package', () => {
    for (let i = 0; i < 100; i++) {
      const plain = jetId();
      const timed = jetId.timed();
      const key = jetKey();
      for (const value of [plain, timed, key]) {
        const res = jetIdMono.test(value);
        expect(res, value).toBe(false);
      }
    }
  });
});

// ---- `jetIdMono.parse`
describe('jetIdMono.parse', () => {
  beforeEach(resetGeneratorState);

  it('reads back every field the generator encoded', () => {
    for (let i = 0; i < 1_000; i++) {
      const id = jetIdMono();
      const parsed = jetIdMono.parse(id);
      const epoch = decodeBase32(id.slice(0, 9));
      const fraction = decodeBase32(id.slice(10, 12));
      const counter = decodeBase32(id.slice(12, 16));
      expect(parsed).toEqual({ epoch, fraction, counter });
    }
  });

  it('keeps each field inside the width its characters allow', () => {
    for (let i = 0; i < 1_000; i++) {
      const id = jetIdMono();
      const { epoch, fraction, counter } = jetIdMono.parse(id);
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
    const id = jetIdMono();
    const lowercaseId = id.toLowerCase();
    const lowerCaseParse = jetIdMono.parse(lowercaseId);
    const normalParse = jetIdMono.parse(id);
    expect(lowerCaseParse).toEqual(normalParse);
  });

  it('throws on a malformed id', () => {
    const tooShort = VALID_DUMMY_MONO_ID.slice(1);
    const badChar = swap(VALID_DUMMY_MONO_ID, 0, 'I');
    const badDash = swap(VALID_DUMMY_MONO_ID, 0, '-');
    const plainId = jetId();

    expect(() => jetIdMono.parse('')).toThrow(TypeError);
    expect(() => jetIdMono.parse(tooShort)).toThrow(TypeError);
    expect(() => jetIdMono.parse(badChar)).toThrow(TypeError);
    expect(() => jetIdMono.parse(badDash)).toThrow(TypeError);
    expect(() => jetIdMono.parse(plainId)).toThrow(TypeError);
  });

  it('throws on non-strings', () => {
    for (const value of NON_STRING_VALUES) {
      expect(() => jetIdMono.parse(value as string)).toThrow(TypeError);
    }
  });
});
