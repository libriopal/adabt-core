# Claude Generation Notes

## Correction Applied

Claude must redirect to the OpenRouter proxy bridge path while preserving the original governance destination.

## Important Separation

- Claude Code OpenRouter route: Anthropic-compatible `https://openrouter.ai/api`.
- Python proxy bridge route: OpenRouter chat-completions route under `https://openrouter.ai/api/v1`.

These are not interchangeable.

## Required Behavior

Claude must produce phase plans that are machine readable and auditable. Claude may not mark its own output accepted.
