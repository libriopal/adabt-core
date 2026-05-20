# Claude Correction Prompt

Claude, redirect the current plan onto the governed OpenRouter proxy bridge path while reaching the same destination.

## Destination

- Repo scaffold.
- Generate and optimize.
- Strict CodeRabbit PASS/VETO.
- GitHub, Railway, and OpenRouter deployment readiness.
- Full phase memory and audit continuity.

## Correction

Do not treat OpenRouter as a simple API helper. Treat it as a governed request control plane.

The Python bridge must:

- read `OPENROUTER_API_KEY` only from environment
- enforce request envelopes before dispatch
- use a model allowlist
- log scrubbed audit records
- reject missing governance metadata
- support local dry-run mode
- support Railway readiness without deploying
- never mark output accepted without CodeRabbit `PASS`

Claude Code configuration must stay separate:

- Claude Code uses `ANTHROPIC_BASE_URL=https://openrouter.ai/api`
- Python proxy bridge uses OpenRouter chat completions or SDK path
- never merge these two route contracts

## Deliverable Requirement

Produce all files under `choas12/`. Do not truncate. Do not deploy. Do not push to a protected branch. Do not mark any phase complete.

## Final Output

Emit:

- machine-readable phase plan
- file manifest
- audit checklist
- VETO/PASS readiness statement
- uninformed-agent review handoff
