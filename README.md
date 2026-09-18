# jet-id

[![npm](https://img.shields.io/npm/v/jet-id?style=flat-square&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/jet-id)
[![CI](https://img.shields.io/github/actions/workflow/status/seanpmaxwell/jet-id/ci.yml?style=flat-square&logo=github&logoColor=white&label=CI)](https://github.com/seanpmaxwell/jet-id/actions/workflows/ci.yml)
[![types](https://img.shields.io/badge/types-included-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://github.com/seanpmaxwell/jet-id/blob/main/src/index.ts)
[![dependencies](https://img.shields.io/badge/dependencies-0-44cc11?style=flat-square)](https://github.com/seanpmaxwell/jet-id/blob/main/package.json)
[![licence](https://img.shields.io/badge/licence-MIT-blue?style=flat-square)](./LICENSE)

An extremely fast unique ID generator for JavaScript and TypeScript.


## Quick Glance

```ts
import jetId from 'jet-id';

jetId(); // '4963FM-56Q0MB-XAK5YWC-W7B696'
```


## Format

```text
4963FM-56Q0MB-XAK5YWC-W7B696             jet-id   28 chars, 125 random bits
9b2e4c1a-7f3d-4e8b-a6c5-2d1f0e9b8a7c     UUID v4  36 chars, 122 random bits
```

Every ID is 25 random characters from the Crockford base32 alphabet, split into
groups of 6-6-7-6. Shorter than a UUID, with a bit more randomness, and no
`I`, `L`, `O`, or `U` to confuse with `1` and `0`.


## Install

```sh
npm install jet-id
yarn add jet-id
```

## Usage

**Signature:** `jetId(): string`

No arguments, no config, no setup.

```ts
import jetId from 'jet-id';

const requestId = jetId();

const User = {
  public_id: jetId(),
  name: 'Bob',
};
```

`jetId` contains a `.test` function if you need to validate an id. Note that `.test` is not case sensitive.

```ts
const someId = "4963fm-56q0mb-xak5ywc-w7b696"

console.log(jetId.test(someId)) // => true
```

### Command line

You can also run it without installing anything:

```sh
npx jet-id          # prints one ID
npx jet-id -c 5     # prints five, one per line
```

| Flag | Short | What it does |
|---|---|---|
| `--count <n>` | `-c` | How many IDs to print. Defaults to `1`. |
| `--help` | `-h` | Show usage. |
| `--version` | `-v` | Show the installed version. |


## Why jet-id?

- **Fast:** Faster than `nanoid()` [See benchmarks](#benchmarks).
- **Small:** Only **5.5kb** packed 
- **Readable:** Crockford base32 leaves out look-alike characters, so IDs are easy for human eyes.
- **Compact:** 28 characters instead of a UUID's 36.
- **Strong randomness:** 125 random bits, compared with UUID v4's 122.
- **Zero runtime dependencies:**
- **Simple API:** Just `jetId()` and `jetId.test`. No options to figure out.
- **Runs anywhere:** Works in Node.js and modern browsers.


## Benchmarks

Node v24.13.0; V8 13.6.233.17-node.37; darwin/arm64; Apple M4 Pro

Median of 7 samples, at least 500 ms each, after 500 ms warmup per generator.

| Generator | Characters | Random bits | Median ops/sec | ns/ID | Relative throughput |
|---|---:|---:|---:|---:|---:|
| jetId() | 28 | 125 | 83,503,288 | 12.0 | 1.00x |
| nanoid() | 21 | 126 | 52,415,897 | 19.1 | 0.63x |
| Nano ID: Crockford, 25 chars | 25 | 125 | 47,073,761 | 21.2 | 0.56x |
| Nano ID: Crockford, 6-6-7-6 | 28 | 125 | 14,441,127 | 69.2 | 0.17x |
| uuid v4() | 36 | 122 | 8,536,998 | 117.1 | 0.10x |
| crypto.randomUUID() | 36 | 122 | 9,938,321 | 100.6 | 0.12x |

Higher operations/sec is better. Results depend on hardware and runtime.

## License

MIT © seanpmaxwell
