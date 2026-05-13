# AMIS: Autonomous Music Intelligence System

## 1. IDENTITY
This is a browser-native distributed emotional-runtime orchestration platform. It converts `FAR_NZY` gameplay states into deterministic procedural music.

## 2. GOVERNANCE WORKFLOW
1. **Propose:** @Viktor proposes architectural shifts in a PR.
2. **Audit:** @CodeRabbit performs an adversarial audit (triggered via GitHub Actions).
3. **Consolidate:** On merge, `memory-consolidation.yml` snapshots the new architecture state.

## 3. PROJECT MEMORY HIERARCHY
- `/shared/project-memory.md`: The canonical ledger of system evolution.
- `/viktor.md` & `/coderabbit.md`: Agent-specific heuristics and failure logs.
- `/constitution/operational-law.md`: The immutable system constitution.

## 4. DEPLOYMENT (RAILWAY)
- Ensure **COOP** and **COEP** headers are enabled to allow `SharedArrayBuffer` support.
- All WASM binaries must be served with `application/wasm` MIME type.
- Tiered Fidelity must be active to prevent thermal throttling on Android.

## 5. RECOVERY
If the system enters a recursive loop or architecture drift:
1. Revert to the last `governance/checkpoints/` snapshot.
2. Review `/coderabbit.md` for the failure rationale.
3. Re-initialize from the Sovereign User arbitration.

