import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetGeneratorState } from '@src/api/jetIdMono/generateMonoId';
import jetid from '@src/index';

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

const GENERATORS = [
  { name: 'random', generate: jetid, randomStart: 0, defaultBits: 125 },
  {
    name: 'timed',
    generate: (entropy?: number) => jetid.timed({ epoch: 123456789, entropy }),
    randomStart: 1,
    defaultBits: 80,
  },
  { name: 'mono', generate: jetid.mono, randomStart: 2, defaultBits: 50 },
] as const;

/**
 *
 */
function shape(id: string): number[] {
  return id.split('-').map((segment) => segment.length);
}

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('entropy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetGeneratorState();
  });

  for (const { name, generate, defaultBits } of GENERATORS) {
    describe(name, () => {
      it('keeps the default shape only when entropy is omitted', () => {
        expect(shape(generate())).toEqual([9, 6, 5, 5]);
        expect(shape(generate(undefined))).toEqual([9, 6, 5, 5]);
        expect(shape(generate(Math.max(80, defaultBits)))).toEqual(
          name === 'mono' ? [9, 6, 8, 8] : [9, 6, 10],
        );
      });

      it('rounds fractional requirements up to whole characters', () => {
        const bits = Math.max(80, defaultBits);
        const first = name === 'mono' ? [9, 6, 9, 8] : [9, 6, 6, 5];
        const next = name === 'mono' ? [9, 6, 9, 9] : [9, 6, 6, 6];
        expect(shape(generate(bits + 0.1))).toEqual(first);
        expect(shape(generate(bits + 5))).toEqual(first);
        expect(shape(generate(bits + 5.1))).toEqual(next);
      });

      it('rejects out-of-range and non-finite entropy', () => {
        for (const entropy of [
          -Infinity,
          -1,
          0,
          40,
          50,
          79,
          79.99,
          1024.01,
          Infinity,
          NaN,
        ]) {
          expect(() => generate(entropy)).toThrow(RangeError);
        }
        for (const entropy of [null, '80', true, {}]) {
          expect(() => generate(entropy as number)).toThrow(RangeError);
        }
      });

      it('alternates growth of the initial trailing pair', () => {
        const tails =
          name === 'mono'
            ? [
                [8, 8],
                [9, 8],
                [9, 9],
                [10, 9],
                [10, 10],
              ]
            : [[10], [6, 5], [6, 6], [7, 6], [7, 7], [8, 7], [8, 8]];
        for (let extra = 0; extra < tails.length; extra++) {
          expect(
            shape(generate(Math.max(80, defaultBits) + extra * 5)),
          ).toEqual([9, 6, ...tails[extra]]);
        }
      });
    });
  }

  it('keeps timestamps independent of entropy', () => {
    for (const entropy of [80, 80.1, 81, 120, 1024]) {
      for (const epoch of [0, 1, 32 ** 9 - 1]) {
        expect(
          jetid.timed.parse(jetid.timed({ epoch, entropy }).toLowerCase()),
        ).toBe(epoch);
      }
    }
    expect(
      jetid.timed.parse(jetid.timed({ entropy: 1024 })),
    ).toBeLessThanOrEqual(Date.now());
  });

  it('preserves ordering and parses fields when entropy changes', () => {
    resetGeneratorState();
    vi.stubGlobal('performance', {
      timeOrigin: 1700000000000,
      now: () => 0.25,
    });
    const ids = [undefined, 80, 1024, 81, 100, 1000, 85].map(
      (entropy, counter) => {
        const id = jetid.mono(entropy);
        // A quarter millisecond is fraction 256, above a 20-bit counter.
        expect(jetid.mono.parse(id.toLowerCase())).toEqual({
          epoch: 1700000000000,
          sequence: 256 * 2 ** 20 + counter,
        });
        return id;
      },
    );
    expect([...ids].sort()).toEqual(ids);
  });

  it('does not advance the mono counter on invalid entropy', () => {
    resetGeneratorState();
    vi.stubGlobal('performance', { timeOrigin: 0, now: () => 0 });
    jetid.mono();
    expect(() => jetid.mono(1025)).toThrow(RangeError);
    // The clock is stuck at fraction 0, so sequence is the counter alone.
    expect(jetid.mono.parse(jetid.mono()).sequence).toBe(1);
  });
});

