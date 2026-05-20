# Local-Only Prompt-To-App Fallback

The fallback lane exists so generation can be rehearsed without Railway, GitHub mutation, or protected deployment steps.

## Purpose

- Accept a prompt file.
- Wrap the request in a governance envelope.
- Dispatch through the local OpenRouter proxy bridge or dry-run mode.
- Emit artifacts under a staged output directory.
- Write a manifest and audit record.
- Mark all outputs `PENDING_AUDIT`.

## Required Behavior

- No GitHub push.
- No Railway deploy.
- No real secrets in output.
- No accepted status without CodeRabbit `PASS`.
- No bypass of `GovernanceGuard`.

## Example

```bash
python choas12/cli/local_prompt_app.py \
  --prompt choas12/prompts/CLAUDE_CORRECTION_PROMPT.md \
  --phase-id phase-0 \
  --task-id dry-run-correction \
  --agent-role scaffold_generator \
  --model openrouter/auto \
  --output-dir .generated/phase-0 \
  --dry-run
```

The command above does not call OpenRouter. It writes the governed envelope and a local manifest for audit.
