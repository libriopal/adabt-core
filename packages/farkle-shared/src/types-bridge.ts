// Build-toolchain bridge — re-exports types.ts for backend CommonJS compilation.
// This avoids the TypeScript paths + node_modules symlink dual-loading issue
// where the same types.ts loaded via two identities produces invisible exports.
export * from './types';
