import generateMonoId from './generateMonoId';
import parseMonoId from './parseMonoId';
import validateMonoId from './validateMonoId';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface jetIdMono {
  (): string;
  test(id: unknown): boolean;
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
