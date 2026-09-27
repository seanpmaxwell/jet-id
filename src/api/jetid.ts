import validateId from '@cmn/utils/validateId';

import jetidMono from './jetIdMono/jetIdMono';
import generateId from './jetIdRaw/generateId';
import jetIdTimed from './jetIdTimed/jetIdTimed';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface jetid {
  (entropy?: number): string;
  test(id: unknown): boolean;
  timed: typeof jetIdTimed;
  mono: jetidMono;
}

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

const jetid = generateId as jetid;
jetid.test = validateId;
jetid.timed = jetIdTimed;
jetid.mono = jetidMono;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetid;
