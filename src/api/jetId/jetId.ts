import generateId from './generateId';
import generateTimedId from './generateTimedId';
import parseTimedId from './parseTimedId';
import validateId from './validateId';

import jetIdMono from './jetIdMono/api';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface jetId {
  (): string;
  test(id: unknown): boolean;
  timed: {
    (epoch?: number): string;
    parse(id: unknown): number;
  };
  mono: jetIdMono;
}

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

const jetId = generateId as jetId;
jetId.timed = generateTimedId as jetId['timed'];
jetId.timed.parse = parseTimedId;
jetId.test = validateId;
jetId.mono = jetIdMono;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetId;
