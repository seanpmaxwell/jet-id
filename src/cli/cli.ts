import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import jetId from '@src/api/jetId';

import cmdLineParser, { ParsedCmdLineArgs } from './_internal/cmdLineParser';
import printHelpText from './_internal/printHelpText';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const PACKAGE_NAME = 'jet-id';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

/**
 * Run `jet-id` through the command-line.
 */
async function cli(args: string[]): Promise<unknown> {
  // ---- parse the command-line-arguments
  const pArgs = await cmdLineParser(args);

  // ---- `help/version`
  if (pArgs.help || pArgs.version) {
    if (args.length !== 1)
      throw new Error(
        'Invalid command-line arguments. Please use the "-h" flag for assistance',
      );
    if (pArgs.help) return printHelpText();
    // Version
    const thisFilePath = fileURLToPath(import.meta.url);
    const thisFileDir = path.dirname(thisFilePath);
    const version = await readVersion(thisFileDir);
    return process.stdout.write(`${version}\n`);
  }

  // ---- Print the IDs
  return printIds(pArgs);
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Writes are batched. Past a few thousand ids a write syscall per line costs
 * far more than generating the id does.
 *
 * Used by: {@link cli}
 *
 * @private
 */
function printIds(args: ParsedCmdLineArgs): void {
  const { count } = args;
  let batch = '';
  for (let i = 0; i < count; i++) {
    batch += jetId() + '\n';
    if ((i & 1023) === 1023) {
      process.stdout.write(batch);
      batch = '';
    }
  }
  if (batch !== '') {
    process.stdout.write(batch);
  }
}

/**
 * Look at the package.json and return the version. Walks up from the
 * directory this file lives in, so it works both from the bundled `lib/cli.js`
 * (one level down) and from `src/cli/cli.ts` (two levels down).
 *
 * Used by: {@link cli}
 *
 * @private
 */
async function readVersion(startDir: string): Promise<string> {
  let dir = startDir;
  while (true) {
    const filePath = path.join(dir, 'package.json');
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const packageJson = JSON.parse(content);
      if (packageJson.name === PACKAGE_NAME) return packageJson.version;
    } catch {
      // Not here, keep walking up
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Could not find package.json');
    dir = parent;
  }
}

// ========================================================================= //
//                                   EXPORT                                  //
// ========================================================================= //

export default cli;
