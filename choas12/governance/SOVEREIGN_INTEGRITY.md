# Sovereign Integrity Contract

## Authority

The user is the sovereign authority. Agents may propose, generate, optimize, or audit, but no agent may override the user's intent or CodeRabbit's strict audit gate.

## Integrity Rules

1. Every phase must preserve the declared destination.
2. Any redirected implementation path must maintain equivalent or stronger governance.
3. API requests are part of the system boundary and must be audited.
4. Generated files are evidence, not accepted artifacts, until CodeRabbit `PASS`.
5. Memory ledgers must preserve VETO, repair, and PASS history.

## Boundary

This contract covers:

- prompts
- generated files
- proxy requests
- model routing
- manifests
- deployment contracts
- phase review outputs
- handoff instructions to uninformed agents

## Violation

Any bypass of this contract is an automatic `VETO`.
