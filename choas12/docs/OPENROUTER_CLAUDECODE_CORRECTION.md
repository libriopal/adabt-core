# OpenRouter Claude Code Correction

This file is intentionally separate from the Python OpenRouter proxy bridge.

## Correct Claude Code Route

Claude Code uses OpenRouter's Anthropic-compatible route:

```bash
export OPENROUTER_API_KEY="<set-outside-repo>"
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="$OPENROUTER_API_KEY"
export ANTHROPIC_API_KEY=""
```

Role-specific model variables may be used:

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL="~anthropic/claude-opus-latest"
export ANTHROPIC_DEFAULT_SONNET_MODEL="~anthropic/claude-sonnet-latest"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="~anthropic/claude-haiku-latest"
export CLAUDE_CODE_SUBAGENT_MODEL="~anthropic/claude-opus-latest"
```

## Forbidden Confusion

Do not use `https://openrouter.ai/api/v1` as `ANTHROPIC_BASE_URL` for Claude Code.

The Python proxy bridge and local prompt-to-app fallback use OpenRouter's OpenAI-compatible chat-completion path or SDK. Claude Code uses the Anthropic-compatible path above.

## Audit Rule

Any future plan that merges the Claude Code route and the Python proxy route receives `VETO`.
