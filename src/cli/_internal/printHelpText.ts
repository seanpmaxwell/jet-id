// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const HELP_TEXT = `
  jet-id - generate random, timestamped, or ordered unique ids

  Usage:
    jet-id [options]

  Options:
    -h, --help          Show this help. Must be the only argument.
    -v, --version       Show the version. Must be the only argument.
    -c, --count <n>     How many ids to print (default: 1).
    -t, --type <type>   Which kind of id to print. One of:
                          timed   28 characters, sorts by creation time
                          mono    44 characters, also ordered within a
                                  single millisecond
                          key     52 characters, no dashes, for secrets
                        If omitted, a plain random 28-character id is used.
                        The value is required and is case-insensitive.

  Examples:
    jet-id                    One random id
    jet-id -c 10              Ten random ids, one per line
    jet-id -t timed           One timestamped id
    jet-id -t mono -c 10      Ten ids in strictly increasing order
    jet-id --type=key         One 52-character key`;

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
