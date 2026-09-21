import generateMonoId from './generateMonoId';
import parseMonoId from './parseMonoId';
import validateMonoId from './validateMonoId';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface jetIdMono {
  (): string;
  test(id: unknown): boolean;
  // Written out here rather than as `typeof parseMonoId`, so the
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

const jetIdMono = generateMonoId as jetIdMono;
jetIdMono.test = validateMonoId;
jetIdMono.parse = parseMonoId;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetIdMono;
