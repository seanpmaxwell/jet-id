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
  timed(epoch?: number): string;
  parseTimed(id: string): number;
}

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

const jetId = generateId as jetId;
jetId.test = validateId;
jetId.timed = generateTimedId;
jetId.parseTimed = parseTimedId;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetId;
