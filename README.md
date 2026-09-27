# ✈️ 🪪  &nbsp;&nbsp; jet-id

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

jetid(); // 'DXJK0BT3V-Y567B6-EPJ0K-R27NZ'
```

A plain ID contains 25 random Crockford base32 characters, grouped as `9-6-5-5`. Including the three dashes, each ID is 28 characters long.

<p align="center">* * *</p>

## 📚 Table of Contents

<!-- toc -->

- [Why jet-id?](#-why-jet-id)
- [Entropy](#-entropy)
- [API](#-api)
  - [jetid](#jetid)
  - [jetid.timed](#jetidtimed)
  - [jetid.mono](#jetidmono)
- [Command line](#-command-line)
- [Benchmarks](#-benchmarks)
- [License](#-license)

<p align="center">* * *</p>

<!-- tocstop -->

## ❓ Why jet-id?

- **Fast:** Faster than `nanoid()` in the included [benchmarks](#-benchmarks).
- **Small:** 2.8 kB minified + gzipped, with zero runtime dependencies.
- **TypeScript-ready:** Includes type declarations.
- **Portable:** Works in Node.js and modern browsers.
- **Flexible:** Choose random IDs, timestamped IDs, or strictly ordered IDs.
- **Configurable randomness:** Defaults are 125 random bits for `jetid()`, 80 for `.timed()`, and 50 for `.mono()`.
  - Choose a minimum with the optional entropy parameter. For comparison, UUID v4 has 122.
- **Simple API:** Generate IDs, validate their format, and extract encoded timestamps with a few functions.

<p align="center">* * *</p>

## ✅ API

| Call | Default random bits | What counts as random |
|---|---:|---|
| `jetid(entropy?)` | 125 | Every segment |
| `jetid.timed({ epoch?, entropy? })` | 80 | All but the first segment |
| `jetid.mono(entropy?)` | 50 | All but the first two segments |

> All three generators default to the same 28-character `9-6-5-5` format and accept an optional `entropy` value.

<p align="center">* * *</p>

## 🎆 Entropy

Every generator accepts an optional entropy value (**80–1024 random bits**) and generates the shortest ID that provides at least that many random bits. Omit it to keep the default 28-character `9-6-5-5` layout. Invalid values throw a `RangeError`.

```ts
jetid(80); // '1TNHVSP7A-4VMBKW-2J3SX' — 22 characters, 100 random bits (layout minimum)
jetid.timed({ entropy: 256 }); // current timestamp with at least 256 random bits
```

<details>
<summary>Entropy in detail</summary>

The first two segments are always 9 and 6 characters, so timed and mono IDs keep their timestamp and sequence in the same positions at every length. IDs have at least three segments, and each later segment contains 5–10 characters.

The tail grows from 5 to 10 characters, then expands to `6-5` and grows toward `10-10`. After that, a new segment opens as `10-6-5`, and the pattern repeats. The point of this is to keep each segment length <10 for readability purposes.

The string length generated is the minimum needed to meet the requested entropy using Crockford base32, rather than an exact match to the requested number of bits. Each character contributes five bits, so the result may slightly exceed the target.

```ts
jetid.mono(125); // '1M3GAYGPN-M80000-CMN58V0Y8W-DNP1JJJ2-VT8ENW7'
```

</details>

<p align="center">* * *</p>

## jetid

The default export generates random IDs and provides helpers for validation, timestamping, and monotonic IDs.

##### `jetid(entropy?: number): string`

Generates a random ID with 125 random bits and 28 characters by default. No options are required.

```ts
import jetid from 'jet-id';

jetid(); // 'DXJK0BT3V-Y567B6-EPJ0K-R27NZ'
```

---

##### `jetid.test(id: unknown): boolean`

Checks whether a value is a well-formed random, timed, or mono ID string at any supported length. Accepts any value and returns `false` if the format is invalid. Validation is case-insensitive and checks the shape, not which generator produced the ID.

```ts
const someId = 'dxjk0bt3v-y567b6-epj0k-r27nz';

jetid.test(someId); // true
jetid.test(jetid.timed()); // true
jetid.test(jetid.mono(125)); // true
jetid.test('not-an-id'); // false
jetid.test(null); // false
```

<p align="center">* * *</p>

## jetid.timed

Replaces the first segment with a timestamp encoded as a Crockford string: the current time by default, or `options.epoch`.

##### `jetid.timed(options?: { epoch?: number; entropy?: number }): string`

| Option | Description | Default |
|---|---|---|
| `epoch` | Timestamp in milliseconds, encoded in the first nine characters for chronological sorting | `Date.now()` |
| `entropy` | Minimum random bits (`80`–`1024`) | `80` bits |

```ts
// Use the current time.
jetid.timed(); // '1M3GAYGPN-K2H915-YCGDH-NV04H'

// Specify entropy while using the current time.
jetid.timed({ entropy: 128 });

// Use a custom timestamp.
const date = new Date(2015, 5, 3);
const timedId = jetid.timed({ epoch: date.getTime() });

