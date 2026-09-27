import generateTimedId, { TimedIdOptions } from './generateTimedId';
import parseTimedId from './parseTimedId';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface jetidTimed {
  (options?: TimedIdOptions): string;
  parse(id: unknown): number;
}

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

const jetidTimed = generateTimedId as jetidTimed;
jetidTimed.parse = parseTimedId;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetidTimed;
