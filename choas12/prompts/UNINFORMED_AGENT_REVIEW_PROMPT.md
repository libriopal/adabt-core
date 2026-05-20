# Uninformed-Agent Review Prompt

You are an uninformed agent receiving this directive packet for the first time.

Your task is to reconstruct the plan as a machine-readable, phase-based, auditable plan for CodeRabbit and Claude Code to review.

## Inputs

Read the packet under `choas12/`.

## Required Analysis

1. Identify the destination.
2. Identify all implementation lanes.
3. Identify every required file.
4. Identify every governance gate.
5. Identify every API request boundary.
6. Identify every deployment or GitHub mutation boundary.
7. Identify all PASS requirements.
8. Identify all VETO conditions.

## Required Output

Return a single YAML document:

```yaml
review_status: PENDING_CODERABBIT_AUDIT
destination: []
phases: []
required_files: []
api_request_coverage: []
deployment_boundaries: []
github_boundaries: []
pass_conditions: []
veto_conditions: []
blocking_ambiguities: []
recommended_verdict: PASS_OR_VETO
```

## Forbidden

Do not run deployment. Do not push code. Do not request secrets. Do not mark accepted.
