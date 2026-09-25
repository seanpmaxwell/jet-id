import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import cli from '@src/cli/cli';
import jetid from '@src/index';

describe('CLI output', () => {
  it.each([null, 'timed', 'mono', 'key'])(
    'waits for a slow reader without losing %s IDs',
    async (type) => {
      const chunks: string[] = [];
      let releaseFirstWrite: () => void = () => {};
      const output = new Writable({
        highWaterMark: 1,
        write(chunk, _encoding, callback) {
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
      const validate =
        type === 'key'
          ? (id: string) => /^[0-9A-HJKMNP-TV-Z]{52}$/.test(id)
          : type === 'mono'
            ? jetid.mono.test
            : jetid.test;
      expect(lines.every(validate)).toBe(true);
    },
  );

  it('rejects an output error while waiting for drain', async () => {
    const output = new Writable({
      highWaterMark: 1,
      write(_chunk, _encoding, callback) {
        callback(new Error('Output failed'));
      },
    });
    await expect(cli(['-c', '2049'], output)).rejects.toThrow('Output failed');
  });
});

describe('CLI closed pipes', () => {
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
      define: { __JET_ID_VERSION__: '"test"' },
    });
  });

  afterAll(async () => {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  });

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
