# STRUTHIO-SEC Overview

STRUTHIO-SEC is AGROS's deterministic defensive mesh. It is responsible for detecting drift, validating continuity, and keeping recovery paths explainable.

## Loops

1. Context Integrity Loop: validates registered runtime checks and reports healthy, degraded, critical, or unknown state.
2. Seed Consistency Loop: validates deterministic seed availability and PRNG stability.
3. Evolution Boundary Loop: watches mutation rate, diversity, and fitness drift.
4. Compression Verification Loop: verifies reconstructable compressed state.
5. Agent Consensus Loop: compares independent checksums and reports conflicts.
6. Drift Detection Loop: records threshold and anomaly events.
7. Recovery Loop: captures and restores bounded checkpoints.
8. Reinforcement Gate: constrains mutation weighting through replayable scoring decisions.

## Implemented Modules

- `apps/frontend/src/struthio/integrity.ts`
- `apps/frontend/src/struthio/drift.ts`
- `apps/frontend/src/struthio/recovery.ts`
- `apps/frontend/src/struthio/consensus.ts`

## Operational Signals

STRUTHIO-SEC exposes:

- integrity reports
- drift summaries
- recovery checkpoint results
- consensus reports
- metrics for recovery attempts and consensus failures

## Recovery Behavior

Recovery is intentionally bounded. It stores recent in-memory checkpoints, verifies checksum parity during restore, and reports whether the checkpoint preserved deterministic seed context. Durable recovery should use cocoon serialization plus backend checkpoint records.

