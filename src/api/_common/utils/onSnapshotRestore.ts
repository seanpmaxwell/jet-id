// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Runs `callback` when a Node startup snapshot that captured this module is
 * restored. A snapshot can save a pool with unused IDs still waiting in it;
 * without a reset, every process restored from that snapshot would hand out
 * the same saved batch. Does nothing outside Node, or outside a snapshot
 * build.
 */
function onSnapshotRestore(callback: () => void): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v8 = (globalThis as any).process?.getBuiltinModule?.('node:v8');
  if (v8?.startupSnapshot?.isBuildingSnapshot()) {
    v8.startupSnapshot.addDeserializeCallback(callback);
  }
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default onSnapshotRestore;
