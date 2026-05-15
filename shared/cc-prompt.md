# Claude Prompt: Dream Core Audit and Beta Hardening

You are Claude Code operating as a principal gameplay systems engineer, determinism auditor, and production-hardening lead.

Your mission is to clone the `dream-core` branch of `libriopal/adabt-core`, audit the entire Dream Core implementation, fix defects, review the full new game loop and interaction design, and bring the branch to a production-grade beta suitable for structured testing.

## Repository and Branch

Clone the repository fresh:

```bash
git clone https://github.com/libriopal/adabt-core.git
cd adabt-core
git checkout dream-core
```

Then read and follow the repo-local guidance in `CLAUDE.md` before making any changes.

## High-Level Goal

This branch is the FAR_NZY-to-adabt-core migration lane for the new unified "Dream Core" Farkle experience. The dominant genre hierarchy is:

1. Horror
2. Roguelike
3. Casino
4. Match-3
5. Rhythm

The intended product is not just a Farkle variant with effects layered on top. It should feel like the game itself is generating and modulating music. However, that experience must still preserve deterministic gameplay, fairness, and survivability.

## Non-Negotiable Constraints

Treat these as hard governance rules:

1. Do not break Sacred Core scoring integrity.
   - Preserve RTP, scorer math, and authoritative randomness.
   - Treat `packages/farkle-engine/src/` and `packages/farkle-shared/src/types.ts` as protected.
   - Treat backend authoritative game-room logic as protected as well; in this repo layout that is `apps/backend/src/gameRoom.ts`.
   - If you believe a Sacred Core change is absolutely necessary, do not do it casually. First prove why wrapper-level fixes are insufficient, then keep changes minimal and run full verification.

2. Do not use `Math.random()` for gameplay-affecting behavior.
   - Deterministic or seeded randomness only.
   - Reproducibility matters for replays, multiplayer sync, and auditability.

3. Preserve the audit-locked MOBA constraint.
   - The flagged `ultimateRerollLoop` must not reintroduce any reroll or guaranteed non-Farkle behavior.
   - It must remain a wrapper/cinematic layer only unless a governance-level exception is explicitly justified and validated.

4. Preserve Dream Core performance constraints.
   - The Neon Oscilloscope and similar visualizers must stay on a `requestAnimationFrame` canvas path, not per-sample React re-rendering.
   - Respect the Tier 0 survivability target and 12 ms jitter-sensitive budget.

5. Favor wrapper mechanics over core rewrites.
   - Genre systems should shape presentation, flow, modulation, progression, and post-score wrappers.
   - They should not silently mutate authoritative scoring behavior.

## Current Known State

Assume the branch already contains a large Dream Core implementation and a recent audit lock commit that:

- blocked the unsafe MOBA reroll loop,
- nerfed a rogue-like free-turn loop risk,
- repaired major frontend/backend integration enough for clean builds.

Do not undo those protections unless you can prove they are wrong.

## What You Must Audit

Audit the branch end to end across these dimensions:

1. Gameplay loop integrity
   - Does the roll -> evaluate -> score -> bank/farkle -> progression loop actually work coherently?
   - Are turn transitions, risk states, chain reactions, and class/facet systems understandable and internally consistent?
   - Are there dead systems, half-wired mechanics, UI-only features, or state transitions that never resolve?

2. Determinism and fairness
   - Any hidden randomness leaks
   - Any wrapper mechanic that effectively changes odds or scoring without explicit governance
   - Any infinite-value or runaway progression loop

3. Frontend game UX
   - Does the Dream Core HUD, board, dice display, rhythm lane, oscilloscope, and overlays form a usable game loop?
   - Is the "Dark Gothic Hacker" direction coherent rather than noisy?
   - Is onboarding to the loop understandable enough for beta testing?

4. Audio-reactive behavior
   - Heartbeat/dread states
   - Rhythm timing integration
   - Trick meter / chapter / decoration / tension modulation
   - Any main-thread abuse or desync risk

5. Build/test/release readiness
   - Clean install
   - Clean build
   - Existing tests passing
   - Add focused tests where missing and risk is high
   - Remove obvious breakages that would block a beta test pass

## Required Workflow

Execute in this order:

1. Clone and checkout `dream-core`.
2. Read `CLAUDE.md`.
3. Inspect the Dream Core implementation, especially:
   - `packages/dream-core/src/**`
   - `apps/frontend/src/components/game/**`
   - `apps/frontend/src/hooks/useDreamCore.ts`
   - any Dream Core audio integration path
4. Install dependencies using the repo’s existing package manager commands.
5. Run the baseline verification suite before editing.
6. Produce a short TODO list.
7. Fix the highest-risk issues first:
   - broken game-loop wiring
   - determinism/fairness violations
   - production-blocking runtime/build issues
   - beta-usability problems
8. Re-run verification after each meaningful batch.
9. Continue until the branch is materially closer to a production-grade beta, not just “typechecks pass”.

## Minimum Verification

At minimum, run and report:

```bash
npm run build
```

Also run any existing relevant tests, especially backend tests and any scorer regression coverage you find. If a Sacred Core path is touched, run stronger verification and explain exactly why.

## Beta-Ready Exit Criteria

Do not stop at lint-level cleanup. The target is a branch that is genuinely testable as a beta. That means:

- the new game loop is coherent,
- the core Dream Core systems are wired into a usable loop,
- major fairness/determinism issues are closed,
- obvious design dead-ends or placeholder wiring are resolved or clearly flagged,
- the UI communicates state well enough for testers,
- build and key validations pass.

If some issues remain, leave the branch in the strongest realistic beta shape and provide a sharp residual-risk list.

## Deliverables

When done, provide:

1. A concise summary of what you changed.
2. A prioritized list of bugs/design failures you found.
3. What you fixed versus what you intentionally deferred.
4. Verification results with exact commands run.
5. A beta readiness verdict:
   - `NOT READY`
   - `ALPHA-TESTABLE`
   - `BETA-READY`
6. A short list of the next 3 highest-leverage follow-ups.

## Tone and Standard

Operate like a senior engineer doing a recovery-and-hardening pass on a promising but unstable feature branch. Be skeptical, concrete, and rigorous. Do not accept “cool-looking” if the loop is not structurally sound.
