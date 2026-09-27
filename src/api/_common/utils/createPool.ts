import onSnapshotRestore from './onSnapshotRestore';

import fillBufferWithRandomBytes from './_internal/fillBufferWithRandomBytes';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Each chunk becomes one string that IDs are sliced from. Keeping an ID may
// keep its whole chunk in memory, so chunks stay small.
const CHUNK_IDS = 256;

// One random draw covers several chunks, to make fewer calls. Browsers allow
// at most 65,536 bytes per call; the largest pool draws 16,384.
const CHUNKS = 4;

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

/**
 * Writes one chunk of slots into the pool's `out` words. Slot i's random
 * words start at `random[r + i * randomWordsPerSlot]`, and each slot must
 * read all of them before writing any output word. Writers should read
 * `out` and `random` as module-level constants: V8 compiles those into the
 * loop, whereas passing them as arguments measured about 5% slower.
 */
type ChunkWriter = (r: number) => void;

export interface Pool {
  next(): string;
  reset(): void;
  out: Uint32Array;
  random: Uint32Array;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * A pool of pre-encoded slots, each `slotBytes` wide (a multiple of four),
 * of which `next()` returns the first `length` characters.
 *
 * The buffer holds one chunk of characters followed by random bytes for
 * CHUNKS chunks. Chunk 0's random bytes share the tail of the character
 * area. That's safe because a slot has at least as many output words (W) as
 * random words (R): slot j reads from word 256(W-R) + jR, earlier slots have
 * only written below jW, and jW <= 256(W-R) + jR for every j <= 256.
 */
function createPool(
  slotBytes: number,
  length: number,
  randomWordsPerSlot: number,
  writeChunk: ChunkWriter,
): Pool {
  const chunkBytes = slotBytes * CHUNK_IDS;
  const chunkRandomWords = randomWordsPerSlot * CHUNK_IDS;
  const randomStart = chunkBytes - chunkRandomWords * 4;
  const bytes = new Uint8Array(randomStart + chunkRandomWords * 4 * CHUNKS);
  const out = new Uint32Array(bytes.buffer, 0, chunkBytes >>> 2);
  const randomBytes = bytes.subarray(randomStart);
  const random = new Uint32Array(bytes.buffer, randomStart);
  const decode = createPoolDecoder(bytes.subarray(0, chunkBytes));

  let str = '';
  let offset = chunkBytes; // Start empty; wait until an ID is requested.
  let nextChunk = CHUNKS; // Fetch fresh random bytes on the first refill.

  const refill = (): void => {
    if (nextChunk === CHUNKS) {
      fillBufferWithRandomBytes(randomBytes);
      nextChunk = 0;
    }
    writeChunk(nextChunk++ * chunkRandomWords);
    str = decode();
    offset = 0;
  };

  // Dropping `str` also lets the saved chunk string be collected.
  const reset = (): void => {
    str = '';
    offset = chunkBytes;
    nextChunk = CHUNKS;
  };

  onSnapshotRestore(reset);

  return {
    next: () => {
      if (offset === chunkBytes) refill();
      const start = offset;
      offset = start + slotBytes;
      return str.substring(start, start + length);
    },
    reset,
    out,
    random,
  };
}

/**
 * Returns a function that decodes a pool's character area into a string.
 *
 * The characters are all ASCII, so every path below yields identical text.
 * Buffer's `latin1Slice` is fastest when present, then `toString('latin1')`;
 * without Buffer at all, fall back to TextDecoder.
 *
 * Used by: {@link createPool}
 *
 * @private
 */
function createPoolDecoder(chunkBytes: Uint8Array): () => string {
  const { buffer, byteOffset, length } = chunkBytes;
  if (typeof Buffer !== 'undefined') {
    const view = Buffer.from(buffer, byteOffset, length) as Buffer & {
      latin1Slice?: (start: number, end: number) => string;
    };
    return typeof view.latin1Slice === 'function'
      ? () => view.latin1Slice!(0, length)
      : () => view.toString('latin1');
  }
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder('latin1');
  } catch {
    // Not every runtime registers the latin1 label. The pool is pure
    // ASCII, so UTF-8 decodes to an identical string.
    decoder = new TextDecoder();
  }
  return () => decoder.decode(chunkBytes);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default createPool;
