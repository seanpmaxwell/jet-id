import { once } from 'events';
import { Writable } from 'stream';

import jetid from '@src/api/jetid';

// esbuild inlines only `version`, so the bundled CLI never reads the file.
import { version } from '../../package.json';

import cmdLineParser, { ParsedCmdLineArgs } from './_internal/cmdLineParser';
import printHelpText from './_internal/printHelpText';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// One generator per `--type` value, each called with the `--entropy` value.
// The plain random id is the default when no type is given, so it is not in
// the table.
const GENERATORS: Record<
  NonNullable<ParsedCmdLineArgs['type']>,
  (entropy?: number) => string
> = {
  mono: jetid.mono,
  timed: (entropy) => jetid.timed({ entropy }),
};

// ========================================================================= //
//                                   EXEC                                    //
// ========================================================================= //

/**
 * Run `jet-id` from the command line.
 */
async function cli(
  args: string[],
  output: Writable = process.stdout,
): Promise<unknown> {
  // ---- Parse the command-line arguments
  const pArgs = cmdLineParser(args);

  // ---- `help/version`
  if (pArgs.help) return printHelpText(output);
  if (pArgs.version) return output.write(`${version}\n`);

  // ---- Print the IDs
  return printIds(pArgs, output);
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Writes are batched. Past a few thousand IDs, a write syscall per line costs
 * far more than generating the ID does.
 *
 * Used by: {@link cli}
 *
 * @private
 */
async function printIds(
  args: ParsedCmdLineArgs,
  output: Writable,
): Promise<void> {
  const { count, entropy } = args;
  let batch = '';
  // Set the function to use
  const generateFn = args.type === null ? jetid : GENERATORS[args.type];
  // Call it by the count number
  for (let i = 0; i < count; i++) {
    batch += generateFn(entropy) + '\n';
    if ((i & 1023) === 1023) {
      if (!output.write(batch) && !(await waitForDrain(output))) return;
      batch = '';
    }
  }
  // Print items.
  if (batch !== '' && !output.write(batch)) {
    await waitForDrain(output);
  }
}

/**
 * Waits for backpressure on `output` to clear, resolving to whether writing
 * may continue.
 *
 * A closed reader (e.g. `head`) surfaces here as an EPIPE instead of a
 * 'drain' event, since `output` errors while this is the only pending
 * operation on it. Swallowing that error and reporting "stop" lets
 * `printIds` return normally, rather than reject and race the top-level
 * `process.stdout` handler in main.ts to decide the exit code.
 *
 * Used by: {@link printIds}
 *
 * @private
 */
async function waitForDrain(output: Writable): Promise<boolean> {
  try {
    await once(output, 'drain');
    return true;
  } catch (err) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'EPIPE'
    ) {
      return false;
    }
    throw err;
  }
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default cli;
