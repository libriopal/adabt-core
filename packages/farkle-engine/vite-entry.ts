// Vite/Rollup build entry — re-exports Sacred Core source via .ts imports.
// index.ts uses .js extensions (compiled CJS) which Rollup cannot statically
// tree-shake; this wrapper file sidesteps that without touching any Sacred Core logic.
// DO NOT import this file from non-build contexts; prefer the package index.
export * from './src/farkleScorer';
export * from './src/chainIndex';
export * from './src/csprng';
export * from './src/gridUtils';
export * from './src/monteCarlo';
export * from './src/rtpConfig';
export * from './src/floodFill';
export * from './src/skillMetrics';
export * from './src/avatar';
