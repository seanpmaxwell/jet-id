import { describe, expect, it } from 'vitest';

import jetId from '@src/index';

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

// ---- Environment
describe('browser environment', () => {
  it('runs in a real browser', () => {
    // Reached through `globalThis` so the project doesn't need the DOM lib
    // just for this assertion.
    const browser = globalThis as typeof globalThis & {
      window?: unknown;
      document?: unknown;
    };
    expect(typeof browser.window).toBe('object');
    expect(typeof browser.document).toBe('object');
  });

  it('has no Buffer, so the TextDecoder decode path is used', () => {
    expect(typeof Buffer).toBe('undefined');
  });

  it('uses Web Crypto for randomness', () => {
    expect(typeof globalThis.crypto.getRandomValues).toBe('function');
  });
});

// ---- `default jetId`
describe('jetId() in the browser', () => {
  it('returns a string of 28 characters', () => {
    const id = jetId();
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(28);
  });

  it('uses the 9-5-5-6 dash layout', () => {
    const segments = jetId().split('-');
    expect(segments.map((segment) => segment.length)).toEqual([9, 5, 5, 6]);
  });

  it('only uses Crockford base32 characters', () => {
    for (let i = 0; i < 1_000; i++) {
      expect(jetId.test(jetId())).toBe(true);
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
