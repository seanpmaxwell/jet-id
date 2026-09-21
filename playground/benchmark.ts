import { randomUUID } from 'crypto';
import { customAlphabet, nanoid } from 'nanoid';
import { cpus } from 'os';
import { performance } from 'perf_hooks';
import { monotonicFactory, ulid } from 'ulid';
import { v4 as uuidv4 } from 'uuid';

import logger from '@src/utils/logger';
import onInit from '@src/utils/onInit';

import jetId, { jetIdBig } from '../src';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const BATCH_SIZE = 16_384;
const WARMUP_MS = 500;
const SAMPLE_MS = 500;

// ULID's monotonic mode is a factory that keeps its own counter, like
// jetIdBig; one instance for the whole run so the comparison is fair.
const ulidMonotonic = monotonicFactory();
const ROUNDS = 7;

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

const nanoidCrockford = customAlphabet(CROCKFORD_ALPHABET, 25);

let checksum = 0;

onInit.sync(() => {
  logger.info('\n Running benchmarks... \n');

  // =============================== Setup ================================= //

  const cases = [
    {
      name: 'jetId()',
      generate: jetId,
      chars: 28,
      bits: 125,
    },
    {
      name: 'jetId.timed()',
      generate: () => jetId.timed(),
      chars: 28,
      bits: 80,
    },
    {
      name: 'nanoid()',
      generate: () => nanoid(),
      chars: 21,
      bits: 126,
    },
    {
      name: 'Nano ID: Crockford, 25 chars',
      generate: () => nanoidCrockford(),
      chars: 25,
      bits: 125,
    },
    {
      name: 'Nano ID: Crockford, 9-5-5-6',
      generate: nanoidFormatted,
      chars: 28,
      bits: 125,
    },
    {
      name: 'jetIdBig',
      generate: () => jetIdBig(),
      chars: 44,
      bits: 125,
    },
    {
      name: 'ulid()',
      generate: () => ulid(),
      chars: 26,
      bits: 80,
    },
    {
      name: 'ulid (monotonic)',
      generate: () => ulidMonotonic(),
      chars: 26,
      bits: 80,
    },
    {
      name: 'uuid v4()',
      generate: () => uuidv4(),
      chars: 36,
      bits: 122,
    },
    {
      name: 'crypto.randomUUID()',
      generate: () => randomUUID(),
      chars: 36,
      bits: 122,
    },
  ].map((entry) => ({ ...entry, samples: [] as number[] }));

  // ============================= Run Tests =============================== //

  // Warm up every generator before collecting measurements.
  for (const entry of cases) {
    measure(entry.generate, WARMUP_MS);
  }

  // Rotate execution order to reduce fixed-order effects.
  for (let round = 0; round < ROUNDS; round++) {
    for (let position = 0; position < cases.length; position++) {
      const entry = cases[(round + position) % cases.length];
      entry.samples.push(measure(entry.generate, SAMPLE_MS));
      // logger.info('Round', round, 'completed ~', entry.name);
    }
  }

  const results = cases.map((entry) => ({
    ...entry,
    ops: median(entry.samples),
  }));

  const baseline = results[0].ops;
  const integer = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  });

  // =========================== Print Results ============================= //

  // ---- Specs
  logger.info('# ID generation benchmark\n');
  logger.info(
    `Node ${process.version}; V8 ${process.versions.v8};`,
    `${process.platform}/${process.arch};`,
    `${cpus()[0]?.model ?? 'Unknown CPU'}\n`,
  );
  logger.info(
    `Median of ${ROUNDS} samples, at least ${SAMPLE_MS} ms each,`,
    `after ${WARMUP_MS} ms warmup per generator.\n`,
  );

  // ---- Print a Markdown-friendly table
  logger.info(
    '| Generator | Characters | Random bits | Median ops/sec | ns/ID | Relative throughput |',
  );
  logger.info('|---|---:|---:|---:|---:|---:|');

  for (const result of results) {
    logger.info(
      `| ${result.name} | ${result.chars} | ${result.bits} |`,
      `${integer.format(result.ops)} |`,
      `${(1e9 / result.ops).toFixed(1)} |`,
      `${(result.ops / baseline).toFixed(2)}x |`,
    );
  }

  // ---- Final Message
  logger.info('\nRelative throughput uses jetId() as 1.00x; higher is faster.');
  logger.info(
    'Measurements include generation and one character read per ID.',
    'ns/ID is amortized time derived from throughput, not individual-call latency.',
  );

  // Keep diagnostic output separate from the Markdown.
  logger.error('Checksum:', checksum);
}, 'benchmarks');

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Use the same format for nanoid
 */
function nanoidFormatted(): string {
  const id = nanoidCrockford();
  return (
    id.slice(0, 9) +
    '-' +
    id.slice(10, 15) +
    '-' +
    id.slice(15, 20) +
    '-' +
    id.slice(26)
  );
}

/**
 * Measure results
 */
function measure(generate: () => string, durationMs: number): number {
  let count = 0;
  let localChecksum = 0;
  const start = performance.now();
  let elapsed: number;
  do {
    for (let i = 0; i < BATCH_SIZE; i++) {
      const id = generate();
      // Consume part of every result rather than discarding it.
      localChecksum = (localChecksum + id.charCodeAt(i % id.length)) | 0;
    }
    count += BATCH_SIZE;
    elapsed = performance.now() - start;
  } while (elapsed < durationMs);
  checksum ^= localChecksum;
  return (count * 1000) / elapsed;
}

/**
 * Get the median result
 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
