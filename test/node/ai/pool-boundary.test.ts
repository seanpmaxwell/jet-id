import { describe, expect, it, vi } from 'vitest';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Mirrors `generateId.ts`. A chunk is one pool string, and one CSPRNG draw fills
// CHUNKS of them, so ids are handed out across two nested boundaries.
const CHUNK_IDS = 256;
const CHUNKS = 4;
const DRAW_IDS = CHUNK_IDS * CHUNKS; // 1024

const ID_LENGTH = 28;

// Counts that land on, just before and just after each boundary.
const COUNTS = [
  CHUNK_IDS - 1,
  CHUNK_IDS,
  CHUNK_IDS + 1,
  2 * CHUNK_IDS,
  DRAW_IDS - 1,
  DRAW_IDS,
  DRAW_IDS + 1,
  2 * DRAW_IDS,
];

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * A generator with a fresh module state, so each case starts at offset 0 of
 * an unused pool rather than wherever the previous case left off.
 */
async function freshJetId(): Promise<typeof import('@src/index').default> {
  vi.resetModules();
  const mod = await import('@src/index');
  return mod.default;
}

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('pool boundary', () => {
  it.each(COUNTS)('generates exactly %i unique, valid ids', async (count) => {
    const jetId = await freshJetId();

    const ids = new Set<string>();
    for (let i = 0; i < count; i++) {
      ids.add(jetId());
    }

    expect(ids.size).toBe(count);
    for (const id of ids) {
      expect(id).toHaveLength(ID_LENGTH);
      expect(jetId.test(id)).toBe(true);
    }
  });

  it('hands out contiguous ids across a chunk refill', async () => {
    const jetId = await freshJetId();

    // Drain to one id short of the boundary, then straddle it.
    for (let i = 0; i < CHUNK_IDS - 1; i++) {
      jetId();
    }
    const before = jetId(); // last of chunk 0
    const after = jetId(); // first of chunk 1

    expect(jetId.test(before)).toBe(true);
    expect(jetId.test(after)).toBe(true);
    expect(before).not.toBe(after);
  });

  it('stays unique across many consecutive draws', async () => {
    const jetId = await freshJetId();

    const total = 4 * DRAW_IDS;
    const ids = new Set<string>();
    for (let i = 0; i < total; i++) {
      ids.add(jetId());
    }
    expect(ids.size).toBe(total);
  });
});
