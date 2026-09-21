import { Buffer as NodeBuffer } from 'buffer';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { resetGeneratorState } from '@src/api/helpers/jetIdBig/generateMonotonicBigId';
import { jetIdBig } from '@src/index';

import {
  BIG_DASH_INDICES,
  BIG_ID_LENGTH,
  BIG_ID_PATTERN,
  TIMESTAMP_LIMIT,
  VALID_DUMMY_BIG_ID,
} from '@test/_common/constants';
import { decodeBase32, swap } from '@test/_common/utils';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const BASE_EPOCH = 1_700_000_000_000;
const FRACTION_STEPS = 1024;
const COUNTER_LIMIT = 2 ** 20; // 1048576

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

function readId(id: string) {
  expect(id).toHaveLength(BIG_ID_LENGTH);
  expect(id).toMatch(BIG_ID_PATTERN);
  return {
    epoch: decodeBase32(id.slice(0, 9)),
    fraction: decodeBase32(id.slice(10, 12)),
    counter: decodeBase32(id.slice(12, 16)),
  };
}

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('jetIdBig', () => {
  for (const decoder of ['buffer', 'textdecoder'] as const) {
    describe(`${decoder} decoder`, () => {
      let generateMonotonicId: () => string;
      let resetGeneratorState: () => void;

      let origin = BASE_EPOCH;
      let now = 0;

      beforeAll(async () => {
        // Re-evaluate the generator so each suite selects its decoder
        // during module initialization.
        vi.resetModules();

        vi.stubGlobal('Buffer', decoder === 'buffer' ? NodeBuffer : undefined);
        try {
          const module =
            await import('@src/api/helpers/jetIdBig/generateMonotonicBigId');
          generateMonotonicId = module.default;
          resetGeneratorState = module.resetGeneratorState;
        } finally {
          vi.unstubAllGlobals();
        }
      });

      beforeEach(() => {
        origin = BASE_EPOCH;
        now = 0;
        resetGeneratorState();

        // Install after importing to verify that the generator reads
        // the current global clock rather than a captured object.
        vi.stubGlobal('performance', {
          get timeOrigin() {
            return origin;
          },
          now() {
            return now;
          },
        });
      });

      afterEach(() => {
        try {
          resetGeneratorState();
        } finally {
          vi.unstubAllGlobals();
        }
      });

      it('returns a valid id in the 9-6-8-8-9 layout', () => {
        const id = jetIdBig();
        expect(typeof id).toBe('string');
        expect(id).toHaveLength(BIG_ID_LENGTH);
        const segments = id.split('-');
        const lengths = segments.map((segment) => segment.length);
        expect(lengths).toEqual([9, 6, 8, 8, 9]);
      });

      it('carries fractional time into the next millisecond', () => {
        origin = BASE_EPOCH + 0.75;
        now = 0.5;

        const id = generateMonotonicId();
        const parts = readId(id);
        expect(parts).toEqual({
          epoch: BASE_EPOCH + 1,
          fraction: 256,
          counter: 0,
        });
      });

      it('carries across base32 counter characters', () => {
        const expected = new Map<number, string>([
          [31, '00000Z'],
          [32, '000010'],
          [1023, '0000ZZ'],
          [1024, '000100'],
        ]);

        for (let counter = 0; counter <= 1024; counter++) {
          const id = generateMonotonicId();

          if (expected.has(counter)) {
            const sequence = id.slice(10, 16);
            const parts = readId(id);
            expect(sequence).toBe(expected.get(counter));
            expect(parts.counter).toBe(counter);
          }
        }
      });

      it('resets the counter when encoded time advances', () => {
        const first = generateMonotonicId();
        const second = generateMonotonicId();

        const firstParts = readId(first);
        const secondParts = readId(second);
        expect(firstParts.counter).toBe(0);
        expect(secondParts.counter).toBe(1);

        now = 1 / FRACTION_STEPS;
        const third = generateMonotonicId();

        const thirdParts = readId(third);
        expect(thirdParts).toEqual({
          epoch: BASE_EPOCH,
          fraction: 1,
          counter: 0,
        });

        now = 1;
        const fourth = generateMonotonicId();

        const fourthParts = readId(fourth);
        expect(fourthParts).toEqual({
          epoch: BASE_EPOCH + 1,
          fraction: 0,
          counter: 0,
        });

        expect(first < second).toBe(true);
        expect(second < third).toBe(true);
        expect(third < fourth).toBe(true);
      });

      it('preserves ordering when the clock moves backward', () => {
        now = 10.5;
        const first = generateMonotonicId();

        now = 9;
        const second = generateMonotonicId();

        now = 10.25;
        const third = generateMonotonicId();

        now = 10.75;
        const fourth = generateMonotonicId();

        const firstParts = readId(first);
        const secondParts = readId(second);
        const thirdParts = readId(third);
        const fourthParts = readId(fourth);

        expect(firstParts).toEqual({
          epoch: BASE_EPOCH + 10,
          fraction: 512,
          counter: 0,
        });

        expect(secondParts).toEqual({
          epoch: BASE_EPOCH + 10,
          fraction: 512,
          counter: 1,
        });

        expect(thirdParts).toEqual({
          epoch: BASE_EPOCH + 10,
          fraction: 512,
          counter: 2,
        });

        expect(fourthParts).toEqual({
          epoch: BASE_EPOCH + 10,
          fraction: 768,
          counter: 0,
        });

        expect(first < second).toBe(true);
        expect(second < third).toBe(true);
        expect(third < fourth).toBe(true);
      });

      it('crosses character-pool and random-batch boundaries', () => {
        let previous = '';

        // Includes IDs 256/257 and 1024/1025, plus later refills.
        for (let counter = 0; counter < 3000; counter++) {
          const id = generateMonotonicId();

          const parts = readId(id);
          expect(parts).toEqual({
            epoch: BASE_EPOCH,
            fraction: 0,
            counter,
          });

          if (counter > 0) {
            expect(id > previous).toBe(true);
          }

          previous = id;
        }
      });

      it('throws on exhaustion and recovers in a later bucket', () => {
        let lastId = '';

        for (let i = 0; i < COUNTER_LIMIT; i++) {
          lastId = generateMonotonicId();
        }

        const lastParts = readId(lastId);
        expect(lastParts.counter).toBe(COUNTER_LIMIT - 1);

        expect(() => generateMonotonicId()).toThrow(/Counter exhausted/);
        expect(() => generateMonotonicId()).toThrow(/Counter exhausted/);

        now = 1 / FRACTION_STEPS;
        const recovered = generateMonotonicId();

        const recoveredParts = readId(recovered);
        expect(recoveredParts).toEqual({
          epoch: BASE_EPOCH,
          fraction: 1,
          counter: 0,
        });

        expect(recovered > lastId).toBe(true);

        const nextId = generateMonotonicId();
        const nextParts = readId(nextId);
        expect(nextParts.counter).toBe(1);
      });

      it('starts a new sequence after reset', () => {
        generateMonotonicId();
        const secondId = generateMonotonicId();
        const secondParts = readId(secondId);
        expect(secondParts.counter).toBe(1);

        resetGeneratorState();

        const freshId = generateMonotonicId();
        const freshParts = readId(freshId);
        expect(freshParts).toEqual({
          epoch: BASE_EPOCH,
          fraction: 0,
          counter: 0,
        });
      });
    });
  }
});

