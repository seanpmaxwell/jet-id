import generateId from './generateId';
import generateTimedId from './generateTimedId';
import parseTimedId from './parseTimedId';
import validateId from './validateId';

import jetidMono from './jetid-mono/api';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface jetid {
  (): string;
  test(id: unknown): boolean;
  timed: {
    (epoch?: number): string;
    parse(id: unknown): number;
  };
  mono: jetidMono;
}

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

const jetid = generateId as jetid;
jetid.timed = generateTimedId as jetid['timed'];
jetid.timed.parse = parseTimedId;
jetid.test = validateId;
jetid.mono = jetidMono;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetid;
