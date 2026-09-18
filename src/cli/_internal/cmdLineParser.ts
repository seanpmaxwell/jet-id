import util from 'util';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const ShouldBeFirstSet = new Set(['--help', '-h', '--version', '-v']);

const PARSE_ARG_OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  count: { type: 'string', short: 'c' },
} as const;

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

// Empty strings for falsey arguments
export interface ParsedCmdLineArgs {
  help: boolean;
  version: boolean;
  count: number;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Convert the command line args array to an object: 2 categories.
 *
 * `Helpers`: Run alone and do not fire `jet-id`
 */
function cmdLineParser(args: string[]): ParsedCmdLineArgs {
  // Parse the arguments with `util`
  const { values: pArgs } = util.parseArgs({
    args,
    options: PARSE_ARG_OPTIONS,
  });
  // Validate helpers (`args[0]` may be in the `--flag=value` form)
  const firstFlag = args[0]?.split('=')[0];
  if ((pArgs.help || pArgs.version) && !ShouldBeFirstSet.has(firstFlag)) {
    throw new Error(
      'If specified, the flags [--version,--help] should come first',
    );
  }
  // Validate `count`. Without this a non-numeric or zero count prints nothing
  // at all, which reads like the command silently did nothing.
  const count = pArgs.count === undefined ? 1 : Number(pArgs.count);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(
      `The --count flag must be a positive integer: received "${pArgs.count}"`,
    );
  }
  // Return
  return {
    help: !!pArgs.help,
    version: !!pArgs.version,
    count,
  };
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default cmdLineParser;
