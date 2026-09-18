## `IdFactory`

Want to have fun playing around with different lengths, grouping, or alphabets? `IdFactory` builds a generator for it. Set it up once, then call it like `jetId()`.

**Signature:** `IdFactory(segments: number[], alphabet: string): () => string`

```ts
import { IdFactory } from 'jet-id';

const shortId = IdFactory([12], '0123456789ABCDEFGHJKMNPQRSTVWXYZ');
shortId(); // 'K7M2Q9XWC4TB'

const base62Id = IdFactory(
  [8, 8],
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
);
base62Id(); // 'aZ3kQ9mT-Xp7Lw2Rn'
```

- `segments` is the length of each group. Dashes go between groups.
- `alphabet` can be anything from 2 to 64 unique ASCII characters.
- If your alphabet includes `-`, use a single segment so the dashes stay unambiguous.
- Validation happens once when you create the generator, not on every call.
