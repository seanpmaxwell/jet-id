### Running diagnostics

For quick performance checks add this to the end of `jetId.ts`

```ts
// TEMP BENCH — remove after measuring
{
  console.log('Pool size ' + POOL_IDS);

  const ITER = 20_000;
  for (let i = 0; i < 2_000; i++) refillPool(); // warm up / let TurboFan tier it

  let t = performance.now();
  for (let i = 0; i < ITER; i++) refillPool();
  const refillNs = ((performance.now() - t) * 1e6) / (ITER * POOL_IDS);

  t = performance.now();
  for (let i = 0; i < ITER; i++) fillRandom(randomBytes);
  const randomNs = ((performance.now() - t) * 1e6) / (ITER * POOL_IDS);

  t = performance.now();
  for (let i = 0; i < ITER; i++) decodePool();
  const decodeNs = ((performance.now() - t) * 1e6) / (ITER * POOL_IDS);

  console.log(`refill (total)  ${refillNs.toFixed(2)} ns/id`);
  console.log(`  random fill   ${randomNs.toFixed(2)} ns/id`);
  console.log(`  decode        ${decodeNs.toFixed(2)} ns/id`);
  console.log(`  encode (rest) ${(refillNs - randomNs - decodeNs).toFixed(2)} ns/id`);
}
```

and then run:

```sh
node --experimental-strip-types src/api/jetId.ts
```
