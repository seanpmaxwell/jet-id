import jetId from '@src/index';
import logger from '@src/utils/logger';
import onInit from '@src/utils/onInit';

import IdFactory from './IdFactory/IdFactory';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

const CF_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// ================================= Basic ================================= //

await onInit(async () => {
  // Wrap printing the id and parse result
  for (let i = 0; i < 1000; i++) {
    logger.info(jetId());
  }

  // logger.info(customJetId([5, 10, 12, 1]));
  // logger.info(customJetId([60]));
  // logger.info(customJetId([5, 5, 5, 5]));
}, 'playground_basic');

await onInit.skip(async () => {
  const customGen1 = IdFactory([5, 5, 5, 5, 5], CF_ALPHABET);
  for (let i = 0; i < 1000; i++) {
    logger.info(customGen1());
  }

  // logger.info(customJetId([5, 10, 12, 1]));
  // logger.info(customJetId([60]));
  // logger.info(customJetId([5, 5, 5, 5]));
}, 'playground_basic');
