import { ALPHABET, PAIRS } from '@Alphabet';

import onSnapshotRestore from './onSnapshotRestore';

import fillBufferWithRandomBytes from './_internal/fillBufferWithRandomBytes';
import { IdLayout } from './_internal/layouts';

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

// One bounded pool serves every variable layout. Caching a pool per entropy
// would retain hundreds of mostly unused chunks. Six characters consume
// 30 independent bits per word; the remaining two bits are discarded.
const bytes = new Uint8Array(4096);
const words = new Uint32Array(bytes.buffer);
let offset = words.length;

onSnapshotRestore(() => {
  offset = words.length;
});

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Write random segments, including a leading dash when the prefix is omitted.
 */
function generateSegments(layout: IdLayout, firstSegment: number): string {
  let result = '';
  let word = 0;
  let bits = 0;
  for (let s = firstSegment; s < layout.segments.length; s++) {
    if (s > 0) result += '-';
    for (let remaining = layout.segments[s]; remaining > 0;) {
      const take = remaining >= 2 ? 10 : 5;
      if (bits < take) {
        if (offset === words.length) {
          fillBufferWithRandomBytes(bytes);
          offset = 0;
        }
        word = words[offset++];
        bits = 30;
      }
      result += take === 10 ? PAIRS[word & 1023] : ALPHABET[word & 31];
      word >>>= take;
      bits -= take;
      remaining -= take / 5;
    }
  }
  return result;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default generateSegments;
