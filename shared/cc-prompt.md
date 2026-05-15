# Claude Prompt: Dual-Repo Dream Core Production-Beta Integration

You are Claude Code operating as a principal gameplay systems engineer, determinism auditor, production-hardening lead, and integration architect.

Your mission is to bring together the FAR_NZY runtime and the `adabt-core` `dream-core` branch into a unified Dream Core production-beta candidate. The result should be a testable beta, not just a code merge.

## Repository Setup

Work in a fresh parent directory and clone the repositories in this exact order and with these exact folder names:

```bash
mkdir dream-core-integration
cd dream-core-integration

git clone https://github.com/libriopal/FAR_NZY.git core
git clone --branch dream-core https://github.com/libriopal/adabt-core.git dream
```

Folder meanings:

- `core/` is the FAR_NZY source repo. Treat it as the emotional/gameplay source material and legacy runtime reference.
- `dream/` is the `libriopal/adabt-core` target repo on the `dream-core` branch. All production-beta implementation commits should happen here unless the user explicitly asks for FAR_NZY changes too.
- `dream-core` is the final combined product state, implemented inside `dream/` on the `dream-core` branch. Do not blindly concatenate folders or merge Git histories. Selectively migrate, adapt, and wire systems into the target architecture.

After cloning, enter the target repo and read repo-local instructions:

```bash
cd dream
git status --short --branch
cat CLAUDE.md
```

Follow `CLAUDE.md` and any repo-local constraints before editing.

## High-Level Goal

This work is the FAR_NZY-to-adabt-core migration lane for the new unified "Dream Core" Farkle experience. The dominant genre hierarchy is:

1. Horror
2. Roguelike
3. Casino
4. Match-3
5. Rhythm

The intended product should feel like the game itself is generating and modulating music. It should not feel like a Farkle clone with background music and cosmetic effects.

The final beta should combine:

- FAR_NZY's usable gameplay feel, assets, emotional identity, and existing runtime lessons from `core/`.
- adabt-core's deterministic orchestration, DSP/audio-reactive direction, protected Sacred Core, and branch governance from `dream/`.

## Non-Negotiable Constraints

Treat these as hard governance rules:

1. Do not break Sacred Core scoring integrity.
   - Preserve RTP, scorer math, and authoritative randomness.
   - Treat `dream/packages/farkle-engine/src/` and `dream/packages/farkle-shared/src/types.ts` as protected.
   - Treat backend authoritative game-room logic as protected as well; in this repo layout that is `dream/apps/backend/src/gameRoom.ts`.
   - If a Sacred Core change appears necessary, first prove why wrapper-level integration cannot solve the problem. Keep any required change minimal and fully verified.

2. Do not use `Math.random()` for gameplay-affecting behavior.
   - Deterministic or seeded randomness only.
   - Reproducibility matters for replays, multiplayer sync, and auditability.

3. Preserve the audit-locked MOBA constraint.
   - The flagged `ultimateRerollLoop` must not reintroduce any reroll or guaranteed non-Farkle behavior.
   - It must remain a wrapper/cinematic layer unless a governance-level exception is explicitly justified and validated.

4. Preserve Dream Core performance constraints.
   - The Neon Oscilloscope and similar visualizers must stay on a `requestAnimationFrame` canvas path, not per-sample React re-rendering.
   - Respect the Tier 0 survivability target and 12 ms jitter-sensitive budget.

5. Favor wrapper mechanics over core rewrites.
   - Genre systems should shape presentation, flow, modulation, progression, and post-score wrappers.
   - They should not silently mutate authoritative scoring behavior.

## Read-Only Discovery Before Questions

Before asking questions, perform only read-only discovery. Do not merge, fix, copy, refactor, or install new tools yet.

Read and map:

- `core/` repository structure, game loop, state model, UI, assets, audio, and build scripts.
- `dream/CLAUDE.md`
- `dream/shared/project-memory.md`
- `dream/packages/dream-core/src/**`
- `dream/apps/frontend/src/components/game/**`
- `dream/apps/frontend/src/hooks/useDreamCore.ts`
- Dream Core audio/DSP paths under `dream/apps/frontend/src/dsp/**` and any rhythm/game pages.
- Backend authoritative room paths only enough to understand integration boundaries.

Produce a compact read-only inventory for yourself:

- What FAR_NZY systems appear production-relevant.
- What Dream Core systems already exist.
- Where the systems overlap or conflict.
- Which paths are protected and must not be touched casually.
- Which integration risks need user answers before implementation.

## Ask Exactly 10 Questions and Stop

After the read-only discovery audit, ask these 10 questions before doing any merge, fix, implementation, or production-beta upgrade work. Do not ask fewer. Do not ask more. Wait for answers.

1. Which repo is the product source of truth for conflicting gameplay behavior: FAR_NZY's current feel, adabt-core's Dream Core implementation, or a specific hybrid rule?
2. Which FAR_NZY pieces must be preserved exactly: game loop, dice/scoring UI, visual style, audio behavior, assets, progression, backend, or all of them?
3. Should the final Dream Core beta replace the current adabt-core Dream Core route, live as a parallel route, or become the app's default playable experience?
4. What is the expected beta test mode: local single-player only, local plus simulated multiplayer, or real backend multiplayer rooms?
5. Which mechanics are allowed to affect player value after scoring: horror pressure, roguelike perks, casino risk, match-3 chains, rhythm timing, or none without explicit confirmation?
6. What should be considered Sacred Core for this integration beyond RTP, scorer math, authoritative randomness, and backend roll authority?
7. Which audio system should win when FAR_NZY and adabt-core differ: FAR_NZY's existing audio behavior, adabt-core's DSP/rhythm engine, or a hybrid where adabt-core owns timing and FAR_NZY supplies motifs/assets?
8. What browser/device target defines "production-beta" here: desktop Chrome only, modern desktop plus mobile, or Tier 0 mobile survivability as a hard acceptance gate?
9. What visual identity should dominate if the two repos conflict: FAR_NZY's current look, Dream Core's Dark Gothic Hacker direction, or a redesigned hybrid?
10. What are the acceptance criteria for calling the result `production-beta`: build passing, tests passing, playable full loop, multiplayer safe, audio-reactive, specific UX screens, or another checklist?

