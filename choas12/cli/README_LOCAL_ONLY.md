# Local CLI

The CLI is the free/local-first fallback for prompt-to-app generation rehearsal.

It creates:

- `request-envelope.json`
- `manifest.json`
- `audit.jsonl`

It does not:

- deploy
- push
- mark accepted
- store secrets

## Example

```bash
python choas12/cli/local_prompt_app.py \
  --prompt choas12/prompts/CLAUDE_CORRECTION_PROMPT.md \
  --phase-id phase-0 \
  --task-id correction-dry-run \
  --agent-role scaffold_generator \
  --model openrouter/auto \
  --output-dir .generated/phase-0 \
  --dry-run
```
