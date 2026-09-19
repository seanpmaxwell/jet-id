import generateId from './generateId';
import generateKey from './generateKey';
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
  key(): string;
}

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

const jetId = generateId as jetId;
jetId.test = validateId;
jetId.timed = generateTimedId;
jetId.parseTimed = parseTimedId;
jetId.key = generateKey;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default jetId;
