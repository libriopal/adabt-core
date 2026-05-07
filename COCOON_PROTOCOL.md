# Cocoon Protocol

The Cocoon Protocol compresses AGROS state into a reconstructable semantic topology.

## Objective

Convert:

```text
conversation and generated state
  -> semantic topology
  -> compressed manifold
  -> cocoon state
  -> verified reconstruction
```

## Components

- Semantic graph abstraction: builds canonical topology units.
- Manifold encoder: condenses topology into ordered dimensions.
- State serializer: emits compact cocoon payloads.
- Metadata registry: records compression, continuity, and recovery metadata.
- Reconstruction verifier: validates cocoon payloads against source topology.
- Replay verifier: repeats reconstruction paths and compares checksums.

## Stability Rules

- Serialization order must be stable.
- Checksums must be seed-derived or topology-derived.
- Reconstruction must preserve recovery checkpoint IDs.
- Replay must compare independent cocoon executions.
- Cocoon state must not depend on wall-clock time for deterministic checksums.

## Production Validation

Run:

```bash
node scripts/validate-production.mjs
```

The script verifies cocoon reconstruction and cocoon replay parity as part of deployment readiness.

## Recovery Relationship

Cocoon is the durable semantic recovery payload. STRUTHIO recovery checkpoints are bounded runtime controls; cocoon payloads are the cross-session recovery format.

