import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import generateKey from '@src/api/helpers/generateKey';
import jetIdMono from '@src/api/helpers/jetIdMono/jetIdMono';
import jetId from '@src/api/jetId/jetId';

import cmdLineParser, { ParsedCmdLineArgs } from './_internal/cmdLineParser';
import printHelpText from './_internal/printHelpText';

// Injected by esbuild at build time (see scripts/build.ts), so the bundled
// CLI answers `--version` without touching the filesystem. Absent when the
// source runs directly under tsx, where `readVersion` takes over.
declare const __JET_ID_VERSION__: string | undefined;

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const PACKAGE_NAME = 'jet-id';

// One generator per `--type` value. The plain random id is the default when
// no type is given, so it is not in the table.
const GENERATORS: Record<
  NonNullable<ParsedCmdLineArgs['type']>,
  () => string
> = {
  key: generateKey,
  mono: jetIdMono,
  timed: jetId.timed,
};

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

/**
 * Run `jet-id` from the command line.
 */
async function cli(args: string[]): Promise<unknown> {
  // ---- Parse the command-line arguments
  const pArgs = cmdLineParser(args);

  // ---- `help/version`
  if (pArgs.help || pArgs.version) {
    if (args.length !== 1)
      throw new Error(
        'Invalid command-line arguments. Please use the "-h" flag for assistance',
      );
    if (pArgs.help) return printHelpText();
    return printVersion();
  }

  // ---- Print the IDs
  return printIds(pArgs);
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
function printIds(args: ParsedCmdLineArgs): void {
  const { count } = args;
  let batch = '';
  // Set the function to use
  const generateFn = args.type === null ? jetId : GENERATORS[args.type];
  // Call it by the count number
  for (let i = 0; i < count; i++) {
    batch += generateFn() + '\n';
    if ((i & 1023) === 1023) {
      process.stdout.write(batch);
      batch = '';
    }
  }
  // Print items.
  if (batch !== '') {
    process.stdout.write(batch);
  }
}

/**
 * Check if the version is inlined. If not, use package.json.
 *
 * Used by: {@link cli}
 *
 * @private
 */
async function printVersion(): Promise<boolean> {
  let version;
  if (typeof __JET_ID_VERSION__ === 'string') {
    version = __JET_ID_VERSION__;
  } else {
    const thisFilePath = fileURLToPath(import.meta.url);
    const thisFileDir = path.dirname(thisFilePath);
    version = await loadVersionFromPkgJson(thisFileDir);
  }
  return process.stdout.write(`${version}\n`);
}

/**
 * Look at the package.json and return the version. Only reached when the
 * source runs unbundled (the build inlines `__JET_ID_VERSION__` instead).
 * Walks up from the directory this file lives in.
 *
 * Used by: {@link printVersion}
 *
 * @private
 */
async function loadVersionFromPkgJson(startDir: string): Promise<string> {
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
