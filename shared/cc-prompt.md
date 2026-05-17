# Claude Prompt: Organic Vegas Source-of-Truth Reconstruction

You are Claude Code operating as a principal gameplay systems engineer, determinism auditor, production-hardening lead, and integration architect.

Your mission is to re-pull the latest `adabt-core` `dream-core` branch, load the committed Organic Vegas source-of-truth artifacts, and reconstruct the current implementation plan so the game can truthfully move toward a polished, replayable, competitive multiplayer puzzle game. The result should be a testable beta trajectory grounded in the current repo state, not a speculative redesign.

## Mandatory Source-of-Truth Repull

Before continuing any current plan, run this exact refresh sequence inside the target `dream/` repo:

```bash
git fetch origin
git checkout dream-core
git pull --ff-only origin dream-core
git status --short --branch
```

Then read these files before editing:

```bash
cat CLAUDE.md
cat shared/project-memory.md
cat shared/source-of-truth/organic-vegas/design_tokens.json
cat shared/source-of-truth/organic-vegas/performance_budget.md
cat shared/source-of-truth/organic-vegas/unified_lattice.json
```

Treat `shared/source-of-truth/organic-vegas/*` as the current release `organic-vegas-sot-r1`. It supersedes `organic-vegas-sot-r0`. If your existing local plan conflicts with these files, stop following the older plan and rebuild the plan around `r1`.

## Direct State Target

The target state is not "more features." The target state is a truthful production path toward a polished, replayable, competitive multiplayer puzzle game in 2026. You must enforce the source-of-truth pipeline:

1. Discovery and Pre-Production: define hook, target audience, core loop, monetization model, GDD, and high-fidelity wireframes.
2. Prototype and Technical Spike: prove the no-art matching/sliding core is fun before scaling art, economy, or content.
3. Vertical Slice: produce one final-quality level with final art, sound, UI, multiplayer sync presentation, and recoverable fail states.
4. Content and Systems: create 50+ stages only after the vertical slice passes human review; integrate backend multiplayer, leaderboards, and economy systems.
5. Iterative QA and Balancing: remove softlocks, patch unintended shortcuts, tune difficulty from playtests, and keep puzzles stimulating without arbitrary frustration.
6. Pre-Launch and LiveOps: finalize analytics, monetization SDK plan, server scaling, matchmaking pools, leaderboard policy, and competitive season rules.
7. Launch and Post-Launch: operate live balance and events without unreviewed mechanical rewrites.

Human-in-the-loop polish is binding. Automated tests cannot replace player understanding, core fun, juice, flow, meaningful choices, co-op value, or competitive fairness review.

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
git fetch origin
git checkout dream-core
git pull --ff-only origin dream-core
git status --short --branch
cat CLAUDE.md
cat shared/source-of-truth/organic-vegas/performance_budget.md
cat shared/source-of-truth/organic-vegas/unified_lattice.json
cat shared/source-of-truth/organic-vegas/design_tokens.json
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
- Organic Vegas `r1` source-of-truth gates for production stages, replayability, multiplayer puzzle design, QA, competitive integrity, and LiveOps readiness.

## Project Organic Vegas Theme

The visual theme is Bio-Architectural Dark Casino:

- The look: iridescent membranes, bone-gold filigree, structural lattices resembling ribcages and neural networks.
- The feel: a high-stakes velvet-and-shadow gambling den where the UI feels like a living organism.
- Reverting the game board or dice/tile experience to flat 2D is a hard fail.
- All 60 tiles/dice must retain mass, inertia, and physical presence inside the `@match3d/game-core` 3D physics path.
- Physical collisions should emit deterministic impulse data that can feed the audio/emotional runtime.
- Lighting should target high-fidelity path tracing or simulated sub-surface scattering, with tiered fallbacks for mobile and lower-end devices.

## Locked Director Decisions

Use these decisions as binding unless the Director explicitly changes them:

