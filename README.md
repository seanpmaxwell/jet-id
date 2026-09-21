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
import jetId from 'jet-id';

jetId(); // '9Q8SWWBTY-7NVXM-FT9S6-XB4R3M'
```

A plain ID contains 25 random Crockford base32 characters, grouped as `9-5-5-6`. Including the three dashes, each ID is 28 characters long.

## Why jet-id?

- **Fast:** Faster than `nanoid()` in the included [benchmarks](#benchmarks).
- **Small:** 6.9 kB packed, with zero runtime dependencies.
- **TypeScript-ready:** Includes type declarations.
- **Portable:** Works in Node.js and modern browsers.
- **Flexible:** Choose random IDs, timestamped IDs, strictly ordered IDs, or secret keys.
- **Strong randomness:** `jetId()` and `jetIdBig()` provide 125 random bits. For comparison, UUID v4 has 122.
- **Simple API:** Generate IDs, validate their format, and extract encoded timestamps with a few functions.

## API

| Generator | Purpose | Length |
|---|---|---:|
| `jetId()` | Random IDs | 28 |
| `jetId.timed()` | IDs sortable by encoded timestamp | 28 |
| `jetIdBig()` | Strictly ordered IDs within one process | 44 |
| `jetKey()` | Random secrets | 52 |

`jetId()` and `jetId.timed()` share the same 28-character format. Use `jetId.test()` to validate either, and `jetId.timed.parse()` to extract the timestamp from a timestamped ID.

`jetIdBig()` and `jetKey()` use different formats and are available as named exports.

## `jetId`

The default export generates random IDs and provides helpers for validation and timestamping.

### `jetId()`

Generates a random 28-character ID. No options are required.

```ts
import jetId from 'jet-id';

jetId(); // '9Q8SWWBTY-7NVXM-FT9S6-XB4R3M'
```

### `jetId.test()`

Checks whether a value is a well-formed ID string. Accepts any value and returns `false` if the format is invalid. Validation is case-insensitive.

```ts
const someId = 'avz6yg1rb-47j6r-xgns9-tqw29a';

jetId.test(someId); // true
jetId.test('not-an-id'); // false
jetId.test(null); // false
```

### `jetId.timed()`

**Signature:** `jetId.timed(epoch?: number): string`

Encodes a timestamp in the first nine characters without changing the ID's overall length. IDs with later timestamps sort after IDs with earlier timestamps. Pass a timestamp in milliseconds, or omit it to use `Date.now()`.

```ts
// Use the current time.
jetId.timed(); // '1KKNTQ2CN-606ZG-8VF48-76B6F3'

// Use a custom timestamp.
const date = new Date(2015, 5, 3);
const timedId = jetId.timed(date.getTime());
```

IDs with the same timestamp are not strictly ordered. Use `jetIdBig()` when you also need ordering within a single millisecond.

### `jetId.timed.parse()`

**Signature:** `jetId.timed.parse(id: unknown): number`

Extracts the epoch timestamp, in milliseconds, from a timestamped ID. Uses the same case-insensitive format validation as `jetId.test()`.

```ts
const epoch = Date.UTC(2015, 5, 3);
const timedId = jetId.timed(epoch);

jetId.timed.parse(timedId); // 1433289600000

new Date(jetId.timed.parse(timedId)).toISOString();
// '2015-06-03T00:00:00.000Z'
```

## `jetIdBig`

Generates timestamped, monotonic IDs: each ID sorts strictly after the previous one, including within a single millisecond. IDs are 44 characters long, with 40 Crockford base32 characters grouped as `9-6-8-8-9`.

### `jetIdBig()`

Generates the next ID.

```ts
import { jetIdBig } from 'jet-id';

jetIdBig(); // '1M308A0DM-PR0000-422PKHWX-THHP6B3G-DPQCJ4GCE'
jetIdBig(); // '1M308A0DM-WR0000-1ZS1A6M5-NE6RKRHN-X9F480HCB'
jetIdBig(); // '1M308A0DM-X50000-XJ1ZENAH-MVX225N0-MZ0BTD8YB'
```

### `jetIdBig.test()`

Checks whether a value is a well-formed `jetIdBig` string. Like `jetId.test()`, it accepts any value and ignores case.

```ts
const someId = '1m308a0dm-pr0000-422pkhwx-thhp6b3g-dpqcj4gce';

jetIdBig.test(someId); // true
jetIdBig.test('not-an-id'); // false
```

### `jetIdBig.parse()`

**Signature:** `jetIdBig.parse(id: unknown): { epoch: number; fraction: number; counter: number }`

Extracts the three encoded ordering fields. Parsing is case-insensitive. An ID that fails `jetIdBig.test()` throws a `TypeError`.

```ts
const someId = '1M30BVB0S-NW0000-B7GWMH34-1XZCBK38-AMHB4D0DW';

