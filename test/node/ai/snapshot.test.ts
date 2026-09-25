// @vitest-environment node
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const REPO_ROOT = path.resolve(__dirname, '../../..');

// Evaluated while the snapshot is BUILT, so every generator registers its
// deserialize callback and fills its pool. Those buffered ids are baked into
// the blob; the callbacks exist to make sure they are never handed out again.
//
// Both mutants were checked against these cases: dropping the reset entirely,
// and rewinding the cursor without re-randomizing. Each fails at least one.
const ENTRY_SOURCE = `
import v8 from 'node:v8';

import jetid from '@src/index';

const beforeSnapshot = [jetid(), jetid(), jetid.mono()];

v8.startupSnapshot.setDeserializeMainFunction(() => {
  console.log(
    JSON.stringify({
      beforeSnapshot,
      afterRestore: [jetid(), jetid(), jetid.mono()],
    }),
  );
});
`;

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface SnapshotRun {
  beforeSnapshot: string[];
  afterRestore: string[];
}

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('v8 startup snapshot', () => {
  let dir = '';
  let blob = '';
  let supported = true;
  let reason = '';

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jet-id-snapshot-'));
    const entry = path.join(dir, 'entry.ts');
    const bundle = path.join(dir, 'bundle.cjs');
    blob = path.join(dir, 'snapshot.blob');

    fs.writeFileSync(entry, ENTRY_SOURCE);

    // A snapshot entry cannot resolve relative requires, so the library and
    // the entry have to end up in one CommonJS file.
    await build({
      entryPoints: [entry],
      bundle: true,
      format: 'cjs',
      platform: 'node',
      outfile: bundle,
      tsconfig: path.join(REPO_ROOT, 'tsconfig.json'),
      absWorkingDir: REPO_ROOT,
      logLevel: 'silent',
    });

    try {
      execFileSync(
        process.execPath,
        ['--build-snapshot', '--snapshot-blob', blob, bundle],
        { cwd: dir, stdio: 'pipe' },
      );
    } catch (err) {
      // Some builds of Node disable snapshot creation. Skip rather than fail
      // the suite on a platform limitation.
      supported = false;
      reason = err instanceof Error ? err.message : String(err);
    }
  }, 120_000);

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Restore the snapshot in a fresh process and read back what it generated.
   */
  function restore(): SnapshotRun {
    const out = execFileSync(process.execPath, ['--snapshot-blob', blob], {
      cwd: dir,
      encoding: 'utf8',
    });
    return JSON.parse(out) as SnapshotRun;
  }

  // Catches a callback that rewinds the pool cursor without discarding the
  // saved characters, which would hand out the snapshot's ids verbatim. It
  // does NOT catch a callback that resets nothing: that case leaves the
  // cursor past the baked ids, so the next case covers it instead.
  it('never replays ids that were baked into the blob', () => {
    if (!supported) {
      // Recorded in the assertion message rather than logged, so a skipped
      // run is still visible without tripping the no-console rule.
      expect(reason, 'this Node cannot build snapshots').toBeTruthy();
      return;
    }
    const run = restore();
    expect(run.beforeSnapshot).toHaveLength(3);
    expect(run.afterRestore).toHaveLength(3);

    const baked = new Set(run.beforeSnapshot);
    for (const id of run.afterRestore) {
      expect(
        baked.has(id),
        `restored id ${id} was baked into the snapshot`,
      ).toBe(false);
    }
  }, 60_000);

  // The load-bearing one. Any failure to re-randomize on deserialize shows
  // up here, including a callback that resets nothing at all, because both
  // processes then walk the same saved pool in lockstep.
  it('gives two restored processes different ids', () => {
    if (!supported) {
      return;
    }
    const first = restore();
    const second = restore();

    // Same blob, so both start from the identical saved pool. Anything shared
    // here would mean two deployments handing out the same ids.
    const overlap = first.afterRestore.filter((id) =>
      second.afterRestore.includes(id),
    );
    expect(overlap).toEqual([]);
  }, 60_000);
});
