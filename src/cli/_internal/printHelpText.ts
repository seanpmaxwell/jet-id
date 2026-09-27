import { Writable } from 'stream';

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
                          mono    28 characters, also ordered within a
                                  single millisecond
                        If omitted, a plain random 28-character id is used.
                        The value is required and is case-insensitive.
    -e, --entropy <bits>
                        Minimum random bits per id: an integer from 80 to
                        1024. Ids use the shortest layout that meets it,
                        not the default 28 characters. If omitted, random
                        ids have 125 bits, timed ids 80, and mono ids 50.

  Examples:
    jet-id                    One random id
    jet-id -c 10              Ten random ids, one per line
    jet-id -t timed           One timestamped id
    jet-id -t mono -c 10      Ten ids in strictly increasing order
    jet-id -e 256             One random id with at least 256 random bits`;

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Print the help text above to the command line
 */
function printHelpText(output: Writable): boolean {
  return output.write(HELP_TEXT.trim() + '\n');
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default printHelpText;