// Specify both options.
jetid.timed({ epoch: date.getTime(), entropy: 128 });
```

> IDs with the same timestamp are not strictly ordered. Use `jetid.mono()` when you also need ordering within a single millisecond.

---

##### `jetid.timed.parse(id: unknown): number`

Extracts the epoch timestamp, in milliseconds, from a timestamped ID. Uses the same case-insensitive format validation as `jetid.test()`.

```ts
const epoch = Date.UTC(2015, 5, 3);
const timedId = jetid.timed({ epoch });

jetid.timed.parse(timedId); // 1433289600000

const parsedEpoch = jetid.timed.parse(timedId);
new Date(parsedEpoch).toISOString(); // '2015-06-03T00:00:00.000Z'
```

<p align="center">* * *</p>

## jetid.mono

Generates timestamped, monotonic IDs: each ID sorts strictly after the previous one, including within a single millisecond. The first segment is replaced by the epoch (like in `.timed`) and the second segment is replaced by the **sequence**.

##### `jetid.mono(entropy?: number): string`

```ts
import jetid from 'jet-id';

jetid.mono(); // '1M3GAYGPN-3W0000-SDDXN-64QNH'
jetid.mono(); // '1M3GAYGPN-810000-9F3Q4-MD39V'
jetid.mono(); // '1M3GAYGPN-830000-Q9K8W-SKJ2M'
```

> Use `jetid.test(id)` to validate mono IDs, just as for random and timed IDs.

---

##### `jetid.mono.parse(id: unknown): { epoch: number; sequence: number }`

Extracts the two encoded ordering fields. Parsing is case-insensitive. An ID that fails `jetid.test()` throws a `TypeError`.

```ts
const someId = '1M3GAYGPN-3W0000-SDDXN-64QNH';

jetid.mono.parse(someId);
// { epoch: 1790475977429, sequence: 130023424 }

const date = new Date(jetid.mono.parse(someId).epoch);
```

The fields returned by `jetid.mono.parse()`:
- `epoch`: Timestamp in whole milliseconds, encoded in the first segment. Use this field to construct dates.
- `sequence`: Orders IDs created in the same millisecond, encoded in the second segment. A later ID has a higher value.

> `sequence` is an ordering value, not a sub-millisecond timestamp. Do not try to convert it to a time.

---

### Notes

Ordering is guaranteed within one process only. IDs generated by separate processes, workers, or machines are not ordered against each other.

<details>
<summary>Why is there no epoch option?</summary>

`jetid.mono()` maintains ordering against the time it reads itself rather than accepting caller-supplied timestamps.

Time comes from `performance.timeOrigin + performance.now()` instead of `Date.now()`. This provides sub-millisecond resolution and does not jump when the system clock is adjusted.
</details>

<p align="center">* * *</p>

## 📟 Command line

```sh
jet-id                       # One random ID.
jet-id -c 10                 # Ten random IDs, one per line.
jet-id -t timed              # One timestamped ID.
jet-id -t mono -c 10         # Ten strictly increasing IDs.
jet-id -e 256                # One random ID with at least 256 random bits.
jet-id -t timed -c 5 -e 160  # Five timestamped IDs, each with at least 160 random bits.
```

### Options

| Flag | Short | Description |
|---|---|---|
| `--help` | `-h` | Show usage. Must be the only argument. |
| `--version` | `-v` | Show the installed version. Must be the only argument. |
| `--count <n>` | `-c` | Number of IDs to print. Defaults to `1`. |
| `--type <type>` | `-t` | Generator to use: `timed` or `mono`. Omit for plain random IDs. Values are case-insensitive. |
| `--entropy` | `-e` | Minimum random bits per ID: an integer from `80` to `1024`. See [Entropy](#-entropy). |

<p align="center">* * *</p>

## ⚡ Benchmarks

**Environment:** Node v24.13.0 · V8 13.6.233.17-node.37 · darwin/arm64 · Apple M4 Pro

**Method:** Median of 7 samples, at least 500 ms each, after 500 ms of warmup per generator.

| Generator | Characters | Random bits | Median ops/sec | ns/ID | Relative throughput |
|---|---:|---:|---:|---:|---:|
| jetid() | 28 | 125 | 76,764,805 | 13.0 | 1.00x |
| nanoid() | 21 | 126 | 52,279,992 | 19.1 | 0.68x |
| Nano ID: Crockford, 25 chars | 25 | 125 | 46,586,755 | 21.5 | 0.61x |
| jetid.timed() | 28 | 80 | 21,395,323 | 46.7 | 0.28x |
| Nano ID: Crockford, 9-6-5-5 | 28 | 125 | 14,119,532 | 70.8 | 0.18x |
| jetid.mono() | 28 | 50 | 12,732,024 | 78.5 | 0.17x |
| crypto.randomUUID() | 36 | 122 | 9,702,507 | 103.1 | 0.13x |
| uuidv4() | 36 | 122 | 8,357,877 | 119.6 | 0.11x |
| ulid (monotonic) | 26 | 80 | 3,610,672 | 277.0 | 0.05x |
| ulid() | 26 | 80 | 103,419 | 9669.4 | 0.00x |

<p align="center">* * *</p>

## 💳 License

[MIT](./LICENSE) © seanpmaxwell
