# Organic Vegas Source of Truth

Release: `organic-vegas-sot-r1`  
Supersedes: `organic-vegas-sot-r0`

These files define the current Organic Vegas production target for the `dream-core` branch:

- `design_tokens.json`: visual, feedback, HUD, and screen-state contracts for the Dark Gothic Hacker / Organic Vegas presentation.
- `performance_budget.md`: platform, production-pipeline, loop-quality, multiplayer, QA, balance, and LiveOps gates.
- `unified_lattice.json`: machine-readable genre lattice, source-of-truth release metadata, production pipeline, loop gates, multiplayer rules, deterministic replay, and failure-preservation requirements.

Claude Code and other implementation agents must re-pull `dream-core`, read these files, and reconstruct their implementation plan from the current repo state before editing. These artifacts do not authorize Sacred Core rewrites, hidden payout changes, unbounded adaptive AI, or scaling to 50+ stages before the vertical-slice gate passes.
