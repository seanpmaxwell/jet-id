import util from 'util';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const ShouldBeFirstSet = new Set(['--help', '-h', '--version', '-v']);
const TypeValuesSet = new Set(['mono', 'timed', 'key']);

const PARSE_ARG_OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  count: { type: 'string', short: 'c' },
  type: { type: 'string', short: 't' },
} as const;

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

// Parsed flags, with a default filled in for anything not passed.
export interface ParsedCmdLineArgs {
  help: boolean;
  version: boolean;
  count: number;
  type: 'mono' | 'timed' | 'key' | null;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Convert the command-line args array to an object. Flags fall into two
 * categories:
 *
 * - Helpers (`--help`, `--version`): run alone and do not generate IDs.
 * - Everything else configures the IDs that get printed.
 */
function cmdLineParser(args: string[]): ParsedCmdLineArgs {
  // Parse the arguments with `util`
  const { values: pArgs } = util.parseArgs({
    args,
    options: PARSE_ARG_OPTIONS,
  });

  // ---- `help`/`version`
  // Validate helpers (`args[0]` may be in the `--flag=value` form)
  const firstFlag = args[0]?.split('=')[0];
  if ((pArgs.help || pArgs.version) && !ShouldBeFirstSet.has(firstFlag)) {
    throw new Error(
      'If specified, the flags [--version,--help] should come first',
    );
  }

  // ---- `count`
  // Validate `count`. Without this, a non-numeric or zero count prints nothing
  // at all, which reads like the command silently did nothing.
  const count = pArgs.count === undefined ? 1 : Number(pArgs.count);
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error(
      `The --count flag must be a positive safe integer: received "${pArgs.count}"`,
    );
  }

  // ---- `type`
  // Validate the type flag
  const respType = pArgs.type === undefined ? null : pArgs.type.toLowerCase();
  if (respType !== null && !TypeValuesSet.has(respType)) {
    // Echo what arrived, not the lower-cased copy: `-t=mono` reaches here
    // as "=mono", and a message quoting only the allowed values would look
    // wrong to someone who did type "mono".
    throw new Error(
      `Value passed to --type (-t) must be mono/timed/key: received "${pArgs.type}"`,
    );
  }

  // ---- Return
  return {
    help: !!pArgs.help,
    version: !!pArgs.version,
    count,
    type: respType as ParsedCmdLineArgs['type'],
  };
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default cmdLineParser;
