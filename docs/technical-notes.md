### String Retention

**Memory.** jet-id returns IDs as slices of a shared 7,168-character pool string—typically 7 KiB with one-byte ASCII storage. On engines that share substring storage, retaining generated string objects can keep their entire pool string alive. Once those generated strings are no longer reachable, they no longer keep the pool alive. IDs reconstructed from external storage do not depend on the original pool. Backing-text retention can reach one entire pool per retained ID in the worst case, approaching 28 bytes per ID when most IDs from each chunk are retained, excluding object overhead.

**Randomness.** jet-id provides 125 bits per ID from the platform CSPRNG. IDs are unpredictable, contain no timestamp, and do not sort chronologically. They are suitable as public identifiers and as tokens where 125 bits of entropy meets the requirements.

---
<br/>

### How it differs

**The mechanism is not unique to jet-id, but this particular retention risk is not generally shared by the standard Nano ID and UUIDv4 implementations.** It comes from pooling **finished ID strings**, rather than merely pooling random bytes.

| Implementation | Typical approach | Can one ID retain a string containing many other IDs? |
|---|---|---|
| jet-id | Builds a 256-ID string, then returns substrings | **Yes, depending on the engine** |
| Nano ID | Pools random bytes, constructs each ID separately | Generally no |
| Node’s `crypto.randomUUID()` / typical `uuid` implementations | Format each UUID separately, potentially using cached randomness | Generally no |

Random-byte pooling does not create the same relationship: the returned string does not keep its source random-byte buffer alive. That buffer can be reused independently.

A substring returned by jet-id, however, **may reference the backing storage of the entire 7,168-character chunk**. Moving on to another chunk does not release the old string if an outstanding substring still references it.

---
<br/>


### When that matters

- **All 256 IDs from a chunk are retained:** The backing text is approximately the same amount of text as the individual ID contents combined. Sharing is not inherently wasteful.
- **Only one ID from each chunk is retained:** Each 28-character ID may keep 7,168 characters alive—**256 times its own character storage**, excluding object overhead.
- **No IDs from an old chunk are retained:** Its string becomes eligible for collection once jet-id no longer references it.

This is **not an accumulating memory leak independent of usage**. It is potentially amplified memory retention tied to which generated IDs remain reachable.

JavaScript does not guarantee whether `substring()` copies or shares storage, so this behavior is engine-dependent.

**Bottom line:** this is a tradeoff of jet-id’s multi-ID string-pooling optimization compared with the usual Nano ID/UUID implementations. Other libraries using the same string-pooling technique can share it, but random-byte pooling alone does not cause it.

### To be clear!

**It’s a memory-retention issue, not a collision issue.**

A retained ID may keep its entire chunk’s string storage alive instead of just its own 28 characters. That does **not** reduce randomness, increase collision probability, or change previously returned IDs—JavaScript strings are immutable.

jet-id’s collision resistance remains that of a uniformly random **125-bit identifier**.
