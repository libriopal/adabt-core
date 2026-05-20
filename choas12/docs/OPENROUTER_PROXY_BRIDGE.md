# OpenRouter Python Proxy Bridge

The Python proxy bridge is the governed request control plane for local and Railway-ready OpenRouter access.

## Route

The bridge uses OpenRouter's OpenAI-compatible chat completion API:

```text
POST https://openrouter.ai/api/v1/chat/completions
```

## Authentication

The bridge reads:

```bash
OPENROUTER_API_KEY
```

from the environment only. It must never write this value to logs, responses, manifests, or committed files.

## Governance Metadata

Every request must include:

- `phase_id`
- `task_id`
- `agent_role`
- `model`
- `prompt_hash`
- `request_purpose`
- `allowed_tool_scope`
- `mutation_intent`
- `deployment_impact`
- `memory_impact`
- `risk_level`
- `approval_state`

## Supported Modes

- `dry_run`: validates and audits without dispatching to OpenRouter.
- `local_only`: local prompt-to-app fallback.
- `proxy`: dispatches after governance checks.
- `railway_ready`: compatible with Railway service hosting, but not deployed by this packet.
