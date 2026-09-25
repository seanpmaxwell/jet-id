import { describe, expect, it } from 'vitest';

import jetid from '@src/index';

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

// ---- `default jetid`
describe('jetid() in the browser', () => {
  it('returns a string of 28 characters', () => {
    const id = jetid();
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(28);
  });

  it('uses the 9-5-5-6 dash layout', () => {
    const segments = jetid().split('-');
    expect(segments.map((segment) => segment.length)).toEqual([9, 5, 5, 6]);
  });

  it('only uses Crockford base32 characters', () => {
    for (let i = 0; i < 1_000; i++) {
      expect(jetid.test(jetid())).toBe(true);
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

// ---- `jetid.mono`
describe('jetid.mono() in the browser', () => {
  // `jetidMono` keeps its own pool with its own decode branch, and is the only
  // part of the API that needs `performance.timeOrigin`. Both of those are
  // what differ between Node and a browser, so they are checked here for real
  // rather than by stubbing `Buffer` away in a Node test.
  it('has the high-resolution clock it depends on', () => {
    expect(typeof performance.now).toBe('function');
    expect(Number.isFinite(performance.timeOrigin)).toBe(true);
  });

  it('returns a valid id in the 9-6-8-8-9 layout', () => {
    const id = jetid.mono();
    expect(id).toHaveLength(44);
    expect(id.split('-').map((segment) => segment.length)).toEqual([
      9, 6, 8, 8, 9,
    ]);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z-]{44}$/);
  });

  it('returns ids that sort in generation order across pool refills', () => {
    const ids: string[] = [];
    for (let i = 0; i < 10_000; i++) {
      ids.push(jetid.mono());
    }
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(10_000);
  });
});
