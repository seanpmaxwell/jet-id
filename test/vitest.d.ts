// test/vitest.d.ts
declare module 'vitest' {
  export interface ProvidedContext {
    prevNodeEnv: string | undefined;
  }
}
export {};
