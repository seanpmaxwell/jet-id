import util from 'util';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const HelperFlagsSet = new Set(['--help', '-h', '--version', '-v']);
const TypeValuesSet = new Set(['mono', 'timed']);

const PARSE_ARG_OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  count: { type: 'string', short: 'c' },
  type: { type: 'string', short: 't' },
  entropy: { type: 'string', short: 'e' },
} as const;

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

// Parsed flags, with a default filled in for anything not passed.
export interface ParsedCmdLineArgs {
  help: boolean;
  version: boolean;
  count: number;
  type: 'mono' | 'timed' | null;
  // `undefined` rather than `null`: it passes straight to the generators,
  // which read it as an omitted entropy and keep their default layout.
  entropy: number | undefined;
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

  // --- `help`/`version` ---
  // Comparing the raw argument also rejects short groups such as `-hv`.
  if (
    (pArgs.help || pArgs.version) &&
    (args.length !== 1 || !HelperFlagsSet.has(args[0]))
  ) {
    throw new Error(
      'The --help (-h) and --version (-v) flags must be the only argument',
    );
  }

  // --- `count` ---
  // Validate `count`. Without this, a non-numeric or zero count prints nothing
  // at all, which reads like the command silently did nothing.
  const count = pArgs.count === undefined ? 1 : Number(pArgs.count);
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error(
      `The --count flag must be a positive safe integer: received "${pArgs.count}"`,
    );
  }

  // --- `type` ---
  // Validate the type flag
  const respType = pArgs.type === undefined ? null : pArgs.type.toLowerCase();
  if (respType !== null && !TypeValuesSet.has(respType)) {
    // Echo what arrived, not the lower-cased copy: `-t=mono` reaches here
    // as "=mono", and a message quoting only the allowed values would look
    // wrong to someone who did type "mono".
    throw new Error(
      `Value passed to --type (-t) must be mono/timed: received "${pArgs.type}"`,
    );
  }

  // --- `entropy` ---
  // The generators accept fractional bits and round them up, but a flag value
  // like "80.5" is more likely a typo than a request, so require an integer.
  // Checking here also fails before any output instead of on the first id.
  const entropy =
    pArgs.entropy === undefined ? undefined : Number(pArgs.entropy);
  if (
    entropy !== undefined &&
    (!Number.isInteger(entropy) || entropy < 80 || entropy > 1024)
  ) {
    throw new Error(
      `The --entropy flag must be an integer from 80 to 1024: received "${pArgs.entropy}"`,
    );
  }

  // --- Return ---
  return {
    help: !!pArgs.help,
    version: !!pArgs.version,
    count,
    type: respType as ParsedCmdLineArgs['type'],
    entropy,
  };
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default cmdLineParser;