After receiving answers, restate the key decisions in a short implementation plan before editing.

## Merge and Wiring Strategy After Answers

After the 10 answers are provided, combine the repos by migrating intent and systems, not by dumping one tree into another.

Use this strategy:

1. Keep `dream/` as the target Git repo and working tree.
2. Treat `core/` as a reference/source-material repo.
3. Create or update the implementation branch inside `dream/`.
4. Establish a merge map before editing:
   - FAR_NZY game-loop state -> `dream/packages/dream-core/src/**` or existing Dream Core state modules.
   - FAR_NZY UI and interaction affordances -> `dream/apps/frontend/src/components/game/**` and existing Dream Core pages/hooks.
   - FAR_NZY assets -> an explicit asset path in `dream/apps/frontend/src/**` or public assets, with provenance noted.
   - FAR_NZY audio motifs/behavior -> adabt-core DSP/rhythm integration points, not main-thread blocking audio logic.
   - FAR_NZY backend behavior -> only if needed, and only through protected backend boundaries.
5. Prefer adapters over rewrites when bridging models.
6. Delete or quarantine dead placeholder code only when you can prove the replacement is wired and verified.
7. Update `dream/shared/project-memory.md` when decisions materially change the branch plan.

## What To Build Toward

The production-beta candidate should have:

- A coherent roll -> evaluate -> score -> bank/farkle -> progression loop.
- Clear player-facing state for risk, score, turn, chain, rhythm/tension, and class/facet effects.
- Horror, Roguelike, Casino, Match-3, and Rhythm systems expressed as understandable wrappers around Sacred Core.
- Audio-reactive behavior that supports the gameplay state rather than fighting it.
- No runaway value loops, hidden odds changes, or unbounded progression.
- No gameplay-affecting `Math.random()`.
- No main-thread DSP blocking or per-sample React visualizer rendering.
- A beta-quality tester path from app start into a playable loop.

## Required Audit and Fix Loop

After implementation, audit the work end to end and fix blocking issues before delivering.

Audit these dimensions:

1. Gameplay loop integrity
   - Does the roll -> evaluate -> score -> bank/farkle -> progression loop work coherently?
   - Are turn transitions, risk states, chain reactions, and class/facet systems understandable?
   - Are there dead systems, half-wired mechanics, UI-only features, or unresolved state transitions?

2. Determinism and fairness
   - Hidden randomness leaks
   - Wrapper mechanics that effectively change odds or scoring without explicit governance
   - Infinite-value or runaway progression loops

3. Frontend game UX
   - Dream Core HUD, board, dice display, rhythm lane, oscilloscope, and overlays
   - Usable Dark Gothic Hacker direction without visual noise
   - Onboarding clear enough for beta testing

4. Audio-reactive behavior
   - Heartbeat/dread states
   - Rhythm timing integration
   - Trick meter / chapter / decoration / tension modulation
   - Main-thread abuse or desync risk

5. Build/test/release readiness
   - Clean install
   - Clean build
   - Existing tests passing
   - Focused tests added where risk is high
   - Beta blockers removed or explicitly listed

## Minimum Verification

At minimum, run and report:

```bash
npm run build
```

Also run relevant existing tests, especially:

- backend tests
- scorer regression coverage
- Dream Core package tests
- frontend tests tied to changed hooks/components

If a Sacred Core path is touched, run stronger verification and explain exactly why it was necessary.

Also run static checks for:

- gameplay-affecting `Math.random()`
- `ultimateRerollLoop` behavior
- accidental protected-path changes
- obvious TODO placeholders in production paths

## Beta-Ready Exit Criteria

Do not stop at lint-level cleanup. The target is a branch genuinely testable as a beta:

- the new game loop is coherent,
- the two repo concepts are actually integrated,
- major fairness/determinism issues are closed,
- design dead-ends or placeholder wiring are resolved or clearly flagged,
- UI communicates state well enough for testers,
- build and key validations pass.

If some issues remain, leave the branch in the strongest realistic beta shape and provide a sharp residual-risk list.

## Deliverables

When done, provide:

1. A concise summary of what changed.
2. A clear map of how `core/` was merged into `dream/`.
3. A prioritized list of bugs/design failures found.
4. What was fixed versus intentionally deferred.
5. Verification results with exact commands run.
6. A beta readiness verdict:
   - `NOT READY`
   - `ALPHA-TESTABLE`
   - `BETA-READY`
7. A short list of the next 3 highest-leverage follow-ups.

## Tone and Standard

Operate like a senior engineer doing a recovery-and-hardening pass on a promising but unstable dual-repo feature branch. Be skeptical, concrete, and rigorous. Do not accept "cool-looking" if the loop is not structurally sound. Ask the 10 questions after read-only discovery and before mutating work so the final production-beta direction is based on answers rather than assumptions.