describe('variable layouts', () => {
  for (const { name, generate, randomStart } of GENERATORS) {
    it(`${name} meets every integer entropy request without surplus characters`, () => {
      const byLength = new Map<number, number[]>();
      for (let entropy = 80; entropy <= 1024; entropy++) {
        const id = generate(entropy);
        const segments = id.split('-');
        const lengths = shape(id);
        expect(lengths.slice(0, 2)).toEqual([9, 6]);
        for (const length of lengths.slice(2)) {
          expect(length).toBeGreaterThanOrEqual(5);
          expect(length).toBeLessThanOrEqual(10);
        }
        const tailChars = segments.slice(2).join('').length;
        // No valid layout can use fewer random characters or fewer dashes.
        expect(segments.length).toBe(2 + Math.ceil(tailChars / 10));
        expect(id.length).toBe(15 + tailChars + 1 + Math.ceil(tailChars / 10));
        const randomChars = segments.slice(randomStart).join('').length;
        expect(randomChars).toBe(
          Math.max(
            (randomStart === 0 ? 15 : randomStart === 1 ? 6 : 0) + 5,
            Math.ceil(entropy / 5),
          ),
        );
        expect(jetid.test(id)).toBe(true);
        expect(jetid.test(id.toLowerCase())).toBe(true);
        expect(id.replaceAll('-', '')).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
        if (byLength.has(id.length))
          expect(lengths).toEqual(byLength.get(id.length));
        byLength.set(id.length, lengths);
      }
      expect(generate(1024)).toHaveLength(
        randomStart === 0 ? 225 : randomStart === 1 ? 235 : 242,
      );
    });
  }

  it('gives mono(125) exactly 25 random characters, 15 beyond the default', () => {
    const randomChars = jetid.mono(125).split('-').slice(2).join('').length;
    expect(randomChars).toBe(25);
    expect(randomChars - 10).toBe(15);
  });

  it('rejects invalid layouts even when their total length is supported', () => {
    const invalid = [
      [9, 6], // at least three segments
      [9, 6, 4], // trailing segment below minimum
      [9, 6, 11], // trailing segment above maximum
      [9, 5, 5, 6], // old plain/timed format
      [9, 6, 8, 8, 9], // old mono format
      [9, 6, 5, 6], // grows the wrong initial segment
      [9, 6, 4, 7],
      [9, 6, 11, 8],
      [9, 6, 8, 8, 3],
      [9, 6, ...new Array<number>(21).fill(10)], // beyond maximum
    ].map((lengths) => lengths.map((length) => '0'.repeat(length)).join('-'));
    for (const id of invalid) {
      expect(jetid.test(id)).toBe(false);
      expect(() => jetid.timed.parse(id)).toThrow(TypeError);
      expect(() => jetid.mono.parse(id)).toThrow(TypeError);
    }
  });

  it('checks every position of the longest supported layout', () => {
    const id = jetid.mono(1024);
    for (let i = 0; i < id.length; i++) {
      for (const replacement of [id[i] === '-' ? '0' : '-', 'I', '\u0100']) {
        const invalid = id.slice(0, i) + replacement + id.slice(i + 1);
        expect(jetid.test(invalid)).toBe(false);
      }
    }
    expect(jetid.test(id + '0')).toBe(false);
  });

  it('stays valid and unique through shared random-pool refills', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      for (const { generate } of GENERATORS) {
        const id = generate([80, 125, 256, 1024][i % 4]);
        expect(jetid.test(id)).toBe(true);
        ids.add(id);
      }
    }
    expect(ids.size).toBe(9000);
  });
});

describe('segment redistribution', () => {
  it.each<[number, number[]]>([
    [80, [8, 8]],
    [85, [9, 8]],
    [90, [9, 9]],
    [95, [10, 9]],
    [100, [10, 10]],
    [105, [10, 6, 5]],
    [110, [10, 6, 6]],
    [115, [10, 7, 6]],
    [120, [10, 7, 7]],
    [125, [10, 8, 7]],
    [130, [10, 8, 8]],
    [135, [10, 9, 8]],
    [140, [10, 9, 9]],
    [145, [10, 10, 9]],
    [150, [10, 10, 10]],
    [155, [10, 10, 6, 5]],
  ])('uses the canonical trailing layout for %i bits', (entropy, tail) => {
    expect(shape(jetid.mono(entropy))).toEqual([9, 6, ...tail]);
    expect(shape(jetid.timed({ epoch: 0, entropy: entropy + 30 }))).toEqual([
      9,
      6,
      ...tail,
    ]);
    expect(shape(jetid(entropy + 75))).toEqual([9, 6, ...tail]);
  });
});

describe('shortest permitted IDs', () => {
  it('shrinks jetid(80) to the minimum 9-6-5 shape', () => {
    for (const entropy of [80, 80.1, 99.9, 100]) {
      const id = jetid(entropy);
      expect(shape(id)).toEqual([9, 6, 5]);
      expect(id).toHaveLength(22);
      expect(jetid.test(id)).toBe(true);
    }
    expect(shape(jetid(100.1))).toEqual([9, 6, 6]);
    expect(shape(jetid(125))).toEqual([9, 6, 10]);
    expect(shape(jetid(125.1))).toEqual([9, 6, 6, 5]);
  });

  it('uses only random characters when sizing timed and mono IDs', () => {
    expect(shape(jetid.timed({ epoch: 0, entropy: 80 }))).toEqual([9, 6, 10]);
    expect(shape(jetid.timed({ epoch: 0, entropy: 80.1 }))).toEqual([
      9, 6, 6, 5,
    ]);
    expect(shape(jetid.mono(80))).toEqual([9, 6, 8, 8]);
    expect(shape(jetid.mono(80.1))).toEqual([9, 6, 9, 8]);
  });
});
