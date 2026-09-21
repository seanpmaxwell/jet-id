import generateMonotonicBigId from './generateMonotonicBigId';
import parseMonotonicBigId from './parseMonotonicBigId';
import validateMonotonicBigId from './validateMonotonicBigId';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface jetIdBig {
  (): string;
  test(id: unknown): boolean;
  // Written out here rather than as `typeof parseMonotonicBigId`, so the
  // bundled .d.ts carries no internal function name. The parser declares
  // the same shape; if the two ever drift, the assignment below fails to
  // typecheck.
  parse(id: unknown): {
    epoch: number;
    fraction: number;
    counter: number;
  };
}

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

const jetIdBig = generateMonotonicBigId as jetIdBig;
jetIdBig.test = validateMonotonicBigId;
jetIdBig.parse = parseMonotonicBigId;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetIdBig;
