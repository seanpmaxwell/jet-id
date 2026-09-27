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
      entropy: undefined,
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
      [
        ['--entropy', '128'],
        ['-e', '128'],
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

  it('parses --entropy', () => {
    for (const args of [
      ['--entropy', '256'],
      ['-e', '256'],
      ['--entropy=256'],
    ]) {
      const parsed = cmdLineParser(args);
      expect(parsed.entropy, args.join(' ')).toBe(256);
    }
  });

  it('accepts --entropy from 80 through 1024', () => {
    for (const value of [80, 81, 125, 1023, 1024]) {
      const parsed = cmdLineParser(['--entropy', String(value)]);
      expect(parsed.entropy, String(value)).toBe(value);
    }
  });

  it('rejects --entropy outside 80 to 1024', () => {
    // A leading dash needs the `=` form, or parseArgs reads it as a flag.
    for (const value of ['0', '79', '1025', '100000', '-80']) {
      expect(() => cmdLineParser([`--entropy=${value}`]), value).toThrow(
        'must be an integer from 80 to 1024',
      );
    }
  });

  it('rejects --entropy that is not a whole number', () => {
    // The API rounds fractional bits up, but the flag does not.
    for (const value of [
      '',
      'abc',
      '100bits',
      '80.5',
      '1023.9',
      'NaN',
      'Infinity',
      '-Infinity',
    ]) {
      expect(() => cmdLineParser([`--entropy=${value}`]), value).toThrow(
        'must be an integer from 80 to 1024',
      );
    }
  });

  it('names the received value when --entropy is rejected', () => {
    expect(() => cmdLineParser(['--entropy', '80.5'])).toThrow(
      'received "80.5"',
    );
    expect(() => cmdLineParser(['--entropy', 'abc'])).toThrow('received "abc"');
    // As with `-t=mono`, the short form keeps the `=` in the value.
    expect(() => cmdLineParser(['-e=128'])).toThrow('received "=128"');
  });

  it('requires a value for --entropy', () => {
    // As with `--type`, the next flag must not be read as the value.
    expect(() => cmdLineParser(['--entropy'])).toThrow();
    expect(() => cmdLineParser(['-c', '3', '--entropy'])).toThrow();
    expect(() => cmdLineParser(['--entropy', '-c', '10'])).toThrow();
    expect(() => cmdLineParser(['-e'])).toThrow();
    expect(() => cmdLineParser(['-e', '-c', '10'])).toThrow();
  });

  it('combines --entropy with --type and --count in any order', () => {
    for (const args of [
      ['--entropy', '128', '-t', 'timed', '-c', '3'],
      ['-t', 'timed', '--entropy', '128', '-c', '3'],
      ['-c', '3', '-t', 'timed', '--entropy', '128'],
      ['-t', 'timed', '-e', '128', '-c', '3'],
      ['--type=timed', '--count=3', '--entropy=128'],
    ]) {
      const parsed = cmdLineParser(args);
      expect(parsed, args.join(' ')).toEqual({
        help: false,
        version: false,
        count: 3,
        type: 'timed',
        entropy: 128,
      });
    }
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

  it('requires --help and --version to be the only argument', () => {
    for (const args of [
      ['-c', '2', '--help'],
      ['-c', '2', '--version'],
      ['--help', '-c', '2'],
      ['-v', '-t', 'mono'],
      ['--help', '--entropy', '128'],
      ['--entropy', '128', '--version'],
      ['-e', '128', '-h'],
      ['--help', '--version'],
      ['-hv'],
    ]) {
      expect(() => cmdLineParser(args), args.join(' ')).toThrow(
        'must be the only argument',
      );
    }
    const help = cmdLineParser(['--help']);
    expect(help.help).toBe(true);

    const version = cmdLineParser(['--version']);
    expect(version.version).toBe(true);
  });
});
