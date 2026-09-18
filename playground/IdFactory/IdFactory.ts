// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const DASH_CODE = 45; // '-'
const DASH = String.fromCharCode(DASH_CODE);

// Characters produced per refill. The byte count is derived from the
// alphabet's bit width, so tiny alphabets don't waste memory.
const POOL_CHARS = 1024;

// Pools that fit this many IDs store them whole, so each call is one
// substring. Longer IDs are chunked instead, otherwise every refill would
// throw away most of its random data.
const MIN_POOLED_IDS = 4;

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

// Resolve the process object once. A PID change invalidates inherited pooled
// randomness, but snapshots or restores that preserve the PID are not caught.
const PROC =
  typeof process !== 'undefined' && typeof process.pid === 'number'
    ? process
    : null;

// ---- Random source
const fillRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);

// ========================================================================= //
//                                  FACTORY                                  //
// ========================================================================= //

/**
 * Creates a pooled random ID generator.
 *
 * - Segment lengths must be positive safe integers.
 * - The alphabet must contain 2–64 distinct ASCII characters.
 * - Alphabets containing '-' require exactly one segment.
 * - Validation happens only when creating the generator.
 */
function IdFactory(
  segmentLengths: readonly number[],
  alphabet: string,
): () => string {
  // ============================== Validation ============================= //

  const totalLength = validateArgs(segmentLengths, alphabet);

  // Copy the layout so the caller can't mutate it out from under us.
  const segments = segmentLengths.slice();

  // ================================ Layout =============================== //

  const segmentCount = segments.length;
  const dashCount = segmentCount - 1;
  const charsPerId = totalLength - dashCount;

  // ============================== Encoding =============================== //

  const alphabetLength = alphabet.length;
  const powerOfTwo = (alphabetLength & (alphabetLength - 1)) === 0;

  // Power-of-two alphabets use exactly this many bits per character. The rest
  // sample 16 bits per pair and reject, averaging 8 bits per character.
  const bitsPerChar = powerOfTwo ? 31 - Math.clz32(alphabetLength) : 8;
  const charMask = alphabetLength - 1;

  // Bytes needed for POOL_CHARS characters. POOL_CHARS is a multiple of 8, so
  // this divides evenly for every power-of-two alphabet.
  const randomBytes = (POOL_CHARS * bitsPerChar) >>> 3;

  // Random bytes sit at the tail of the character region. Encoders read them
  // front-to-back while writing characters from index 0, starting far enough
  // apart that the writer never catches the reader (see `encodePacked`).
  const randomStart = POOL_CHARS - randomBytes;

  // Single-character codes for the packed encoder.
  const codes = buildCodes(alphabet);

  // Pair table: two ASCII codes per index, first character in the low byte.
  // Only the rejection encoder and the 4-bit path need it.
  const pairCount = alphabetLength * alphabetLength;
  const usesPairs = !powerOfTwo || bitsPerChar === 4;
  const doubleCodes = usesPairs ? buildPairTable(codes) : new Uint16Array(0);

  // Lemire's multiply-shift sampling: multiply a 16-bit sample by pairCount
  // and keep the high 16 bits. Rejecting samples whose low bits fall under
  // this threshold keeps it uniform, and costs no division per sample.
  const rejectBelow = 65_536 % pairCount;

  // ================================= Pool ================================ //

  // How many whole IDs fit in one pool, or 0 when we fall back to chunking.
  const idsPerPool =
    charsPerId * MIN_POOLED_IDS <= POOL_CHARS
      ? (POOL_CHARS / charsPerId) | 0
      : 0;
  const pooled = idsPerPool > 0;
  const minChars = pooled ? charsPerId : 2;

  // Characters live in [0, POOL_CHARS). Whole-ID layout needs extra room for
  // the separators, which get spliced in after encoding.
  const bufferBytes = Math.max(POOL_CHARS, idsPerPool * totalLength);
  const poolBytes = new Uint8Array(bufferBytes);
  const randomView = poolBytes.subarray(randomStart, POOL_CHARS);
  const poolPairs = new Uint16Array(poolBytes.buffer, 0, POOL_CHARS >>> 1);
  const poolWords = new Uint32Array(poolBytes.buffer, 0, POOL_CHARS >>> 2);

  let poolStr = '';
  let poolEnd = 0; // Rejection sampling can leave the pool partly filled.
  let poolOffset = 0;
  let poolOwnerPid = -1;

  // Decode only the bytes we actually filled.
  const decodePool = makeDecodePool(poolBytes);

  // ============================== Functions ============================== //

  /**
   * Whole-ID layout: one substring per call.
   *
   * Used by: {@link IdFactory}
   *
   * @private
   */
  function generatePooled(): string {
    if (
      poolOffset === poolEnd ||
      (PROC !== null && PROC.pid !== poolOwnerPid)
    ) {
      refillPool();
    }
    const start = poolOffset;
    const end = start + totalLength;
    poolOffset = end;
    return poolStr.substring(start, end);
  }

  /**
   * Chunked layout, for IDs too long to pool whole.
   *
   * Used by: {@link IdFactory}
   *
   * @private
   */
  function generateChunked(): string {
    if (PROC !== null && PROC.pid !== poolOwnerPid) {
      refillPool();
    }
    let result = '';
    for (let s = 0; s < segmentCount; s++) {
      if (s > 0) {
        result += DASH;
      }
      let remaining = segments[s];
      do {
        if (poolOffset === poolEnd) {
          refillPool();
        }
        let end = poolOffset + remaining;
        if (end > poolEnd) {
          end = poolEnd;
        }
        result += poolStr.substring(poolOffset, end);
        remaining -= end - poolOffset;
        poolOffset = end;
      } while (remaining > 0);
    }
    return result;
  }

  /**
   * Draws fresh random bytes, encodes them, and in whole-ID layout splices
   * in the separators so the pool holds ready-to-use IDs.
   *
   * Used by:
   *  {@link generatePooled}
   *  {@link generateChunked}
   *
   * @private
   */
  function refillPool(): void {
    let chars: number;
    do {
      fillRandom(randomView);
      chars = encode();
    } while (chars < minChars);

    if (pooled) {
      const ids = (chars / charsPerId) | 0;
      poolEnd = ids * totalLength;
      if (dashCount > 0) {
        insertDashes(ids);
      }
    } else {
      poolEnd = chars;
    }
    poolStr = decodePool(poolEnd);
    poolOffset = 0;
    if (PROC !== null) {
      poolOwnerPid = PROC.pid;
    }
  }

  /**
   * Spreads densely packed IDs out into their separated layout, in place.
   * Runs right-to-left so the writer stays ahead of the reader.
   *
   * Used by: {@link refillPool}
   *
   * @private
   */
  function insertDashes(ids: number): void {
    let src = ids * charsPerId;
    let dst = ids * totalLength;
    for (let id = 0; id < ids; id++) {
      for (let s = dashCount; s >= 0; s--) {
        for (let n = segments[s]; n > 0; n--) {
          poolBytes[--dst] = poolBytes[--src];
        }
        if (s > 0) {
          poolBytes[--dst] = DASH_CODE;
        }
      }
    }
  }

  // ============================== Encoders =============================== //

  const encode: () => number = !powerOfTwo
    ? encodeRejection
    : bitsPerChar === 4
      ? encodeNibbles
      : encodePacked;

  /**
   * Power-of-two alphabets: bit-exact packing, no random data wasted.
   * Encodes in place. Characters can be written faster than bytes are read,
   * but the reader starts at `randomStart`, far enough ahead to stay clear.
   *
   * Used by: {@link refillPool}
   *
   * @private
   */
  function encodePacked(): number {
    let acc = 0;
    let bits = 0;
    let w = 0;
    for (let r = randomStart; r < POOL_CHARS; r++) {
      acc = (acc << 8) | poolBytes[r];
      bits += 8;
      do {
        bits -= bitsPerChar;
        poolBytes[w++] = codes[(acc >>> bits) & charMask];
      } while (bits >= bitsPerChar);
      acc &= (1 << bits) - 1;
    }
    return POOL_CHARS;
  }

  /**
   * 16-character alphabets: every random byte is already a pair index. Here
   * `randomStart` is the halfway mark, so reads always lead writes.
   *
   * Used by: {@link refillPool}
   *
   * @private
   */
  function encodeNibbles(): number {
    for (let i = 0, r = randomStart; r < POOL_CHARS; i++, r++) {
      poolPairs[i] = doubleCodes[poolBytes[r]];
    }
    return POOL_CHARS;
  }

  /**
   * Everything else: one 16-bit sample per pair, rejected and compacted in
   * place. A word yields at most two pairs, so writes never pass the reader.
   *
   * Used by: {@link refillPool}
   *
   * @private
   */
  function encodeRejection(): number {
    let written = 0;
    for (let i = 0, words = POOL_CHARS >>> 2; i < words; i++) {
      const word = poolWords[i];
      const first = (word & 65_535) * pairCount;
      const second = (word >>> 16) * pairCount;
      if ((first & 65_535) >= rejectBelow) {
        poolPairs[written++] = doubleCodes[first >>> 16];
      }
      if ((second & 65_535) >= rejectBelow) {
        poolPairs[written++] = doubleCodes[second >>> 16];
      }
    }
    return written << 1;
  }

  // Return final function
  return pooled ? generatePooled : generateChunked;
}

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