// ---- `jetIdBig.parse`
describe('ai -> jetIdBig.parse', () => {
  beforeEach(resetGeneratorState);

  it('agrees with the current clock', () => {
    const id = jetIdBig();
    const { epoch } = jetIdBig.parse(id);
    const drift = Math.abs(epoch - Date.now());
    expect(drift).toBeLessThan(1_000);
  });

  it('bumps the counter when two ids share a time bucket', () => {
    // Generate the whole burst first. Parsing between calls slows the loop
    // past the ~1us bucket width, and then no two ids ever share a bucket.
    const ids: string[] = [];
    for (let i = 0; i < 5_000; i++) {
      ids.push(jetIdBig());
    }

    let shared = 0;
    let previous = jetIdBig.parse(ids[0]);
    for (let i = 1; i < ids.length; i++) {
      const current = jetIdBig.parse(ids[i]);
      if (
        current.epoch === previous.epoch &&
        current.fraction === previous.fraction
      ) {
        expect(current.counter, `id ${i}`).toBe(previous.counter + 1);
        shared++;
      } else {
        expect(current.counter, `id ${i}`).toBe(0);
      }
      previous = current;
    }
    expect(shared).toBeGreaterThan(0);
  });

  it('decodes the full 45-bit range', () => {
    for (const epoch of [0, 1, 1_433_314_800_000, TIMESTAMP_LIMIT - 1]) {
      // Build an id around a known timestamp; only segment one is read.
      let remaining = epoch;
      let stamp = '';
      for (let i = 0; i < 9; i++) {
        stamp = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[remaining % 32] + stamp;
        remaining = Math.floor(remaining / 32);
      }
      const id = stamp + VALID_DUMMY_BIG_ID.slice(9);
      const parsed = jetIdBig.parse(id);
      expect(parsed.epoch, `epoch ${epoch}`).toBe(epoch);
    }
  });

  it('reads the epoch from segment one alone', () => {
    // Built by hand rather than from two generated ids, which could land
    // either side of a millisecond boundary and make this flaky.
    const { epoch } = jetIdBig.parse(VALID_DUMMY_BIG_ID);
    for (let i = 10; i < BIG_ID_LENGTH; i++) {
      if (BIG_DASH_INDICES.includes(i)) {
        continue;
      }
      const altered = swap(
        VALID_DUMMY_BIG_ID,
        i,
        VALID_DUMMY_BIG_ID[i] === 'Z' ? 'Y' : 'Z',
      );
      const parsed = jetIdBig.parse(altered);
      expect(altered).not.toBe(VALID_DUMMY_BIG_ID);
      expect(parsed.epoch, `index ${i}`).toBe(epoch);
    }
  });

  it('reads the sequence from segment two alone', () => {
    const { fraction, counter } = jetIdBig.parse(VALID_DUMMY_BIG_ID);
    // Changing a random character must not disturb either field.
    for (let i = 17; i < BIG_ID_LENGTH; i++) {
      if (BIG_DASH_INDICES.includes(i)) {
        continue;
      }
      const altered = swap(
        VALID_DUMMY_BIG_ID,
        i,
        VALID_DUMMY_BIG_ID[i] === 'Z' ? 'Y' : 'Z',
      );
      const parsed = jetIdBig.parse(altered);
      expect(parsed, `index ${i}`).toMatchObject({ fraction, counter });
    }
  });
});
