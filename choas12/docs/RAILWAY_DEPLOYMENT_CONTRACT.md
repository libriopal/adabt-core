# Railway Deployment Contract

This packet prepares Railway compatibility only. It does not deploy.

## Target Model

- Source repo: GitHub repository connected to Railway.
- Requested external deployment target: `STRUTHIO-SECOCOON/MESHv10`.
- This packet lives in `libriopal/adabt-core` as a pre-generation governance deliverable.

## Required Railway Properties

- healthcheck endpoint exists before deployment.
- service reads secrets from Railway environment variables only.
- service never stores OpenRouter keys in repo files.
- failed healthcheck blocks promotion.
- deployment is forbidden until CodeRabbit issues `PASS`.

## OpenRouter Proxy Deployment Expectations

- `OPENROUTER_API_KEY` must be configured in Railway environment.
- `OPENROUTER_ALLOWED_MODELS` should be configured as a comma-separated allowlist.
- `OPENROUTER_PROXY_DRY_RUN=false` may be set only after audit approval.
- audit logs should be routed to an approved persistent location before production use.

## VETO Conditions

- `railway.toml` or `.env.example` contains a real secret.
- deployment runs before audit.
- healthcheck is missing.
- the service accepts ungoverned request envelopes.