/**
 * Checks the layout and the alphabet, and returns the total ID length.
 *
 * Used by: {@link IdFactory}
 *
 * @private
 */
function validateArgs(
  segmentLengths: readonly number[],
  alphabet: string,
): number {
  if (!Array.isArray(segmentLengths) || segmentLengths.length === 0) {
    throw new TypeError('Expected a non-empty array of segment lengths.');
  }
  // Validate segments
  let totalLength = segmentLengths.length - 1;
  for (const length of segmentLengths) {
    if (!Number.isSafeInteger(length) || length <= 0) {
      throw new RangeError(
        'Each segment length must be a positive safe integer.',
      );
    }
    totalLength += length;
  }
  if (!Number.isSafeInteger(totalLength)) {
    throw new RangeError('The total ID length exceeds the safe integer range.');
  }
  if (typeof alphabet !== 'string') {
    throw new TypeError('The alphabet must be a string.');
  }
  if (alphabet.length < 2 || alphabet.length > 64) {
    throw new RangeError('The alphabet must contain 2-64 characters.');
  }
  for (let i = 0; i < alphabet.length; i++) {
    if (alphabet.charCodeAt(i) > 127) {
      throw new RangeError('The alphabet must contain only ASCII characters.');
    }
  }
  if (new Set(alphabet).size !== alphabet.length) {
    throw new RangeError('The alphabet must not contain duplicate characters.');
  }
  if (segmentLengths.length > 1 && alphabet.includes(DASH)) {
    throw new RangeError(
      'An alphabet containing "-" requires exactly one segment.',
    );
  }
  return totalLength;
}

