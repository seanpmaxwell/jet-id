// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const HELP_TEXT = `
  jet-id - generate random or timestamped unique ids

  Usage:
    jet-id [options]

  Options:
    -h, --help          Show this help. Must be the only argument.
    -v, --version       Show the version. Must be the only argument.
    -c, --count <n>     How many ids to print (default: 1).
    -t, --timed         Encode the current epoch in the first 9 characters,
                        so the ids sort by creation time.

  Examples:
    jet-id              One random id
    jet-id -c 10        Ten random ids, one per line
    jet-id -t           One timestamped id
    jet-id -t -c 10     Ten timestamped ids`;

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Print the help text above to the command line
 */
function printHelpText(): boolean {
  return process.stdout.write(HELP_TEXT.trim() + '\n');
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default printHelpText;