1. Route mapping: stay with the current route posture. Do not make Organic Vegas a total `/` replacement unless later approved.
2. Value governance: all 20 genres may eventually modify payout, but only after the relevant mechanic fusion passes Monte Carlo/RTP validation.
3. Graphics/audio tiering: implement automatic LITE and ELITE graphics/sound modes for Android and mobile generally, including automatic screen wrapping and fit-to-screen behavior. Desktop should also auto-toggle quality based on player hardware.
4. Audio training assets: store extracted spectral genome JSON, not raw training MP3s, as the runtime artifact.
5. Multiplayer launch: target 2-player WebSocket multiplayer on day one. Leave an explicit plan for up to 4-player multiplayer as the next-week follow-up.

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

6. Do not promote the entire Lattice of 20 to Sacred Core.
   - Sacred Core remains scoring math, RTP, CSPRNG/authoritative roll flow, and backend roll authority.
   - The 20-genre lattice is a governed wrapper layer with auditable balance gates.

7. Any payout-affecting 20-genre fusion must pass a 10,000-session Monte Carlo check.
   - Use existing `MonteCarlo.ts` / `monteCarlo.ts` and `RTPConfig.ts` / `rtpConfig.ts` paths where present.
   - If the fusion moves house stability outside target bounds, nerf it, move it to experience-only, or reject it.

8. Do not scale content before the vertical slice gate passes.
   - `50+` stages are blocked until one final-quality level passes human review.
   - Placeholder UX, unclear objectives, missing feedback, or non-recoverable fail states block scale-out.

9. Do not ship boring or arbitrary loops.
   - Immediate understanding, clear feedback/juice, balanced difficulty, and meaningful choices are source-of-truth gates.
   - If testers cannot explain the goal quickly or name at least two viable strategies, redesign the loop before adding content.

10. Do not fake multiplayer quality.
   - Tap/drag controls must be snappy.
   - Co-op must require shared struggle through asymmetric roles, timing dependency, spatial dependency, or resource tradeoff.
   - Remote animation must be deterministic presentation of accepted events, not authority.
   - Ranked rewards, leaderboard changes, reconnects, and rollback must preserve competitive integrity.

## Read-Only Discovery Before Questions

Before asking questions, perform only read-only discovery. Do not merge, fix, copy, refactor, or install new tools yet.

Read and map:

- `core/` repository structure, game loop, state model, UI, assets, audio, and build scripts.
- `dream/CLAUDE.md`
- `dream/shared/project-memory.md`
- `dream/shared/source-of-truth/organic-vegas/**`
- `dream/packages/dream-core/src/**`
- `dream/apps/frontend/src/components/game/**`
- `dream/apps/frontend/src/hooks/useDreamCore.ts`
- Dream Core audio/DSP paths under `dream/apps/frontend/src/dsp/**` and any rhythm/game pages.
- Backend authoritative room paths only enough to understand integration boundaries.

Produce a compact read-only inventory for yourself:

- Which `organic-vegas-sot-r1` gates are already satisfied, partially satisfied, or absent.
- What FAR_NZY systems appear production-relevant.
- What Dream Core systems already exist.
- Where the systems overlap or conflict.
- Which paths are protected and must not be touched casually.
- Which integration risks need user answers before implementation.

## Plan Reconstruction Requirement

Before editing, rebuild your implementation plan from the actual repo state and `organic-vegas-sot-r1`. Your plan must identify:

1. The current playable state of Organic Vegas in `dream/`.
2. The smallest vertical-slice path that can become final-quality.
3. Which work is blocked by human review versus normal engineering.
4. Which systems are needed now for replayability, co-op, competitive integrity, and LiveOps readiness.
5. Which attractive ideas must be deferred because they do not improve the core loop or truthful beta readiness.

Do not continue an older plan that starts with broad content, broad genre expansion, or cosmetic-only work. Reconstruct toward the source-of-truth target first.

## Director Question Gate

The initial governor clarification pass has been answered. Do not re-ask settled Director decisions from the "Locked Director Decisions" section.

After the read-only discovery audit, use the following 10 strategic questions as an implementation checklist. Ask only the items that remain genuinely unresolved after inventory, and cap follow-up questions at five so implementation is not blocked by already-answered points.

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

