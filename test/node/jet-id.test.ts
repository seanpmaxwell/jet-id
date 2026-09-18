import { describe, expect, it } from 'vitest';

import jetId from '@src/index';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const DASH_INDICES = [6, 13, 21];
const ID_LENGTH = 28;
const VALID = '0123AB-CDEFGH-JKMNPQR-STVWXY';

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

  it('uses the 6-6-7-6 dash layout', () => {
    const segments = jetId().split('-');
    expect(segments.map((segment) => segment.length)).toEqual([6, 6, 7, 6]);
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
    expect(jetId.test('0123A-BCDEFGH-JKMNPQR-STVWXY')).toBe(false); // 5-7-7-6
    expect(jetId.test('0123AB-CDEFGH-JKMNPQRSTVWXY')).toBe(false); // 6-6-13
    expect(jetId.test('0123AB-CDEFG-HJKMNPQR-STVWXY')).toBe(false); // 6-5-8-6
  });
});
