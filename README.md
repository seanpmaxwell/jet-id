# jet-id

[![npm](https://img.shields.io/npm/v/jet-id?style=flat-square&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/jet-id)
[![CI](https://img.shields.io/github/actions/workflow/status/seanpmaxwell/jet-id/ci.yml?style=flat-square&logo=github&logoColor=white&label=CI)](https://github.com/seanpmaxwell/jet-id/actions/workflows/ci.yml)
[![types](https://img.shields.io/badge/types-included-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://github.com/seanpmaxwell/jet-id/blob/main/src/index.ts)
[![dependencies](https://img.shields.io/badge/dependencies-0-44cc11?style=flat-square)](https://github.com/seanpmaxwell/jet-id/blob/main/package.json)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)

An extremely fast unique ID generator for JavaScript and TypeScript, with optional sorting/timestamping.


## Quick Glance

```ts
import jetId from 'jet-id';

jetId(); // '9Q8SWWBTY-7NVXM-FT9S6-XB4R3M'
```

> Every ID is 25 random characters from the Crockford base32 alphabet, split into groups of 9-5-5-6.

## Why jet-id?

- **Main features**
  - **Optionally timestamped and readable:** Generated IDs are 28-character strings (25 Crockford characters plus 3 dashes). The first segment is 9 characters; if you want a timestamp, the first segment encodes the current epoch in Crockford form, so the ID length stays the same.
  - **Fast:** Faster than `nanoid()`. [See benchmarks](#benchmarks).

- **Other perks**
  - **Small:** Only **6.4 kB** packed.
  - **Strong randomness:** 125 random bits. For perspective, UUID v4 has 122.
  - **Zero runtime dependencies.**
  - **Simple API:** Just `jetId()` and `jetId.test`/`jetId.timed`/`jetId.parseTimed`.
  - **Universal:** Works in Node.js and modern browsers.

## Install

```sh
npm install jet-id
```

## API

### Basic usage

Just call the default import, there are no options to pass:

```ts
import jetId from 'jet-id';

jetId(); // '9Q8SWWBTY-7NVXM-FT9S6-XB4R3M'
```

### Validation

`jetId` contains a `.test` function if you need to validate an ID. Note that `.test` is not case-sensitive.

```ts
const someId = 'avz6yg1rb-47j6r-xgns9-tqw29a';

console.log(jetId.test(someId)); // => true
```

### Timestamped/Sortable IDs

`jetId.timed(epoch?: number): string` encodes the current time in the first nine characters, so IDs created later sort after ones created earlier.

You can pass your own timestamp in milliseconds; otherwise it defaults to `Date.now()`:

```ts
// Default, uses Date.now()
jetId.timed(); // '1KKNTQ2CN-606ZG-8VF48-76B6F3'

// Custom timestamp
const date = new Date(2015, 5, 3);
const timedId = jetId.timed(date.getTime());
logger.info(timedId); // "19PW3GCC0..."
```

If an id has been timestamped, you can extract the epoch with `jetId.parseTimed(id: string): number`. This will use the validation function above so parsing is not case-sensitive.

```
// Parse timed id
const parsedId = jetId.parseTimed(timedId);
const dateStr = new Date(parsedId).toLocaleString();
logger.info(dateStr); // "6/3/2015 ..."
```

### Key

The `.key` function prints a 52-character Crockford string which is suitable for using as a private-key for security encryption. Note that unique-IDs are about collision resistance not security necessarily. 

Why 52 characters? Because 256 bits of entropy is considered the gold-standard for making an encryption-key forever safe against brute-force attacks. 52 is how many characters are need to provide 256 bits of entropy using the Crockford alphabet.

```ts
  jetId.key() // 'YS7T70GGWC7Z1EX765FZ22M9FNDFA2VDF6KEET5P4P7YEBETBGVN'
```


## Command line

| Flag | Short | What it does |
|---|---|---|
| `--count <n>` | `-c` | How many IDs to print. Defaults to `1`. |
| `--timed` | `-t` | Encode the current epoch in the first 9 characters, so the IDs sort by creation time. |
| `--key` | `-k` | Print a 52 character non-segmented Crockford string |
| `--help` | `-h` | Show usage. |
| `--version` | `-v` | Show the installed version. |


## Benchmarks

Node v24.13.0; V8 13.6.233.17-node.37; darwin/arm64; Apple M4 Pro

Median of 7 samples, at least 500 ms each, after a 500 ms warmup per generator.

| Generator | Characters | Random bits | Median ops/sec | ns/ID | Relative throughput |
|---|---:|---:|---:|---:|---:|
| jetId() | 28 | 125 | 83,503,288 | 12.0 | 1.00x |
| nanoid() | 21 | 126 | 52,415,897 | 19.1 | 0.63x |
| Nano ID: Crockford, 25 chars | 25 | 125 | 47,073,761 | 21.2 | 0.56x |
| Nano ID: Crockford, 9-5-5-6 | 28 | 125 | 14,441,127 | 69.2 | 0.17x |
| uuid v4() | 36 | 122 | 8,536,998 | 117.1 | 0.10x |
| crypto.randomUUID() | 36 | 122 | 9,938,321 | 100.6 | 0.12x |


## License

MIT © seanpmaxwell
