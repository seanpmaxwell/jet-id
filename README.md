# jet-id

[![npm](https://img.shields.io/npm/v/jet-id?style=flat-square&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/jet-id)
[![CI](https://img.shields.io/github/actions/workflow/status/seanpmaxwell/jet-id/ci.yml?style=flat-square&logo=github&logoColor=white&label=CI)](https://github.com/seanpmaxwell/jet-id/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)

An extremely fast unique ID generator for JavaScript and TypeScript, with optional timestamping and sorting.

## Quick start

```sh
npm install jet-id
```

```ts
import jetid from 'jet-id';

jetid(); // '9Q8SWWBTY-7NVXM-FT9S6-XB4R3M'
```

A plain ID contains 25 random Crockford base32 characters, grouped as `9-5-5-6`. Including the three dashes, each ID is 28 characters long.

<p align="center">· · ·</p>

## Table of Contents

<!-- toc -->

- [Quick start](#quick-start)
- [Why jet-id?](#why-jet-id)
- [API](#api)
- [jetid](#jetid)
  - [`jetid()`](#jetid-1)
  - [`jetid.test()`](#jetidtest)
  - [`jetid.timed()`](#jetidtimed)
  - [`jetid.timed.parse()`](#jetidtimedparse)
- [jetid.mono](#jetidmono)
  - [`jetid.mono()`](#jetidmono-1)
  - [`jetid.mono.test()`](#jetidmonotest)
  - [`jetid.mono.parse()`](#jetidmonoparse)
- [Command line](#command-line)
  - [Options](#options)
  - [Generator types](#generator-types)
- [Benchmarks](#benchmarks)
- [License](#license)

<p align="center">· · ·</p>

<!-- tocstop -->

## Why jet-id?

- **Fast:** Faster than `nanoid()` in the included [benchmarks](#benchmarks).
- **Small:** 6.9 kB packed, with zero runtime dependencies.
- **TypeScript-ready:** Includes type declarations.
- **Portable:** Works in Node.js and modern browsers.
- **Flexible:** Choose random IDs, timestamped IDs, or strictly ordered IDs.
- **Strong randomness:** `jetid()` and `jetid.mono()` provide 125 random bits. For comparison, UUID v4 has 122.
- **Simple API:** Generate IDs, validate their format, and extract encoded timestamps with a few functions.

<p align="center">· · ·</p>

## API

| Generator | Purpose | Length |
|---|---|---:|
| `jetid()` | Random IDs | 28 |
| `jetid.timed()` | IDs sortable by encoded timestamp | 28 |
| `jetid.mono()` | Strictly ordered IDs within one process | 44 |

> `jetid()` and `jetid.timed()` share the same 28-character format. Use `jetid.test()` to validate either, and `jetid.timed.parse()` to extract the timestamp from a timestamped ID.

> `jetid.mono()` uses a different format. Access it through the default `jetid` export.

<p align="center">· · ·</p>

## jetid

The default export generates random IDs and provides helpers for validation, timestamping, and monotonic IDs.

#### `jetid()`

Generates a random 28-character ID. No options are required.

```ts
import jetid from 'jet-id';

jetid(); // '9Q8SWWBTY-7NVXM-FT9S6-XB4R3M'
```

#### `jetid.test()`

Checks whether a value is a well-formed ID string. Accepts any value and returns `false` if the format is invalid. Validation is case-insensitive.

```ts
const someId = 'avz6yg1rb-47j6r-xgns9-tqw29a';

jetid.test(someId); // true
jetid.test('not-an-id'); // false
jetid.test(null); // false
```

#### `jetid.timed()`

**Signature:** `jetid.timed(epoch?: number): string`

Encodes a timestamp in the first nine characters, so IDs sort by creation time under plain string comparison. Those nine characters leave 80 random bits instead of 125. Pass a timestamp in milliseconds, or omit it to use `Date.now()`.

<details>
<summary>.timed vs .mono</summary>

- **You choose the timestamp.** `jetid.mono()` always reads its own clock, so it cannot produce an ID for a record created last year. `jetid.timed(epoch)` can, which is what backfills, data imports, and deterministic tests need.
- **Same layout as a plain ID.** A timed ID is still 28 characters in the same 9-5-5-6 shape, so plain and timestamped IDs share a column and a validator. `jetid.mono()` is a separate 44-character format.
- **Wall-clock time.** It uses `Date.now()`, which follows system clock corrections, so the value means "when this was created." `jetid.mono()` uses `performance.now()`, which deliberately does not, because its job is ordering rather than timekeeping.

</details>

```ts
// Use the current time.
jetid.timed(); // '1KKNTQ2CN-606ZG-8VF48-76B6F3'

// Use a custom timestamp.
const date = new Date(2015, 5, 3);
const timedId = jetid.timed(date.getTime());
```

> IDs with the same timestamp are not strictly ordered. Use `jetid.mono()` when you also need ordering within a single millisecond.

#### `jetid.timed.parse()`

**Signature:** `jetid.timed.parse(id: unknown): number`

Extracts the epoch timestamp, in milliseconds, from a timestamped ID. Uses the same case-insensitive format validation as `jetid.test()`.

```ts
const epoch = Date.UTC(2015, 5, 3);
const timedId = jetid.timed(epoch);

jetid.timed.parse(timedId); // 1433289600000

new Date(jetid.timed.parse(timedId)).toISOString();
// '2015-06-03T00:00:00.000Z'
```

<p align="center">· · ·</p>

## jetid.mono

Generates timestamped, monotonic IDs: each ID sorts strictly after the previous one, including within a single millisecond. IDs are 44 characters long, with 40 Crockford base32 characters grouped as `9-6-8-8-9`.

#### `jetid.mono()`

Generates the next ID.

```ts
import jetid from 'jet-id';

jetid.mono(); // '1M308A0DM-PR0000-422PKHWX-THHP6B3G-DPQCJ4GCE'
jetid.mono(); // '1M308A0DM-WR0000-1ZS1A6M5-NE6RKRHN-X9F480HCB'
jetid.mono(); // '1M308A0DM-X50000-XJ1ZENAH-MVX225N0-MZ0BTD8YB'
```

#### `jetid.mono.test()`

Checks whether a value is a well-formed `jetid.mono` string. Like `jetid.test()`, it accepts any value and ignores case.

```ts
const someId = '1m308a0dm-pr0000-422pkhwx-thhp6b3g-dpqcj4gce';

jetid.mono.test(someId); // true
jetid.mono.test('not-an-id'); // false
```

#### `jetid.mono.parse()`

**Signature:** `jetid.mono.parse(id: unknown): { epoch: number; fraction: number; counter: number }`

Extracts the three encoded ordering fields. Parsing is case-insensitive. An ID that fails `jetid.mono.test()` throws a `TypeError`.

```ts
const someId = '1M30BVB0S-NW0000-B7GWMH34-1XZCBK38-AMHB4D0DW';

jetid.mono.parse(someId);
// { epoch: 1789940050969, fraction: 700, counter: 0 }

const date = new Date(jetid.mono.parse(someId).epoch);
```

The fields returned by `jetid.mono.parse()`:

| Field | Meaning |
|---|---|
| `epoch` | Timestamp in whole milliseconds, encoded in the first segment. Use this field to construct dates. |
| `fraction` | Ordering information encoded in the second segment. |
| `counter` | Additional ordering information encoded in the second segment. |

### Notes

`fraction` and `counter` are ordering fields, not a finer clock. Do not interpret `epoch + fraction / 1024` as a sub-millisecond timestamp.

> [!IMPORTANT]
> Ordering is guaranteed within one process only. IDs generated by separate processes, workers, or machines are not ordered against each other.

<details>
<summary>Why is jetid.mono longer?</summary>

Fifteen characters encode ordering information. With the 25-character payload used by `jetid()`, that would leave only 10 characters for randomness.

Using 40 Crockford base32 characters leaves a 25-character random tail, preserving the full 125 random bits of a plain `jetid()`.

The four dashes bring the total length to 44 characters.

</details>

<details>
<summary>Why is there no epoch option?</summary>

`jetid.mono()` maintains ordering against the time it reads itself rather than accepting caller-supplied timestamps.

Time comes from `performance.timeOrigin + performance.now()` instead of `Date.now()`. This provides sub-millisecond resolution and does not jump when the system clock is adjusted.

</details>

<p align="center">· · ·</p>

## Command line

```sh
jet-id                # One random ID.
jet-id -c 10          # Ten random IDs, one per line.
jet-id -t timed       # One timestamped ID.
jet-id -t mono -c 10  # Ten strictly increasing IDs.
```

### Options

| Flag | Short | Description |
|---|---|---|
| `--help` | `-h` | Show usage. Must be the only argument. |
| `--version` | `-v` | Show the installed version. Must be the only argument. |
| `--count <n>` | `-c` | Number of IDs to print. Defaults to `1`. |
| `--type <type>` | `-t` | Generator to use: `timed` or `mono`. Omit for plain random IDs. Values are case-insensitive. |

### Generator types

`--type` selects one generator for the invocation.

| Type | Generator | Output | Length |
|---|---|---|---:|
| *(omitted)* | `jetid()` | Random ID | 28 |
| `timed` | `jetid.timed()` | Timestamped ID | 28 |
| `mono` | `jetid.mono()` | Strictly ordered ID | 44 |

**Required value:** If you supply `--type` or `-t`, you must provide a value. Supplying the flag alone produces an error.

<p align="center">· · ·</p>

## Benchmarks

**Environment:** Node v24.13.0 · V8 13.6.233.17-node.37 · darwin/arm64 · Apple M4 Pro

**Method:** Median of 7 samples, at least 500 ms each, after 500 ms of warmup per generator.

| Generator | Characters | Random bits | Median ops/sec | ns/ID | Relative throughput |
|---|---:|---:|---:|---:|---:|
| jetid() | 28 | 125 | 81,127,524 | 12.3 | 1.00x |
| nanoid() | 21 | 126 | 51,207,047 | 19.5 | 0.65x |
| Nano ID: Crockford, 25 chars | 25 | 125 | 45,876,959 | 21.8 | 0.58x |
| jetid.timed() | 28 | 80 | 20,841,743 | 48.0 | 0.27x |
| Nano ID: Crockford, 9-5-5-6 | 28 | 125 | 15,110,576 | 66.2 | 0.19x |
| jetid.mono() | 44 | 125 | 12,640,666 | 79.1 | 0.16x |
| crypto.randomUUID() | 36 | 122 | 9,295,197 | 107.6 | 0.12x |
| uuid.v4() | 36 | 122 | 8,075,084 | 123.8 | 0.10x |
| ulid (monotonic) | 26 | 80 | 3,637,167 | 274.9 | 0.05x |
| ulid() | 26 | 80 | 108,505 | 9216.2 | 0.00x |

<p align="center">· · ·</p>

## License

[MIT](./LICENSE) © seanpmaxwell
