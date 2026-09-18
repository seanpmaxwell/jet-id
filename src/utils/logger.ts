// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFn = (...args: any[]) => any;

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Print info. Return content
 */
function info(...args: unknown[]): string {
  callConsoleFn(args, 'info');
  return args.join(' ');
}

/**
 * Print warning
 */
function warn(...args: unknown[]): string {
  callConsoleFn(args, 'warn');
  return args.join(' ');
}

/**
 * Print error
 */
function error(...args: unknown[]): string {
  callConsoleFn(args, 'error');
  return args.join(' ');
}

/**
 * Print an empty line.
 */
function line(): void {
  info('');
}

/**
 * Print the error message from a function expected to throw an error.
 */
function _catch(cb: AnyFn): void {
  try {
    cb();
  } catch (err) {
    if (err instanceof Error) {
      error('Error:', err.message);
      return;
    }
    error(err);
  }
}

// ============================= Shared Helpers ============================ //

/**
 * Wrap the console function so we don't have to disable eslint repeatedly or
 * for the whole file.
 *
 * @private
 */
function callConsoleFn(
  args: unknown[],
  fnKey: 'info' | 'warn' | 'error',
): void {
  // eslint-disable-next-line no-console
  return console[fnKey](...args);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default {
  info,
  warn,
  error,
  line,
  catch: _catch,
} as const;
