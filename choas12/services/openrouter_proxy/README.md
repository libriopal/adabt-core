# Governed OpenRouter Proxy Bridge

This is a dependency-free Python proxy bridge for pre-generation and local-only OpenRouter workflows.

## Start

```bash
OPENROUTER_PROXY_DRY_RUN=true \
OPENROUTER_ALLOWED_MODELS=openrouter/auto \
python choas12/services/openrouter_proxy/app.py
```

## Healthcheck

```bash
curl http://localhost:8080/health
```

## Governed Chat

Send `POST /v1/governed-chat` with a full request envelope. Dry-run mode validates and writes an audit event without contacting OpenRouter.

## Security

- reads `OPENROUTER_API_KEY` only from environment
- never logs authorization headers
- stores prompt content hashes instead of full prompt content in audit logs
- rejects non-allowlisted models
- rejects deployment-impacting requests in this pre-generation packet
