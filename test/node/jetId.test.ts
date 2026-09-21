import { describe, expect, it } from 'vitest';

import jetId from '@src/index';

import {
  DASH_INDICES,
  ID_LENGTH,
  NON_STRING_VALUES,
  TIMESTAMP_LIMIT,
  VALID_DUMMY_ID,
} from '@test/_common/constants';
import { swap } from '@test/_common/utils';

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

// ---- `default jetId`
describe('jetId()', () => {
  it('returns a string of 28 characters', () => {
    const id = jetId();
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(ID_LENGTH);
  });

  it('uses the 9-5-5-6 dash layout', () => {
    const segments = jetId().split('-');
    const lengths = segments.map((segment) => segment.length);
    expect(lengths).toEqual([9, 5, 5, 6]);
  });

  it('only uses Crockford base32 characters', () => {
    for (let i = 0; i < 1_000; i++) {
      const res = jetId.test(jetId());
      expect(res).toBe(true);
    }
  });

  it('generates unique ids across multiple pool refills', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      ids.add(jetId());
    }
    expect(ids.size).toBe(10_000);
  });
});

// ---- `.test`
describe('jetId.test', () => {
  it('accepts valid ids', () => {
    const dummyRes = jetId.test(VALID_DUMMY_ID);
    expect(dummyRes).toBe(true);
    for (let i = 0; i < 1_000; i++) {
      const id = jetId();
      const res = jetId.test(id);
      expect(res).toBe(true);

      const lower = jetId().toLowerCase();
      const lowerRes = jetId.test(lower);
      expect(lowerRes).toBe(true);
    }
  });

  it('rejects non-strings', () => {
    for (const value of NON_STRING_VALUES) {
      const res = jetId.test(value);
      expect(res).toBe(false);
    }
  });

  it('rejects the wrong length', () => {
    const tooLong = VALID_DUMMY_ID + 'Z';
    const spacePrefixed = ' ' + VALID_DUMMY_ID;

    for (const value of [tooLong, spacePrefixed]) {
      const res = jetId.test(value);
      expect(res, value).toBe(false);
    }
  });

  it('rejects code points past the lookup tables', () => {
    // The validator has no explicit bounds check: CHAR_CLASS is 128 wide, so
    // anything above it reads back `undefined` and fails the comparison.
    // Pinned because that behaviour is implicit and easy to break.
    const beyond = ['\u0080', '\u00e9', '\u0100', '\u4e00', '\uffff', '\ud800'];
    for (let i = 0; i < ID_LENGTH; i++) {
      for (const char of beyond) {
        const id = swap(VALID_DUMMY_ID, i, char);
        const res = jetId.test(id);
        expect(res, `index ${i}, code point ${char.charCodeAt(0)}`).toBe(false);
      }
    }
  });

  it('rejects a dash at any non-dash index', () => {
    for (let i = 0; i < ID_LENGTH; i++) {
      if (!DASH_INDICES.includes(i)) {
        const id = swap(VALID_DUMMY_ID, i, '-');
        const res = jetId.test(id);
        expect(res, `dash at index ${i}`).toBe(false);
      }
    }
  });

  it('rejects the wrong dash layout', () => {
    const layouts = [
      '0123456A-BCDEFG-HJKMN-PQRSTV', // 8-6-5-6
      '0123456AB-CDEFGH-JKMN-PQRSTV', // 9-6-4-6
      '0123456AB-CDEFG-HJKMNPQRSTVW', // 9-5-12
    ];

    for (const value of layouts) {
      const res = jetId.test(value);
      expect(res, value).toBe(false);
    }
  });
});

// ---- `.timed`
describe('jetId.timed', () => {
  it('returns a valid id in the 9-5-5-6 layout', () => {
    const id = jetId.timed();
    expect(id).toHaveLength(ID_LENGTH);
    const segments = id.split('-');
    const lengths = segments.map((segment) => segment.length);
    expect(lengths).toEqual([9, 5, 5, 6]);
    const res = jetId.test(id);
    expect(res).toBe(true);
  });

  it('encodes the epoch in the first nine characters', () => {
    const zeroId = jetId.timed(0);
    const zeroStamp = zeroId.slice(0, 9);
    expect(zeroStamp).toBe('000000000');

    const maxId = jetId.timed(TIMESTAMP_LIMIT - 1);
    const maxStamp = maxId.slice(0, 9);
    expect(maxStamp).toBe('ZZZZZZZZZ');
  });

  it('defaults to the current time', () => {
    const before = Date.now();
    const epoch = jetId.timed.parse(jetId.timed());
    expect(epoch).toBeGreaterThanOrEqual(before);
    expect(epoch).toBeLessThanOrEqual(Date.now());
  });

  it('rejects timestamps it cannot encode', () => {
    for (const epoch of [-1, 1.5, NaN, TIMESTAMP_LIMIT]) {
      expect(() => jetId.timed(epoch), `epoch ${epoch}`).toThrow(RangeError);
    }
  });

  it('generates unique ids across multiple pool refills', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      ids.add(jetId.timed());
    }
    expect(ids.size).toBe(10_000);
  });
});

// ---- `.timed.parse`
describe('jetId.timed.parse', () => {
  it('round-trips a timestamp', () => {
    for (const epoch of [0, 1, 1_433_314_800_000, TIMESTAMP_LIMIT - 1]) {
      const id = jetId.timed(epoch);
      const parsed = jetId.timed.parse(id);
      expect(parsed, `epoch ${epoch}`).toBe(epoch);
    }
  });

  it('ignores the random suffix', () => {
    const epoch = Date.now();
    const ids = [jetId.timed(epoch), jetId.timed(epoch)];
    expect(ids[0]).not.toBe(ids[1]);
    const first = jetId.timed.parse(ids[0]);
    const second = jetId.timed.parse(ids[1]);
    expect(first).toBe(second);
  });

  it('accepts lowercase', () => {
    const epoch = 1_433_314_800_000;
    const id = jetId.timed(epoch);
    const lower = id.toLowerCase();
    const parsed = jetId.timed.parse(lower);
    expect(parsed).toBe(epoch);
  });

  it('throws on a malformed id', () => {
    const id = jetId.timed();
    expect(() => jetId.timed.parse('')).toThrow(TypeError);
    expect(() => jetId.timed.parse(id.slice(1))).toThrow(TypeError);
    const badChar = swap(VALID_DUMMY_ID, 0, 'I');
    expect(() => jetId.timed.parse(badChar)).toThrow(TypeError);
    const badDash = swap(VALID_DUMMY_ID, 0, '-');
    expect(() => jetId.timed.parse(badDash)).toThrow(TypeError);
  });

  it('throws on non-strings', () => {
    for (const value of NON_STRING_VALUES) {
      expect(() => jetId.timed.parse(value as string)).toThrow(TypeError);
    }
  });
});
