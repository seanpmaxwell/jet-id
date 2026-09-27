import { describe, expect, expectTypeOf, it } from 'vitest';

import jetIdMono from '@src/api/jetIdMono/jetIdMono';
import generateId from '@src/api/jetIdRaw/generateId';
import jetIdTimed from '@src/api/jetIdTimed/jetIdTimed';
import jetid from '@src/index';

describe('public API assembly', () => {
  it('exposes all three generators and their helpers', () => {
    expect(jetid).toBe(generateId);
    expect(jetid.timed).toBe(jetIdTimed);
    expect(jetid.mono).toBe(jetIdMono);
    expect(jetid.mono).not.toHaveProperty('test');
    expect(jetid.timed).not.toHaveProperty('test');
    expect(jetid.test(jetid(80))).toBe(true);
    expect(jetid.timed.parse(jetid.timed({ epoch: 0, entropy: 1024 }))).toBe(0);
    const mono = jetid.mono(125);
    expect(jetid.test(mono)).toBe(true);
    expect(jetid.mono.parse(mono).epoch).toBeGreaterThan(0);
  });

  it('preserves the timed wrapper options signature', () => {
    expectTypeOf<Parameters<typeof jetIdTimed>>().toEqualTypeOf<
      [options?: { epoch?: number; entropy?: number }]
    >();
    expectTypeOf(jetid.timed).toEqualTypeOf(jetIdTimed);
    const timed = jetIdTimed({ epoch: 0, entropy: 1024 });
    expect(timed).toHaveLength(235);
    expect(jetIdTimed.parse(timed)).toBe(0);
  });
});
