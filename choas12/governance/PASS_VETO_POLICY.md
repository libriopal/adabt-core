# PASS/VETO Policy

## Verdicts

Only two terminal audit verdicts are allowed:

- `PASS`
- `VETO`

Intermediate states may include `DRAFT`, `PENDING_AUDIT`, and `REPAIR_REQUIRED`.

## PASS

`PASS` means:

- required files exist
- governance metadata is complete
- request envelopes are enforced
- no secret leakage exists
- deployment and push gates are respected
- CodeRabbit can reconstruct the phase

## VETO

`VETO` means at least one blocking issue prevents safe phase completion.

Every VETO must include:

- issue id
- affected file or subsystem
- severity
- deterministic risk
- security risk
- deployment risk
- repair instruction
- re-audit condition

## Non-Terminal Phrases

The following phrases are not audit verdicts:

- looks good
- probably safe
- approved by Claude
- generated successfully
- tests seem fine
