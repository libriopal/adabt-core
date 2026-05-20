# choas12 Pre-Generation Packet

Status: `PENDING_CODERABBIT_AUDIT`

This packet is a complete pre-generation scaffold for redirecting the current Claude plan onto a governed OpenRouter proxy bridge path while preserving the original destination:

- `REPO_SCAFFOLD`
- `GENERATE_PLUS_OPTIMIZE`
- `STRICT_PASS_VETO`
- GitHub, Railway, and OpenRouter readiness
- phase-based manifests, memory ledgers, and audit bundles
- no push, deploy, or acceptance without CodeRabbit `PASS`

The folder name intentionally matches the requested root path: `choas12/`.

## Packet Guarantees

1. No real API key, token, cookie, or private secret is stored in this packet.
2. Every OpenRouter request path is wrapped by request-envelope governance.
3. Claude Code OpenRouter configuration is documented separately from the Python proxy bridge.
4. The fallback bridge can run locally without Railway and without GitHub mutation.
5. Every generated file must remain `PENDING_AUDIT` until CodeRabbit issues `PASS`.
6. The target GitHub/Railway deployment path is documented, but this packet does not perform deployment.

## Directory Map

- `agents/`: role contracts for generation and governance agents.
- `audit/`: pre-generation audit record and PASS/VETO gate checklist.
- `cli/`: local-only prompt-to-app fallback runner.
- `docs/`: deployment, GitHub, Claude Code, and OpenRouter correction docs.
- `governance/`: sovereign authority and phase gate contracts.
- `memory/`: phase ledger and audit history templates.
- `prompts/`: Claude correction and uninformed-agent handoff prompts.
- `schemas/`: machine-readable schemas for envelopes, audits, and phase plans.
- `services/openrouter_proxy/`: stdlib Python OpenRouter proxy bridge.

## Operating Rule

This packet is not accepted simply because it exists. It becomes actionable only after CodeRabbit audits the contents and emits `PASS`.
