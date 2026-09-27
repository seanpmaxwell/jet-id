import { afterEach, describe, expect, it, vi } from 'vitest';

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

// Walking each source bit detects lost entropy and accidental bit reuse in
// the hand-packed writers, including bits moved across new dash positions.
describe('default pool bit independence', () => {
  afterEach(() => {
    vi.doUnmock('@cmn/utils/_internal/fillBufferWithRandomBytes');
    vi.resetModules();
  });

  it.each([
    { name: 'random', bytesPerId: 16, randomStart: 0, chars: 25 },
    { name: 'timed', bytesPerId: 12, randomStart: 1, chars: 16 },
    { name: 'mono', bytesPerId: 8, randomStart: 2, chars: 10 },
  ])(
    '$name uses five distinct source bits per random character',
    async ({ name, bytesPerId, randomStart, chars }) => {
      let bit = 0;
      vi.resetModules();
      vi.doMock('@cmn/utils/_internal/fillBufferWithRandomBytes', () => ({
        default: (bytes: Uint8Array) => {
          bytes.fill(0);
          for (let offset = 0; offset < bytes.length; offset += bytesPerId) {
            bytes[offset + (bit >>> 3)] = 1 << (bit & 7);
          }
        },
      }));
      const { default: jetid } = await import('@src/index');
      const generate =
        name === 'random'
          ? jetid
          : name === 'timed'
            ? () => jetid.timed({ epoch: 0 })
            : jetid.mono;
      const hits = new Array<number>(chars).fill(0);
      for (bit = 0; bit < bytesPerId * 8; bit++) {
        const random = generate().split('-').slice(randomStart).join('');
        expect(random).toHaveLength(chars);
        let changed = 0;
        for (let c = 0; c < chars; c++) {
          if (random[c] !== '0') {
            hits[c]++;
            changed++;
          }
        }
        expect(changed).toBeLessThanOrEqual(1);
        // Drain the entire four-chunk random batch before changing the bit.
        for (let n = 1; n < 1024; n++) generate();
      }
      expect(hits).toEqual(new Array<number>(chars).fill(5));
    },
  );
});
