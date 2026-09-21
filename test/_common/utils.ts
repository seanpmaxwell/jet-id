import { expect } from 'vitest';

import { ALPHABET } from './constants';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * A copy of `base` with the character at `index` replaced.
 *
 * `base` is a parameter because each format has its own dummy id. The three
 * copies this replaced were otherwise the same function.
 */
export function swap(base: string, index: number, char: string): string {
  return base.slice(0, index) + char + base.slice(index + 1);
}

/**
 * Reads Crockford base32 characters back into a number.
 *
 * Asserts on any character outside the alphabet, so a decoding bug surfaces
 * where it happens rather than as a puzzling value further down the test.
 */
export function decodeBase32(text: string): number {
  let value = 0;
  for (const character of text) {
    const digit = ALPHABET.indexOf(character);
    expect(digit).not.toBe(-1);
    value = value * 32 + digit;
  }
  return value;
}
