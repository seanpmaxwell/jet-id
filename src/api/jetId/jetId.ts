import generateId from './generateId';
import generateTimedId from './generateTimedId';
import parseTimedId from './parseTimedId';
import validateId from './validateId';

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
}

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

const jetId = generateId as jetId;
jetId.timed = generateTimedId as jetId['timed'];
jetId.timed.parse = parseTimedId;
jetId.test = validateId;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetId;
