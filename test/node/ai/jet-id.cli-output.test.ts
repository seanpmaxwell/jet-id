import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import cli from '@src/cli/cli';
import jetid from '@src/index';

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

// Each `--type` form next to the API call it must reach, so CLI output can be
// compared with what that generator returns for the same entropy.
const TYPES = [
  { label: 'random', args: [], generate: (e?: number) => jetid(e) },
  {
    label: 'timed',
    args: ['-t', 'timed'],
    generate: (e?: number) => jetid.timed({ entropy: e }),
  },
  {
    label: 'mono',
    args: ['-t', 'mono'],
    generate: (e?: number) => jetid.mono(e),
  },
] as const;

/**
 * The length of each dash-separated segment.
 */
function shape(id: string): number[] {
  return id.split('-').map((segment) => segment.length);
}

/**
 * Run the CLI in-process and return the lines it printed.
 */
async function run(args: string[]): Promise<string[]> {
  let text = '';
  const output = new Writable({
    write: (chunk, _encoding, callback) => {
      text += chunk.toString();
      callback();
    },
  });
  await cli(args, output);
  return text.trimEnd().split('\n');
}

/**
 * Run the bundled CLI in a child process and collect what it printed.
 */
async function runProcess(
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [entry, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5000,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  return { code, stdout, stderr };
}

// ---- Bundled CLI
// Built once for the tests that need a real process.
let directory: string;
let entry: string;

beforeAll(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jet-id-cli-'));
  entry = path.join(directory, 'cli.mjs');
  await build({
    entryPoints: ['src/cli/main.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: entry,
  });
});

afterAll(async () => {
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('CLI output', () => {
  it.each([null, 'timed', 'mono'])(
    'waits for a slow reader without losing %s IDs',
    async (type) => {
      const chunks: string[] = [];
      let releaseFirstWrite: () => void = () => {};
      const output = new Writable({
        highWaterMark: 1,
        write: (chunk, _encoding, callback) => {
          chunks.push(chunk.toString());
          if (chunks.length === 1) {
            releaseFirstWrite = callback;
          } else {
            setImmediate(callback);
          }
        },
      });
      const write = vi.spyOn(output, 'write');
      const args = ['-c', '2049', ...(type ? ['-t', type] : [])];
      const pending = cli(args, output);

      try {
        // The first full batch is blocked. No later batch may be queued.
        expect(write).toHaveBeenCalledTimes(1);
        expect(output.writableLength).toBe(Buffer.byteLength(chunks[0]));
      } finally {
        releaseFirstWrite();
      }
      await pending;

      const lines = chunks.join('').trimEnd().split('\n');
      expect(lines).toHaveLength(2049);
      expect(output.writableLength).toBe(0);
      expect(lines.every(jetid.test)).toBe(true);
    },
  );

  it('rejects an output error while waiting for drain', async () => {
    const output = new Writable({
      highWaterMark: 1,
      write: (_chunk, _encoding, callback) => {
        callback(new Error('Output failed'));
      },
    });
    await expect(cli(['-c', '2049'], output)).rejects.toThrow('Output failed');
  });
});

describe('CLI --entropy', () => {
  it.each(TYPES)(
    'passes --entropy to the $label generator',
    async ({ args, generate }) => {
      // Every explicit layout differs from the default 28 characters, and
      // the three generators differ from each other at each of these values,
      // so a matching shape shows both the value and the generator arrived.
      for (const entropy of [80, 81, 256, 1023, 1024]) {
        const lines = await run([...args, '--entropy', String(entropy)]);
        expect(lines, String(entropy)).toHaveLength(1);
        expect(shape(lines[0]), String(entropy)).toEqual(
          shape(generate(entropy)),
        );
        expect(jetid.test(lines[0]), String(entropy)).toBe(true);
      }
    },
  );

  it.each(TYPES)(
    'applies --entropy to every $label id across batches',
    async ({ args, generate }) => {
      // 2049 ids span three write batches.
      const lines = await run(['-c', '2049', '--entropy', '128', ...args]);
      const expected = shape(generate(128));
      expect(lines).toHaveLength(2049);
      expect(new Set(lines).size).toBe(2049);
      for (const id of lines) {
        expect(shape(id)).toEqual(expected);
      }
    },
  );

  it('keeps timed timestamps current with --entropy', async () => {
    const before = Date.now();
    const lines = await run(['-t', 'timed', '-c', '3', '--entropy', '1024']);
    const after = Date.now();
    for (const id of lines) {
      const epoch = jetid.timed.parse(id);
      expect(epoch).toBeGreaterThanOrEqual(before);
      expect(epoch).toBeLessThanOrEqual(after);
    }
  });

  it('keeps mono ids strictly increasing with --entropy', async () => {
    const lines = await run(['-t', 'mono', '-c', '2049', '--entropy', '1024']);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i - 1] < lines[i], String(i)).toBe(true);
    }
  });

  it.each(TYPES)(
    'keeps the default $label shape without --entropy',
    async ({ args }) => {
      const lines = await run(['-c', '3', ...args]);
      expect(lines).toHaveLength(3);
      for (const id of lines) {
        expect(shape(id)).toEqual([9, 6, 5, 5]);
      }
    },
  );

  it('prints nothing for an invalid --entropy', async () => {
    const chunks: string[] = [];
    const output = new Writable({
      write: (chunk, _encoding, callback) => {
        chunks.push(chunk.toString());
        callback();
      },
    });
    await expect(
      cli(['-c', '5', '-t', 'mono', '--entropy', '1025'], output),
    ).rejects.toThrow('received "1025"');
    expect(chunks).toEqual([]);
  });
});

describe('CLI exit status', () => {
  it.each([
    { args: ['--entropy'], message: "--entropy <value>' argument missing" },
    { args: ['--entropy', 'abc'], message: 'received "abc"' },
    { args: ['--entropy', '80.5'], message: 'received "80.5"' },
    { args: ['-e', '79'], message: 'received "79"' },
    { args: ['-t', 'timed', '--entropy=1025'], message: 'received "1025"' },
  ])('exits with 1 for $args', async ({ args, message }) => {
    const { code, stdout, stderr } = await runProcess(args);
    expect(code).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain(message);
  });

  it('exits with 0 for a valid --entropy', async () => {
    const args = ['-t', 'mono', '-c', '3', '--entropy', '80'];
    const { code, stdout, stderr } = await runProcess(args);
    expect(code).toBe(0);
    expect(stderr).toBe('');
    const lines = stdout.trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    for (const id of lines) {
      expect(shape(id)).toEqual(shape(jetid.mono(80)));
    }
  });
});

describe('CLI closed pipes', () => {
  it.each([
    { args: [], closeAfterData: false },
    { args: ['-c', '100000'], closeAfterData: false },
    { args: ['-c', '100000'], closeAfterData: true },
    { args: ['--help'], closeAfterData: false },
    { args: ['--version'], closeAfterData: false },
  ])(
    'exits quietly for $args (close after data: $closeAfterData)',
    async ({ args, closeAfterData }) => {
      const child = spawn(process.execPath, [entry, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
      });
      let errors = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        errors += chunk;
      });
      // Covers both backpressured batches and small writes whose errors
      // arrive after cli() has already returned.
      if (closeAfterData) {
        child.stdout.once('data', () => child.stdout.destroy());
      } else {
        child.stdout.destroy();
      }
      const result = await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code, signal) => resolve({ code, signal }));
      });
      expect(result).toEqual({ code: 0, signal: null });
      expect(errors).toBe('');
    },
  );
});
