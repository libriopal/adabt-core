# PASS/VETO Checklist

Use this checklist for every review of this packet and every downstream generated phase.

## Required Inputs

- Phase plan JSON or YAML.
- Generated file manifest.
- File checksum list.
- API request envelope samples.
- Audit log sample.
- VETO repair log, if applicable.
- Railway/GitHub deployment impact statement.

## PASS Requirements

- All requested files exist.
- All required schemas validate the examples they govern.
- All OpenRouter calls pass through `GovernanceGuard`.
- Local CLI emits artifacts into a staged output directory only.
- No secrets are printed, persisted, committed, or included in logs.
- All phase states are explicit and machine readable.
- GitHub push/deploy actions remain gated.
- CodeRabbit can reconstruct the full context from local packet files.

## VETO Requirements

When vetoing, provide:

- `blocking_issue_id`
- affected files
- severity
- deterministic risk
- security risk
- deployment risk
- memory continuity risk
- exact repair instruction
- re-audit command or manual verification path
