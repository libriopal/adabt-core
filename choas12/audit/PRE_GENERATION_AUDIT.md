# Pre-Generation Audit

Verdict: `PASS_WITH_CONSTRAINTS`

## Scope

Audit the pre-generation packet that redirects the plan onto a governed OpenRouter Python proxy bridge path while preserving the original destination: repo scaffold, generate plus optimize, strict pass/veto, and deployment readiness.

## PASS Conditions

- The packet is isolated under `choas12/`.
- The OpenRouter Python proxy bridge uses environment-only secret loading.
- Every model request is represented by a governed request envelope.
- Local-only fallback remains non-mutating by default.
- Claude Code OpenRouter setup is separated from Python proxy bridge setup.
- GitHub and Railway behavior is documented as a gated contract, not executed.
- Machine-readable phase plans are required before generation.
- CodeRabbit remains the survivability governor and final audit gate.

## Blocking VETO Conditions

- Any file stores a real OpenRouter, GitHub, Railway, or Slack secret.
- The proxy forwards prompts without governance metadata.
- Claude Code is configured with the Python bridge endpoint.
- A phase can be marked complete without CodeRabbit `PASS`.
- A deployment or protected-branch push is allowed before audit approval.
- The uninformed-agent review is skipped.
- Generated files are treated as accepted before manifest and checksum review.

## Result

The packet is acceptable as a pre-generation deliverable only. It does not authorize application code generation, deployment, or final phase completion.
