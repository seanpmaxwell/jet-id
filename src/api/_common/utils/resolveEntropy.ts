import { IdLayout, LAYOUTS_BY_TAIL } from './_internal/layouts';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Resolve minimum random bits, subtracting random characters in the prefix.
 */
function resolveEntropy(entropy: number, prefixRandomChars: number): IdLayout {
  if (!Number.isFinite(entropy) || entropy < 80 || entropy > 1024) {
    throw new RangeError(
      'Entropy must be a finite number between 80 and 1024 bits.',
    );
  }
  const next = Math.ceil(entropy / 5) - prefixRandomChars;
  const index = Math.max(5, next);
  return LAYOUTS_BY_TAIL[index];
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default resolveEntropy;