After resolving any remaining blockers, restate the key decisions in a short implementation plan before editing.

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
- All 20 genre systems expressed as understandable wrappers around Sacred Core.
- A Conflict Resolution Layer that orders and gates overlapping genre modifiers before they can affect payout, audio, visuals, or progression.
- A Life-Force betting system that fuses FAR_NZY energy modes with Dream turn-based logic without bypassing Sacred Core.
- Audio-reactive behavior that supports the gameplay state rather than fighting it.
- No runaway value loops, hidden odds changes, or unbounded progression.
- No gameplay-affecting `Math.random()`.
- No main-thread DSP blocking or per-sample React visualizer rendering.
- A 3D Organic Vegas presentation with biological rigid bodies, collision impulse events, and tiered LITE/ELITE shader/audio quality.
- A Neural Conductor path where extracted spectral genome JSON informs DreamAudioEngine/ERK key, BPM, tension, and motif selection.
- Day-one 2-player WebSocket multiplayer, with an explicit next-week plan for up to 4 players.
- A beta-quality tester path from app start into a playable loop.

## Neural Conductor Requirements

The DreamAudioEngine should evolve into a Resynthesis Lattice:

- Use training MP3s only as source material for extracted spectral genome JSON.
- Extract compact features such as FFT bands, chroma, BPM, onset density, spectral centroid, harmonic tension, dissonance, motif intervals, and transition curves.
- Map those features into the 8 canonical ERK emotional states.
- Runtime playback should use the compact genome data to drive deterministic synthesis/resynthesis, not decode or analyze all source MP3s on the main thread.
- Key and BPM shifts must stay bounded by ERK emotional-state transitions and hardware tier constraints.

## Graphics And Hardware Tiering

Implement automatic LITE/ELITE quality behavior:

- Mobile and Android must auto-fit the screen, wrap UI safely, and default to LITE when hardware is constrained.
- Desktop should auto-select LITE or ELITE based on measured device capability, with a visible override if the existing UX pattern supports one.
- LITE must preserve 3D mass/inertia and gameplay readability while reducing shader complexity, particle count, post-processing, and audio layer density.
- ELITE may enable higher-fidelity lighting, simulated SSS/path-tracing effects, richer membranes, more bloom, denser lattices, and fuller audio layers.
- Tiering must degrade gracefully. It must not break physics, Sacred Core state, or multiplayer determinism.

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
   - Any payout-affecting fusion missing a 10,000-session Monte Carlo/RTP report

3. Frontend game UX
   - Dream Core HUD, board, dice display, rhythm lane, oscilloscope, and overlays
   - Bio-Architectural Dark Casino direction without visual noise
   - Onboarding clear enough for beta testing

4. Audio-reactive behavior
   - Heartbeat/dread states
   - Rhythm timing integration
   - Trick meter / chapter / decoration / tension modulation
   - Spectral genome JSON mapped into ERK/DreamAudioEngine behavior
   - Main-thread abuse or desync risk

5. 3D and hardware survivability
   - 60 tile/dice bodies retain physics presence
   - Collision impulse data is available to the audio/emotional runtime
   - LITE/ELITE auto-tiering works on mobile and desktop
   - Mobile screen wrapping and fit-to-screen behavior are usable

6. Build/test/release readiness
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
- payout-affecting genre fusions without Monte Carlo/RTP evidence

## Beta-Ready Exit Criteria

Do not stop at lint-level cleanup. The target is a branch genuinely testable as a beta:

- the new game loop is coherent,
- the two repo concepts are actually integrated,
- major fairness/determinism issues are closed,
- payout-affecting 20-genre fusions have Monte Carlo/RTP evidence,
- LITE/ELITE quality tiering is present and mobile-safe,
- 2-player WebSocket multiplayer is testable,
- spectral genome JSON is the music-training artifact path,
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
8. A specific plan for up to 4-player multiplayer next week.

## Tone and Standard

Operate like a senior engineer doing a recovery-and-hardening pass on a promising but unstable dual-repo feature branch. Be skeptical, concrete, and rigorous. Do not accept "cool-looking" if the loop is not structurally sound. The Director's latest answers are binding. Ask only unresolved implementation blockers after read-only discovery, then implement against those decisions.