jetIdBig.parse(someId);
// { epoch: 1789940050969, fraction: 700, counter: 0 }

const date = new Date(jetIdBig.parse(someId).epoch);
```

The fields returned by `jetIdBig.parse()`:

| Field | Meaning |
|---|---|
| `epoch` | Timestamp in whole milliseconds, encoded in the first segment. Use this field to construct dates. |
| `fraction` | Ordering information encoded in the second segment. |
| `counter` | Additional ordering information encoded in the second segment. |

### Notes

Ordering is guaranteed within one process only. IDs generated by separate processes, workers, or machines are not ordered against each other.

Each time bucket holds 1,048,576 IDs. Exceeding that limit throws a `RangeError` until the clock advances.

> [!NOTE]
> `fraction` and `counter` are ordering fields, not a finer clock. Do not interpret `epoch + fraction / 1024` as a sub-millisecond timestamp.

<details>
<summary>Why is jetIdBig longer?</summary>

Fifteen characters encode ordering information. With the 25-character payload used by `jetId()`, that would leave only 10 characters for randomness.

Using 40 Crockford base32 characters leaves a 25-character random tail, preserving the full 125 random bits of a plain `jetId()`.

The four dashes bring the total length to 44 characters.

</details>

<details>
<summary>Why is there no epoch option?</summary>

`jetIdBig()` maintains ordering against the time it reads itself rather than accepting caller-supplied timestamps.

Time comes from `performance.timeOrigin + performance.now()` instead of `Date.now()`. This provides sub-millisecond resolution and does not jump when the system clock is adjusted.

</details>

## `jetKey`

Generates a 52-character Crockford base32 string with no dashes, suitable for secrets such as API keys or symmetric encryption keys. All 52 characters come from the platform's cryptographically secure random source.

### `jetKey()`

Returns a new key.

```ts
import { jetKey } from 'jet-id';

jetKey(); // 'YFC75GX2KY5W183FRZA4XDVZ6PYDJPQT7JMNH3N7ZXPQ8FCW3M4G'
```

### Notes

Unique IDs are designed for collision resistance, not necessarily secrecy. Use `jetKey()` when generating a secret.

<details>
<summary>Why 52 characters?</summary>

A common target for high-entropy keys is 256 bits.

Each Crockford base32 character carries 5 bits. Fifty-one characters provide 255 bits, so 52 characters are the fewest needed to reach at least 256 bits.

In practice, `jetKey()` draws 260 random bits.

</details>

## Command line

```sh
jet-id                # One random ID.
jet-id -c 10          # Ten random IDs, one per line.
jet-id -t timed       # One timestamped ID.
jet-id -t big -c 10   # Ten strictly increasing IDs.
jet-id --type=key     # One 52-character secret key.
```

### Options

| Flag | Short | Description |
|---|---|---|
| `--help` | `-h` | Show usage. Must be the only argument. |
| `--version` | `-v` | Show the installed version. Must be the only argument. |
| `--count <n>` | `-c` | Number of IDs to print. Defaults to `1`. |
| `--type <type>` | `-t` | Generator to use: `timed`, `big`, or `key`. Omit for plain random IDs. Values are case-insensitive. |

### Generator types

`--type` selects one generator for the invocation.

| Type | Generator | Output | Length |
|---|---|---|---:|
| *(omitted)* | `jetId()` | Random ID | 28 |
| `timed` | `jetId.timed()` | Timestamped ID | 28 |
| `big` | `jetIdBig()` | Strictly ordered ID | 44 |
| `key` | `jetKey()` | Secret key without dashes | 52 |

**Required value:** If you supply `--type` or `-t`, you must provide a value. Supplying the flag alone produces an error.

## Benchmarks

**Environment:** Node v24.13.0 · V8 13.6.233.17-node.37 · darwin/arm64 · Apple M4 Pro

**Method:** Median of 7 samples, at least 500 ms each, after 500 ms of warmup per generator.

| Generator | Characters | Random bits | Median ops/sec | ns/ID | Relative throughput |
|---|---:|---:|---:|---:|---:|
| `jetId()` | 28 | 125 | 81,127,524 | 12.3 | 1.00x |
| `nanoid()` | 21 | 126 | 52,583,004 | 19.0 | 0.65x |
| Nano ID: Crockford, 25 chars | 25 | 125 | 46,942,586 | 21.3 | 0.58x |
| Nano ID: Crockford, 9-5-5-6 | 28 | 125 | 15,589,642 | 64.1 | 0.19x |
| `jetIdBig()` | 44 | 125 | 13,035,960 | 76.7 | 0.16x |
| `uuid.v4()` | 36 | 122 | 8,577,377 | 116.6 | 0.11x |
| `crypto.randomUUID()` | 36 | 122 | 9,964,004 | 100.4 | 0.12x |

## License

[MIT](./LICENSE) © seanpmaxwell
