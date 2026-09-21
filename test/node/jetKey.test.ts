import { describe, expect, it } from 'vitest';

import jetId, { jetKey } from '@src/index';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const KEY_PATTERN = /^[0-9A-HJKMNP-TV-Z]{52}$/;
const KEY_LENGTH = 52;

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

// ---- `jetKey`
describe('jetKey()', () => {
  it('returns a string of 52 characters', () => {
    const key = jetKey();
    expect(typeof key).toBe('string');
    expect(key).toHaveLength(KEY_LENGTH);
  });

  it('only uses Crockford base32 characters, with no dashes', () => {
    for (let i = 0; i < 1_000; i++) {
      const key = jetKey();
      expect(key).toMatch(KEY_PATTERN);
    }
  });

  it('is not a valid jet-id', () => {
    const key = jetKey();
    const res = jetId.test(key);
    expect(res).toBe(false);
  });

  it('generates unique keys across multiple pool refills', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      keys.add(jetKey());
    }
    expect(keys.size).toBe(10_000);
  });
});
