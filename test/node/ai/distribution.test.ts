import { describe, expect, it } from 'vitest';

import jetId from '@src/index';

import { ALPHABET, DASH_INDICES, ID_LENGTH } from '@test/_common/constants';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const DASH = '-'.charCodeAt(0);
const SAMPLES = 2_000_000;

// Chi-square over 32 symbols has 31 degrees of freedom. 121.9 is the p = 1e-12
// critical value: a real encoder bug skews a position by orders of magnitude
// more than this, while a healthy CSPRNG will not cross it in practice.
const CHI2_CRITICAL = 121.9;

// ---- Symbol index per ASCII code, -1 for anything not in the alphabet.
const SYMBOL = new Int8Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) {
  SYMBOL[ALPHABET.charCodeAt(i)] = i;
}

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('character distribution', () => {
  // One pass over the sample feeds every assertion below.
  const counts = new Int32Array(ID_LENGTH * ALPHABET.length);
  let misplacedDash = -1; // A dash outside 6/13/21.
  let missingDash = -1; // Something other than a dash at 6/13/21.
  let nonAlphabet = -1; // A character outside the alphabet.
  let wrongLength = -1;

  const isDashIndex = new Uint8Array(ID_LENGTH);
  for (const i of DASH_INDICES) {
    isDashIndex[i] = 1;
  }

  for (let n = 0; n < SAMPLES; n++) {
    const id = jetId();
    if (id.length !== ID_LENGTH && wrongLength < 0) {
      wrongLength = n;
    }
    for (let i = 0; i < ID_LENGTH; i++) {
      const code = id.charCodeAt(i);
      if (isDashIndex[i]) {
        if (code !== DASH && missingDash < 0) {
          missingDash = i;
        }
        continue;
      }
      if (code === DASH) {
        if (misplacedDash < 0) {
          misplacedDash = i;
        }
        continue;
      }
      const symbol = code < 128 ? SYMBOL[code] : -1;
      if (symbol < 0) {
        if (nonAlphabet < 0) {
          nonAlphabet = i;
        }
        continue;
      }
      counts[i * ALPHABET.length + symbol]++;
    }
  }

  // ---- Layout: the assertions a shape test on a handful of IDs would miss
  it(`produces ${SAMPLES.toLocaleString()} ids of the right length`, () => {
    expect(wrongLength).toBe(-1);
  });

  it('never emits a dash outside indices 9, 15 and 21', () => {
    expect(misplacedDash).toBe(-1);
  });

  it('always emits a dash at indices 9, 15 and 21', () => {
    expect(missingDash).toBe(-1);
  });

  it('never emits a character outside the alphabet', () => {
    expect(nonAlphabet).toBe(-1);
  });

  // ---- Uniformity
  it('uses all 32 symbols at every alphabet position', () => {
    for (let i = 0; i < ID_LENGTH; i++) {
      if (isDashIndex[i]) {
        continue;
      }
      const row = counts.subarray(
        i * ALPHABET.length,
        (i + 1) * ALPHABET.length,
      );
      const unused = [...row.keys()].filter((s) => row[s] === 0);
      expect(
        unused,
        `position ${i} never produced ${unused.map((s) => ALPHABET[s]).join('')}`,
      ).toEqual([]);
    }
  });

  it('is uniform per position by chi-square (p = 1e-12)', () => {
    const expected = SAMPLES / ALPHABET.length;
    const worst = { index: -1, chi2: 0 };

    for (let i = 0; i < ID_LENGTH; i++) {
      if (isDashIndex[i]) {
        continue;
      }
      let chi2 = 0;
      for (let s = 0; s < ALPHABET.length; s++) {
        const diff = counts[i * ALPHABET.length + s] - expected;
        chi2 += (diff * diff) / expected;
      }
      if (chi2 > worst.chi2) {
        worst.index = i;
        worst.chi2 = chi2;
      }
    }

    expect(
      worst.chi2,
      `worst position ${worst.index}: chi2 = ${worst.chi2.toFixed(2)} (df 31, critical ${CHI2_CRITICAL})`,
    ).toBeLessThan(CHI2_CRITICAL);
  });
});
