import logger from 'jet-logger';

import jetid from '@src/index';

import onInit from '../scripts/onInit';

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

// ---- Wrap printing the id and parse result
onInit.sync(() => {
  logger.info(jetid());
  logger.info(jetid(500));
  logger.info(jetid(1024));
}, 'playground_default');

// ---- Print in a loop
onInit.skip(() => {
  for (let i = 0; i < 1000; i++) {
    logger.info(jetid());
  }
}, 'playground_default');

// ---- Wrap printing the id and parse result
onInit.skip(() => {
  for (let i = 0; i < 100; i++) {
    const id = jetid.timed();
    const parsedId = jetid.timed.parse(id);
    const dateStr = new Date(parsedId).toLocaleString();
    logger.info(dateStr);
  }
}, 'playground_timed');

// ---- Test optional timing
onInit.skip(() => {
  const date = new Date(2015, 5, 3);
  const timedId = jetid.timed({ epoch: date.getTime() });
  logger.info(timedId);

  const parsedId = jetid.timed.parse(timedId);
  const dateStr = new Date(parsedId).toLocaleString();
  logger.info(dateStr);
}, 'playground__timed-optional');

// ---- Test monotonic
onInit.skip(() => {
  for (let i = 0; i < 100_000; i++) {
    logger.info(jetid.mono());
  }
}, 'playground__big');
