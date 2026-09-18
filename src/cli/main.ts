#!/usr/bin/env node

import logger from '@src/utils/logger';

import cli from './cli';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

main();

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Entry point for the command-line version
 */
async function main(): Promise<unknown> {
  const args = process.argv.slice(2);
  try {
    await cli(args);
  } catch (err) {
    logger.error(err);
    return (process.exitCode = 1);
  }
}
