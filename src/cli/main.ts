#!/usr/bin/env node

import cli from './cli';

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

{
  // ---- Safe exit
  // Keep this listener for the process lifetime: a small write can fail after
  // cli() resolves. A closed reader (e.g. `head`) means no more output is
  // wanted.
  process.stdout.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') process.exit(0);
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });

  // ---- Call core logic
  const args = process.argv.slice(2);
  try {
    await cli(args);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  }
}
