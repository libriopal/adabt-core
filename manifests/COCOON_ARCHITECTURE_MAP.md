# Cocoon Architecture Map

**Phase:** 6  
**Layer:** Context Collapse Compression  
**Status:** Stable

## Compression Path

```text
Phase 1 deterministic seed
  -> Phase 2 memory/compression topology
  -> Phase 3 evolution replay lineage
  -> Phase 4 demand reinforcement inputs
  -> Phase 5 reinforcement scoring lineage
  -> Phase 6 semantic graph abstraction
  -> transparent manifold encoding
  -> cocoon state serializer
  -> reconstruction verifier
  -> recovery manifest
```

## Component Map

| Component | Path | Role |
| --- | --- | --- |
| SemanticGraphAbstraction | `apps/frontend/src/cocoon/semanticGraph.ts` | Reduces phase continuity into deterministic semantic units, nodes, edges, anchors, and topology signatures. |
| ManifoldEncoder | `apps/frontend/src/cocoon/manifoldEncoder.ts` | Encodes graph nodes into transparent named dimensions and deterministic geodesic summaries. |
| CocoonStateSerializer | `apps/frontend/src/cocoon/serializer.ts` | Produces canonical cocoon state, identity checksums, reinforcement lineage, and stable serialization. |
| CompressionMetadataRegistry | `apps/frontend/src/cocoon/metadata.ts` | Records entropy, compression ratio, semantic loss, topology preservation, continuity scores, and rollback targets. |
| ReconstructionVerifier | `apps/frontend/src/cocoon/verifier.ts` | Replays serialization and reconstruction, then validates topology, continuity, entropy, and checksum parity. |
| CocoonDebugPanel | `apps/frontend/src/components/CocoonDebugPanel.tsx` | Exposes replay metrics, continuity bars, topology inspector facts, and the architecture path in the UI. |

## Determinism Boundaries

- No wall-clock values are used in Phase 6 cocoon identity, serialization, encoding, or checksums.
- No `Math.random()` path participates in Phase 6 replay.
- The manifold encoder uses named feature dimensions instead of opaque embeddings.
- Raw conversations are not persisted as the primary structure; Phase 6 stores semantic units, topology, continuity anchors, and reconstruction metadata.

## Recovery Boundary

Rollback recovery starts from the highest-priority deterministic seed identity, then rebuilds semantic topology, geodesics, reinforcement lineage, and entropy validation before accepting the cocoon checkpoint.
