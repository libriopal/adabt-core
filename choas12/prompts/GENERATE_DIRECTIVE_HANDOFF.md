# GENERATE Directive Handoff

This handoff is for the future moment when CodeRabbit has passed the directive protocol and the user authorizes `GENERATE`.

## Required Precondition

`CodeRabbit verdict: PASS`

## GENERATE Scope

The receiving agent may generate implementation files only inside the authorized scaffold and only if each phase emits:

- phase plan
- manifest
- checksum list
- API request coverage record
- deployment impact record
- memory ledger update
- CodeRabbit audit input bundle

## Stop Conditions

Stop immediately if:

- governance metadata is missing
- request envelope validation fails
- model policy validation fails
- secrets appear in output
- deployment is attempted
- GitHub protected branch mutation is attempted
- CodeRabbit issues VETO
