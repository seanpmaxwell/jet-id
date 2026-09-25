import { describe, expect, it } from 'vitest';

import cmdLineParser from '@src/cli/_internal/cmdLineParser';

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

// ---- Defaults
describe('cmdLineParser', () => {
  it('defaults to one random id', () => {
    const parsed = cmdLineParser([]);
    expect(parsed).toEqual({
      help: false,
      version: false,
      count: 1,
      type: null,
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
      [
        ['--type', 'mono'],
        ['-t', 'mono'],
      ],
    ];
    for (const [long, short] of pairs) {
      const shortParsed = cmdLineParser(short);
      const longParsed = cmdLineParser(long);
      const label = short.join(' ');
      expect(shortParsed, label).toEqual(longParsed);
    }
  });

  it('parses --count', () => {
    for (const args of [['--count', '5'], ['-c', '5'], ['--count=5']]) {
      const parsed = cmdLineParser(args);
      expect(parsed.count, args.join(' ')).toBe(5);
    }
  });

  it('parses every --type value', () => {
    for (const type of ['timed', 'mono'] as const) {
      const forms = [['--type', type], ['-t', type], [`--type=${type}`]];
      for (const args of forms) {
        const parsed = cmdLineParser(args);
        expect(parsed.type, args.join(' ')).toBe(type);
      }
    }
  });

  it('lower-cases the --type value', () => {
    const upper = cmdLineParser(['-t', 'MONO']);
    expect(upper.type).toBe('mono');

    const mixed = cmdLineParser(['-t', 'Timed']);
    expect(mixed.type).toBe('timed');
  });

  it('combines --type and --count in any order', () => {
    for (const args of [
      ['-t', 'mono', '-c', '3'],
      ['-c', '3', '-t', 'mono'],
      ['--count', '3', '--type', 'mono'],
      ['--type=mono', '--count=3'],
    ]) {
      const parsed = cmdLineParser(args);
      expect(parsed.type, args.join(' ')).toBe('mono');
      expect(parsed.count, args.join(' ')).toBe(3);
    }
  });

  it('rejects a --type value it does not know', () => {
    for (const value of ['', 'big', 'jetid', 'monotonic', '1']) {
      expect(() => cmdLineParser(['-t', value]), value).toThrow();
    }
  });

  it('names the received value when --type is rejected', () => {
    // `-t=mono` arrives as "=mono", so a message listing only the allowed
    // values would read as wrong to someone who did type "mono".
    expect(() => cmdLineParser(['-t=mono'])).toThrow('received "=mono"');
    expect(() => cmdLineParser(['-t', 'MONOTONIC'])).toThrow(
      'received "MONOTONIC"',
    );
  });

  it('requires a value for --type', () => {
    // `-t` alone has nothing to consume, and `-t -c` would otherwise read
    // the next flag as the type.
    expect(() => cmdLineParser(['-t'])).toThrow();
    expect(() => cmdLineParser(['-t', '-c', '10'])).toThrow();
  });

  it('rejects a count that is not a positive integer', () => {
    for (const value of ['0', '-1', '1.5', 'abc', '']) {
      expect(() => cmdLineParser(['-c', value]), value).toThrow();
    }
  });

  it('rejects counts outside the safe integer range', () => {
    for (const value of ['9007199254740992', '9007199254740993', '1e100']) {
      expect(() => cmdLineParser(['-c', value]), value).toThrow(
        'positive safe integer',
      );
    }
    expect(cmdLineParser(['-c', String(Number.MAX_SAFE_INTEGER)]).count).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('rejects an unknown flag', () => {
    expect(() => cmdLineParser(['--nope'])).toThrow();
    expect(() => cmdLineParser(['-z'])).toThrow();
  });

  it('rejects the boolean flags this replaced', () => {
    // `--timed` and `--mono` are now `--type` values.
    for (const args of [['--timed'], ['--mono'], ['-m']]) {
      expect(() => cmdLineParser(args), args.join(' ')).toThrow();
    }
  });

  it('requires --help and --version to come first', () => {
    expect(() => cmdLineParser(['-c', '2', '--help'])).toThrow();
    expect(() => cmdLineParser(['-c', '2', '--version'])).toThrow();
    const help = cmdLineParser(['--help']);
    expect(help.help).toBe(true);

    const version = cmdLineParser(['--version']);
    expect(version.version).toBe(true);
  });
});
