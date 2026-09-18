import { describe, expect, it } from 'vitest';

import cmdLineParser from '@src/cli/_internal/cmdLineParser';

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

// ---- Defaults
describe('cmdLineParser', () => {
  it('defaults to one random id', () => {
    expect(cmdLineParser([])).toEqual({
      help: false,
      version: false,
      count: 1,
      timed: false,
    });
  });

  it('accepts every flag in long and short form', () => {
    // Each pair must parse the same way, or a short flag is missing or is
    // pointing at the wrong option.
    const pairs: [string[], string[]][] = [
      [['--help'], ['-h']],
      [['--version'], ['-v']],
      [
        ['--count', '5'],
        ['-c', '5'],
      ],
      [['--timed'], ['-t']],
    ];
    for (const [long, short] of pairs) {
      expect(cmdLineParser(short), short.join(' ')).toEqual(
        cmdLineParser(long),
      );
    }
  });

  it('parses --count', () => {
    expect(cmdLineParser(['--count', '5']).count).toBe(5);
    expect(cmdLineParser(['-c', '5']).count).toBe(5);
    expect(cmdLineParser(['--count=5']).count).toBe(5);
  });

  it('parses --timed', () => {
    expect(cmdLineParser(['--timed']).timed).toBe(true);
    expect(cmdLineParser(['-t']).timed).toBe(true);
  });

  it('combines --timed and --count in any order', () => {
    for (const args of [
      ['-t', '-c', '3'],
      ['-c', '3', '-t'],
      ['--count', '3', '--timed'],
      ['-tc', '3'],
    ]) {
      const parsed = cmdLineParser(args);
      expect(parsed.timed, args.join(' ')).toBe(true);
      expect(parsed.count, args.join(' ')).toBe(3);
    }
  });

  it('rejects a count that is not a positive integer', () => {
    for (const value of ['0', '-1', '1.5', 'abc', '']) {
      expect(() => cmdLineParser(['-c', value]), value).toThrow();
    }
  });

  it('rejects an unknown flag', () => {
    expect(() => cmdLineParser(['--nope'])).toThrow();
    expect(() => cmdLineParser(['-z'])).toThrow();
  });

  it('requires --help and --version to come first', () => {
    expect(() => cmdLineParser(['-c', '2', '--help'])).toThrow();
    expect(() => cmdLineParser(['-c', '2', '--version'])).toThrow();
    expect(cmdLineParser(['--help']).help).toBe(true);
    expect(cmdLineParser(['--version']).version).toBe(true);
  });
});
