# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [Semantic Versioning](https://semver.org/).

## [2.0.0] - Unreleased

### Breaking

- `jetId.key()` is removed. Use the standalone `jetKey()` export instead; it
  returns the same 52-character Crockford base32 key.
- `jetId.parseTimed(id)` is now `jetId.timed.parse(id)`.
- The CLI's `--timed` and `--key` boolean flags are replaced by a single
  `--type <timed|big|key>` option (`-t`). Omit it for a plain random id.

### Added

- `jetIdBig()`: a timestamped, strictly monotonic id in a 9-6-8-8-9 layout
  (44 characters). IDs sort in generation order even within one millisecond,
  and the random tail keeps the full 125 bits of a plain `jetId()`.
- `jetIdBig.test(value)` and `jetIdBig.parse(id)`, the latter returning
  `{ epoch, fraction, counter }`.
- `jetKey()` as a standalone export.
- `--type big` in the CLI.

### Changed

- `jetId.timed.parse` and `jetIdBig.parse` accept `unknown`, matching
  `test`; anything that fails validation throws a `TypeError`.
- The timestamp encoder and sub-millisecond sequence use precomputed
  character pairs, making `jetIdBig()` about 20% faster.

### Fixed

- `jetKey` now falls back to a UTF-8 `TextDecoder` on runtimes that do not
  register the `latin1` label, as the other generators already did.
- `npm pack` no longer swaps the README destructively; a failed pack leaves
  the working tree intact.

## [1.2.0]

Unpublished development version superseded by 2.0.0.

## [1.1.0]

Last published release before this changelog was started.