/**
 * The ASCII code for each alphabet character.
 *
 * Used by: {@link IdFactory}
 *
 * @private
 */
function buildCodes(alphabet: string): Uint8Array<ArrayBuffer> {
  const codes = new Uint8Array(alphabet.length);
  for (let i = 0; i < alphabet.length; i++) {
    codes[i] = alphabet.charCodeAt(i);
  }
  return codes;
}

/**
 * Every two-character combination, packed as a pair of ASCII codes with the
 * first character in the low byte.
 *
 * Used by: {@link IdFactory}
 *
 * @private
 */
function buildPairTable(codes: Uint8Array): Uint16Array<ArrayBuffer> {
  const length = codes.length;
  const table = new Uint16Array(length * length);
  for (let hi = 0; hi < length; hi++) {
    const hiCode = codes[hi];
    for (let lo = 0; lo < length; lo++) {
      table[hi * length + lo] = hiCode | (codes[lo] << 8);
    }
  }
  return table;
}

/**
 * Picks the faster way to read the front of the pool back as a string. Every
 * encoded byte is ASCII, so both paths produce the same text.
 *
 * Used by: {@link IdFactory}
 *
 * @private
 */
function makeDecodePool(
  poolBytes: Uint8Array<ArrayBuffer>,
): (length: number) => string {
  if (typeof Buffer !== 'undefined') {
    const view = Buffer.from(poolBytes.buffer, 0, poolBytes.length);
    return (length) => view.toString('latin1', 0, length);
  }
  const decoder = new TextDecoder('latin1');
  let decodeView = poolBytes;
  return (length) => {
    if (decodeView.length !== length) {
      decodeView = poolBytes.subarray(0, length);
    }
    return decoder.decode(decodeView);
  };
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default IdFactory;
