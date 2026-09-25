import { describe, expect, it } from 'vitest';

import jetid from '@src/index';

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

// ---- `default jetid`
describe('jetid()', () => {
  it('returns a string of 28 characters', () => {
    const id = jetid();
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(ID_LENGTH);
  });

  it('uses the 9-5-5-6 dash layout', () => {
    const segments = jetid().split('-');
    const lengths = segments.map((segment) => segment.length);
    expect(lengths).toEqual([9, 5, 5, 6]);
  });

  it('only uses Crockford base32 characters', () => {
    for (let i = 0; i < 1_000; i++) {
      const res = jetid.test(jetid());
      expect(res).toBe(true);
    }
  });

  it('generates unique ids across multiple pool refills', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      ids.add(jetid());
    }
    expect(ids.size).toBe(10_000);
  });
});

// ---- `.test`
describe('jetid.test', () => {
  it('accepts valid ids', () => {
    const dummyRes = jetid.test(VALID_DUMMY_ID);
    expect(dummyRes).toBe(true);
    for (let i = 0; i < 1_000; i++) {
      const id = jetid();
      const res = jetid.test(id);
      expect(res).toBe(true);

      const lower = jetid().toLowerCase();
      const lowerRes = jetid.test(lower);
      expect(lowerRes).toBe(true);
    }
  });

  it('rejects non-strings', () => {
    for (const value of NON_STRING_VALUES) {
      const res = jetid.test(value);
      expect(res).toBe(false);
    }
  });

  it('rejects the wrong length', () => {
    const tooLong = VALID_DUMMY_ID + 'Z';
    const spacePrefixed = ' ' + VALID_DUMMY_ID;

    for (const value of [tooLong, spacePrefixed]) {
      const res = jetid.test(value);
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
        const res = jetid.test(id);
        expect(res, `index ${i}, code point ${char.charCodeAt(0)}`).toBe(false);
      }
    }
  });

  it('rejects a dash at any non-dash index', () => {
    for (let i = 0; i < ID_LENGTH; i++) {
      if (!DASH_INDICES.includes(i)) {
        const id = swap(VALID_DUMMY_ID, i, '-');
        const res = jetid.test(id);
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
      const res = jetid.test(value);
      expect(res, value).toBe(false);
    }
  });
});

// ---- `.timed`
describe('jetid.timed', () => {
  it('returns a valid id in the 9-5-5-6 layout', () => {
    const id = jetid.timed();
    expect(id).toHaveLength(ID_LENGTH);
    const segments = id.split('-');
    const lengths = segments.map((segment) => segment.length);
    expect(lengths).toEqual([9, 5, 5, 6]);
    const res = jetid.test(id);
    expect(res).toBe(true);
  });

  it('encodes the epoch in the first nine characters', () => {
    const zeroId = jetid.timed(0);
    const zeroStamp = zeroId.slice(0, 9);
    expect(zeroStamp).toBe('000000000');

    const maxId = jetid.timed(TIMESTAMP_LIMIT - 1);
    const maxStamp = maxId.slice(0, 9);
    expect(maxStamp).toBe('ZZZZZZZZZ');
  });

  it('defaults to the current time', () => {
    const before = Date.now();
    const epoch = jetid.timed.parse(jetid.timed());
    expect(epoch).toBeGreaterThanOrEqual(before);
    expect(epoch).toBeLessThanOrEqual(Date.now());
  });

  it('rejects timestamps it cannot encode', () => {
    for (const epoch of [-1, 1.5, NaN, TIMESTAMP_LIMIT]) {
      expect(() => jetid.timed(epoch), `epoch ${epoch}`).toThrow(RangeError);
    }
  });

  it('generates unique ids across multiple pool refills', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      ids.add(jetid.timed());
    }
    expect(ids.size).toBe(10_000);
  });
});

// ---- `.timed.parse`
describe('jetid.timed.parse', () => {
  it('round-trips a timestamp', () => {
    for (const epoch of [0, 1, 1_433_314_800_000, TIMESTAMP_LIMIT - 1]) {
      const id = jetid.timed(epoch);
      const parsed = jetid.timed.parse(id);
      expect(parsed, `epoch ${epoch}`).toBe(epoch);
    }
  });

  it('ignores the random suffix', () => {
    const epoch = Date.now();
    const ids = [jetid.timed(epoch), jetid.timed(epoch)];
    expect(ids[0]).not.toBe(ids[1]);
    const first = jetid.timed.parse(ids[0]);
    const second = jetid.timed.parse(ids[1]);
    expect(first).toBe(second);
  });

  it('accepts lowercase', () => {
    const epoch = 1_433_314_800_000;
    const id = jetid.timed(epoch);
    const lower = id.toLowerCase();
    const parsed = jetid.timed.parse(lower);
    expect(parsed).toBe(epoch);
  });

  it('throws on a malformed id', () => {
    const id = jetid.timed();
    expect(() => jetid.timed.parse('')).toThrow(TypeError);
    expect(() => jetid.timed.parse(id.slice(1))).toThrow(TypeError);
    const badChar = swap(VALID_DUMMY_ID, 0, 'I');
    expect(() => jetid.timed.parse(badChar)).toThrow(TypeError);
    const badDash = swap(VALID_DUMMY_ID, 0, '-');
    expect(() => jetid.timed.parse(badDash)).toThrow(TypeError);
  });

  it('throws on non-strings', () => {
    for (const value of NON_STRING_VALUES) {
      expect(() => jetid.timed.parse(value as string)).toThrow(TypeError);
    }
  });
});
