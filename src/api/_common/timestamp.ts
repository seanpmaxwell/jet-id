import { ALPHABET, PAIRS } from './alphabet';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Nine Crockford base32 characters hold 45 bits of milliseconds, which runs
// to the year 3084. Both timestamped formats use this width, so a layout's
// first segment must be TIMESTAMP_CHARS long.
export const TIMESTAMP_CHARS = 9;
export const TIMESTAMP_LIMIT = 32 ** TIMESTAMP_CHARS; // 2^45

// The 45 bits split into a high 30 (six characters, cached because they only
// change every 32,768 ms) and a low 15 (three characters, re-encoded per
// millisecond). Both halves fit in 32-bit integers, which keeps the hot path
// on shifts rather than float division.
const LOW_CHARS = 3;
const LOW_DIVISOR = 32 ** LOW_CHARS; // 32768

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

// ---- Memo
// The encoding is a pure function of the epoch, so this cache is shared by
// every generator and never needs resetting, snapshots included.
let lastEpoch = -1;
let lastTimestamp = '';
let lastHigh = -1;
let lastPrefix = '';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Encodes a millisecond epoch as nine Crockford base32 characters, most
 * significant first and zero-padded.
 *
 * The caller must have checked `epoch` is a safe integer in
 * `[0, TIMESTAMP_LIMIT)`; this does no validation so as to stay off the
 * generators' hot paths.
 */
export function encodeTimestamp(epoch: number): string {
  if (epoch === lastEpoch) {
    return lastTimestamp;
  }
  // high < 2^30 and low < 2^15, so both are safe for 32-bit shifts.
  const high = Math.floor(epoch / LOW_DIVISOR);
  const low = epoch - high * LOW_DIVISOR;

  if (high !== lastHigh) {
    // 30 bits is three 10-bit pairs.
    lastPrefix =
      PAIRS[high >>> 20] + PAIRS[(high >>> 10) & 1023] + PAIRS[high & 1023];
    lastHigh = high;
  }
  // 15 bits is one 10-bit pair and one 5-bit single.
  lastTimestamp = lastPrefix + PAIRS[low >>> 5] + ALPHABET[low & 31];
  lastEpoch = epoch;
  return lastTimestamp;
}
