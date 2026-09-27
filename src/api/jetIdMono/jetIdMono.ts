import generateMonoId from './generateMonoId';
import parseMonoId from './parseMonoId';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface jetidMono {
  (entropy?: number): string;
  parse(id: unknown): {
    epoch: number;
    sequence: number;
  };
}

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

const jetidMono = generateMonoId as jetidMono;
jetidMono.parse = parseMonoId;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetidMono;
