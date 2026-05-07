# CHECKPOINT PHASE 14

## Scope

Phase 14 advances release evidence integrity automation by adding signed handoff manifests, uploaded artifact verification, dashboard mismatch triage, and CI scripts that verify exported release artifacts before publication.

## Completed

- Added `agros-release-evidence-manifest-v1` manifests that cover release evidence, release bundle summaries, promotion timelines, and rollback timelines when those artifacts are available.
- Added artifact verification diagnostics that recompute uploaded artifact checksums and block mismatched or missing handoff artifacts.
- Added release integrity APIs:
  - `GET /api/release/evidence/manifest`
  - `POST /api/release/evidence/verify-artifacts`
- Added `npm run artifact:evidence-manifest` and `npm run release:verify-artifacts` for CI-driven manifest generation and artifact verification.
- Updated `deploy/github-actions-ci.yml` to generate signed manifests, verify handoff artifacts, and upload manifest plus verification artifacts.
- Extended `ReleaseReadinessPanel` with manifest generation, artifact verification, verification status, mismatch counts, and checksum triage.

## Guarantees

- Manifest signatures bind the decision, evidence, artifact checksums, and handoff triage state.
- Verification blocks when uploaded artifacts are missing, tampered, or no longer match their manifest checksums.
- Manifests explicitly report missing promotion or rollback timeline artifacts so operators can distinguish incomplete handoff bundles from checksum mismatches.
- CI can verify release evidence, bundle summary, promotion timeline, and rollback timeline artifacts before publishing them.

## Validation

```bash
npm run validate:phase14
```

The Phase 14 validator creates release evidence, records and reconciles a go decision, creates a failed promotion, plans and executes rollback, generates a signed manifest, verifies matching artifacts, verifies tamper detection, and chains Phase 13 validation.

## Rollback

Revert the manifest and artifact verification diagnostics, routes, CI scripts, CI template updates, dashboard controls, Phase 14 docs, manifest registry updates, and validation script. Phase 13 rollback supervision remains independently usable.

## Next

Phase 15 should advance release incident packet automation:

- Add incident packet exports that combine manifests, verification reports, drift summaries, and rollback timelines.
- Add packet redaction controls for public versus private handoff contexts.
- Add dashboard controls for packet assembly and incident owner assignment.
- Add CI scripts that publish verified incident packets as immutable release artifacts.
