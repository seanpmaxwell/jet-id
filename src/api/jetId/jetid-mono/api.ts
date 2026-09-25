import generateMonoId from './generateMonoId';
import parseMonoId from './parseMonoId';
import validateMonoId from './validateMonoId';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface jetidMono {
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

const jetidMono = generateMonoId as jetidMono;
jetidMono.test = validateMonoId;
jetidMono.parse = parseMonoId;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetidMono;
