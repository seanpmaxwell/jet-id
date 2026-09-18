import { describe, expect, it } from 'vitest';

import jetId from '@src/index';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const DASH_INDICES = [9, 15, 21];
const ID_LENGTH = 28;
const VALID = '0123456AB-CDEFG-HJKMN-PQRSTV';

// Nine Crockford characters hold 45 bits, so this is the first epoch that
// no longer fits.
const TIMESTAMP_LIMIT = 32 ** 9;

const NON_STRING_VALUES: unknown[] = [
  undefined,
  null,
  123,
  0,
  NaN,
  true,
  {},
  [VALID],
  () => VALID,
  Symbol('id'),
  new String(VALID), // An object, not a primitive string.
];

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * A copy of `VALID` with the character at `index` replaced.
 */
function swap(index: number, char: string): string {
  return VALID.slice(0, index) + char + VALID.slice(index + 1);
}

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
    expect(segments.map((segment) => segment.length)).toEqual([9, 5, 5, 6]);
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
    expect(jetId.test(VALID)).toBe(true);
    for (let i = 0; i < 1_000; i++) {
      expect(jetId.test(jetId())).toBe(true);
      expect(jetId.test(jetId().toLowerCase())).toBe(true);
    }
  });

  it('rejects non-strings', () => {
    for (const value of NON_STRING_VALUES) {
      expect(jetId.test(value)).toBe(false);
    }
  });

  it('rejects the wrong length', () => {
    expect(jetId.test(VALID + 'Z')).toBe(false);
    expect(jetId.test(' ' + VALID)).toBe(false);
  });

  it('rejects a dash at any non-dash index', () => {
    for (let i = 0; i < ID_LENGTH; i++) {
      if (!DASH_INDICES.includes(i)) {
        expect(jetId.test(swap(i, '-')), `dash at index ${i}`).toBe(false);
      }
    }
  });

  it('rejects the wrong dash layout', () => {
    expect(jetId.test('0123456A-BCDEFG-HJKMN-PQRSTV')).toBe(false); // 8-6-5-6
    expect(jetId.test('0123456AB-CDEFGH-JKMN-PQRSTV')).toBe(false); // 9-6-4-6
    expect(jetId.test('0123456AB-CDEFG-HJKMNPQRSTVW')).toBe(false); // 9-5-12
  });
});

// ---- `.timed`
describe('jetId.timed', () => {
  it('returns a valid id in the 9-5-5-6 layout', () => {
    const id = jetId.timed();
    expect(id).toHaveLength(ID_LENGTH);
    expect(id.split('-').map((segment) => segment.length)).toEqual([
      9, 5, 5, 6,
    ]);
    expect(jetId.test(id)).toBe(true);
  });

  it('encodes the epoch in the first nine characters', () => {
    expect(jetId.timed(0).slice(0, 9)).toBe('000000000');
    expect(jetId.timed(TIMESTAMP_LIMIT - 1).slice(0, 9)).toBe('ZZZZZZZZZ');
  });

  it('defaults to the current time', () => {
    const before = Date.now();
    const epoch = jetId.parseTimed(jetId.timed());
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

// ---- `.parseTimed`
describe('jetId.parseTimed', () => {
  it('round-trips a timestamp', () => {
    for (const epoch of [0, 1, 1_433_314_800_000, TIMESTAMP_LIMIT - 1]) {
      expect(jetId.parseTimed(jetId.timed(epoch)), `epoch ${epoch}`).toBe(
        epoch,
      );
    }
  });

  it('ignores the random suffix', () => {
    const epoch = Date.now();
    const ids = [jetId.timed(epoch), jetId.timed(epoch)];
    expect(ids[0]).not.toBe(ids[1]);
    expect(jetId.parseTimed(ids[0])).toBe(jetId.parseTimed(ids[1]));
  });

  it('accepts lowercase', () => {
    const epoch = 1_433_314_800_000;
    const id = jetId.timed(epoch);
    expect(jetId.parseTimed(id.toLowerCase())).toBe(epoch);
  });

  it('throws on a malformed id', () => {
    const id = jetId.timed();
    expect(() => jetId.parseTimed('')).toThrow(TypeError);
    expect(() => jetId.parseTimed(id.slice(1))).toThrow(TypeError);
    expect(() => jetId.parseTimed(swap(0, 'I'))).toThrow(TypeError);
    expect(() => jetId.parseTimed(swap(0, '-'))).toThrow(TypeError);
  });

  it('throws on non-strings', () => {
    for (const value of NON_STRING_VALUES) {
      expect(() => jetId.parseTimed(value as string)).toThrow(TypeError);
    }
  });
});
