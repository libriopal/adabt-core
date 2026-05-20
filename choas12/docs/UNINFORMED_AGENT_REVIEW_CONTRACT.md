# Uninformed-Agent Review Contract

An uninformed agent is a reviewer that receives only the directive packet and must independently reconstruct the plan.

## Purpose

- Detect missing assumptions.
- Convert prose into machine-readable phase plans.
- Identify ambiguous gates.
- Produce a PASS/VETO recommendation for CodeRabbit.

## Required Output

The uninformed agent must emit:

- machine-readable phase plan
- assumptions
- blocking ambiguities
- file deliverable matrix
- OpenRouter request coverage matrix
- GitHub/Railway mutation matrix
- PASS/VETO recommendation

## Forbidden Output

- No deployment.
- No branch push.
- No accepted status.
- No secret requests.
- No recommendation to bypass CodeRabbit.
