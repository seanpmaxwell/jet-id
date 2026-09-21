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

// ---- `jetId.mono`
describe('jetId.mono() in the browser', () => {
  // `jetIdMono` keeps its own pool with its own decode branch, and is the only
  // part of the API that needs `performance.timeOrigin`. Both of those are
  // what differ between Node and a browser, so they are checked here for real
  // rather than by stubbing `Buffer` away in a Node test.
  it('has the high-resolution clock it depends on', () => {
    expect(typeof performance.now).toBe('function');
    expect(Number.isFinite(performance.timeOrigin)).toBe(true);
  });

  it('returns a valid id in the 9-6-8-8-9 layout', () => {
    const id = jetId.mono();
    expect(id).toHaveLength(44);
    expect(id.split('-').map((segment) => segment.length)).toEqual([
      9, 6, 8, 8, 9,
    ]);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z-]{44}$/);
  });

  it('returns ids that sort in generation order across pool refills', () => {
    const ids: string[] = [];
    for (let i = 0; i < 10_000; i++) {
      ids.push(jetId.mono());
    }
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(10_000);
  });
});
