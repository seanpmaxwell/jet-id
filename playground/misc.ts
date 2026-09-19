import jetId from '@src/index';
import logger from '@src/utils/logger';
import onInit from '@src/utils/onInit';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

onInit.sync(() => {
  // ---- Wrap printing the id and parse result
  for (let i = 0; i < 1000; i++) {
    logger.info(jetId());
  }

  // ---- Wrap printing the id and parse result
  for (let i = 0; i < 100; i++) {
    const id = jetId.timed();
    const parsedId = jetId.parseTimed(id);
    const dateStr = new Date(parsedId).toLocaleString();
    logger.info(dateStr);
  }

  // ---- Test optional timing
  {
    const date = new Date(2015, 5, 3);
    const timedId = jetId.timed(date.getTime());
    logger.info(timedId);

    const parsedId = jetId.parseTimed(timedId);
    const dateStr = new Date(parsedId).toLocaleString();
    logger.info(dateStr);
  }

  // ---- Test key
  {
    for (let i = 0; i < 1000; i++) {
      //
      logger.info(jetId.key());
    }
  }
}, 'playground_basic');
