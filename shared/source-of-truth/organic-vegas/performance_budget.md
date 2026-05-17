# Organic Vegas Performance Budget

Release: `organic-vegas-sot-r1`  
Supersedes: `organic-vegas-sot-r0`  
Status: production-polish-pipeline  
Rule: standards-backed facts and project gates are separated. A project gate is binding for this release, but it is not represented as an external AAA mobile standard.

## Epistemic Ledger

| Claim Type | Meaning | Handling |
|---|---|---|
| Standards-backed fact | Defined by browser/API/spec documentation | Treat as portable only within the stated API scope |
| Runtime query | Known only after querying the current device/browser | Probe at boot and store in capability profile |
| Project gate | Chosen Organic Vegas acceptance threshold | Enforce in CI/device labs; revise only by superseding this release |
| Empirical unknown | No universal standards value exists | Halt automation if exact value is required before measurement |
| Human gate | A playtest or director approval requirement | Cannot be replaced by automated tests |

## Approved Defaults

| Question | Baseline |
|---|---|
| Tier-0 device floor | Android Chrome-class mobile browser, WebGL1-safe fallback, WebGL2 optional |
| Frame policy | 16.67 ms target with dynamic render scale and 30 FPS degradation tier |
| WebAudio topology | AudioWorklet plus WASM/SAB ring buffer where cross-origin isolation is available; UI sends control messages only |
| WebAudio node limit | Project cap plus device measurement; no universal standards cap |
| Rapier3D scope | Coarse physical blockers only; deterministic puzzle state remains custom |
| Multiplayer reconciliation | Deterministic lockstep inputs plus authoritative seeds plus rollback window |
| Network payload | Binary ArrayBuffer fixed schema |
| Governance | Immutable release with signed supersession records |

## Production Pipeline Gates

This pipeline is binding. Content scaling is blocked until the core loop and vertical slice pass human review.

| Stage | Calendar Target | Required Output | Exit Gate |
|---|---:|---|---|
| Discovery and Pre-Production | Weeks 1-4 | Hook, target audience, core loop, monetization model, GDD, high-fidelity wireframes | 5 human reviewers can explain the goal, primary action, reward, and multiplayer promise without developer coaching |
| Prototype and Technical Spike | Weeks 5-8 | Playable no-art matching/sliding prototype | 10 playtest runs show the core action is fun before final art, economy, or content volume is added |
| Vertical Slice | Production Phase 1 | One fully polished level with final art, sound, UI, input, sync badges, reward feedback, and fail states | Director signs final quality bar; no placeholder UX remains in the slice |
| Content and Systems | Production Phase 2 | 50+ stages, backend multiplayer, leaderboards, economy systems | New content uses validated templates and passes softlock, shortcut, and balance checks |
| Iterative QA and Balancing | Continuous Testing | Bug triage, softlock removal, unintended solution review, difficulty tuning | Frustration, boredom, and exploit reports are below project thresholds across playtest cohorts |
| Pre-Launch and LiveOps Setup | Release Candidate | Analytics, monetization SDK plan, server scaling plan, matchmaking pools, leaderboard policy | No launch-blocking telemetry gaps, economy exploits, or scale unknowns remain |
| Launch and Post-Launch | Live | Community events, balance patches, competitive seasons, social loops | Live metrics trigger bounded tuning, not unreviewed mechanical rewrites |

### Human-in-the-Loop Requirements

| Gate | Minimum Evidence | Blocked If |
|---|---|---|
| Hook clarity | Tester describes the hook in one sentence after one session | Testers describe only visuals or genre labels |
| Core fun | Tester asks for another run or voluntarily replays | Replay comes only from instruction, reward bribe, or novelty |
| Juice | Accepted actions feel responsive and satisfying | Feedback is delayed, muted, confusing, or visually noisy |
| Flow | Difficulty alternates pressure and relief | Testers report boredom, helplessness, or arbitrary failure |
| Meaningful choice | Tester can name at least two viable strategies | Optimal play is obvious or random outcomes dominate |
| Co-op value | Teammates communicate or coordinate because roles matter | Co-op behaves like solo play on a larger board |
| Competitive integrity | Rank movement feels explainable and fair | Players cannot tell why they won, lost, or changed rank |

## Replayable Core Loop Gates

| Loop Quality | Production Requirement | Measurement |
|---|---|---|
| Immediate understanding | Objective, valid input, blocked input, and reward preview are visible in the first playable frame | First-time tester states the goal in <= 3 seconds |
| Clear feedback / juice | Every accepted action returns visual, audio, numeric, and state feedback | Input-to-feedback <= 1 frame plus presentation latency |
| Balanced difficulty | Difficulty adapts within bounded ranges and never hides solvability | Fail/retry and hint metrics stay inside cohort target bands |
| Meaningful choices | Boards, roles, objectives, rewards, and risk create distinct strategies | At least 2 viable strategies per stage archetype |
| Layered objectives | Every session has micro, meso, and macro goals | Level completion, unlock progress, and rank/social progress visible |
| Social/competitive integration | Leaderboards, matchmaking, and co-op contribution are first-class loop outputs | Competitive state updates only at deterministic scoring boundaries |

## Multiplayer Design Gates

| Requirement | Gate | Verification |
|---|---|---|
| Snappy controls | Tap and drag are primary; no avoidable confirm steps for normal play | Input audit shows no redundant click in core loop |
| Shared struggle | Co-op levels require different roles, timings, or board responsibilities | Solo-equivalent completion path is flagged for redesign |
| Unintended solution check | Shortcuts, gotchas, and degenerate loops are searched before content approval | Solver and human review both pass |
| No unnecessary inputs | Any click/tap that does not change state, intent, or information must be removed | UX trace contains no dead-step input |
| High-speed animation sync | Remote animations are deterministic presentations of accepted events | Clients replay same accepted input log and produce matching event ids |
| Competitive fairness | Ranked outcomes derive from authoritative state, not local presentation | Score, rank, and rewards are server-verified |
| Reconnect recovery | Temporary network loss repairs without duplicate rewards | Rollback or snapshot resync preserves banked authoritative state |

## Content Scale Gates

| Content Area | Minimum | Gate |
|---|---:|---|
| Vertical slice levels | 1 | Must be final-quality before broad content production |
| Production stages | 50 | Each stage passes softlock, shortcut, difficulty, and multiplayer-role checks |
| Stage archetypes | 8 | Each archetype has a unique strategic pressure |
| Co-op archetypes | 4 | Each requires collaboration beyond shared board size |
| Competitive seasons | 1 launch-ready ruleset | Rank, reset, tie-break, anti-exploit, and reward policy defined |
| Economy loops | 1 source/sink model | No paywall or reward system may obscure puzzle fairness |

## QA and Balance Gates

| Check | Pass Condition |
|---|---|
| Softlock solver | No approved stage can enter reachableMoves=0 unless the fail state is intentional and recoverable |
| Unintended shortcut search | Known degenerate paths are patched or explicitly accepted by design |
| Frustration threshold | Repeated failure without perceived learning stays below playtest threshold |
| Boredom threshold | Low-risk obvious play does not dominate target cohorts |
| Adaptive difficulty bounds | AI tuning can adjust pressure but cannot rewrite objective rules mid-run |
| Reward duplication | Rollback, reconnect, and replay cannot grant duplicate banked rewards |
| Competitive exploit scan | Score farming, stalling, disconnect abuse, and collusion have mitigation rules |
| Telemetry sufficiency | Core loop, failure, hint, retry, churn, rank, and economy events are measurable |

## Standards Facts

| Area | Fact | Practical Consequence |
|---|---|---|
| WebGL limits | Portable maximums such as texture size, renderbuffer size, varying vectors, and uniform vectors must be queried at runtime with `getParameter`. | Do not hard-code device capability from marketing names. |
| WebGL memory | Browser WebGL does not expose a portable VRAM query. | Use explicit pixel budgets, texture atlases, and context-loss recovery. |
| WebGL context loss | Context loss is a normal recoverable condition in mobile/browser environments. | Every GPU resource must be reconstructable. |
| WebAudio render quantum | Web Audio processing is rendered in fixed-size render quanta; current browser practice and spec text use 128 sample frames. | Audio scheduling must tolerate 128-frame block boundaries. |
| AudioWorklet | Custom audio processing runs in an audio rendering context separate from ordinary main-thread UI work. | No main-thread DSP in Tier-0 mode. |
| WASM memory | WebAssembly linear memory is page-based; a page is 64 KiB. | Rapier and DSP memory budgets must be set in pages and measured. |
| Rapier JS | Rapier JS is a WebAssembly-backed physics library and does not render scenes. | Rendering and deterministic puzzle state remain app-owned. |
| WebSocket delivery | WebSocket provides ordered message transport over a connection, but it does not guarantee sub-50 ms latency. | Rhythm sync cannot depend on raw network arrival timing. |
| WebSocket binary | Browser WebSocket supports binary data as `Blob` or `ArrayBuffer`. | Use `ArrayBuffer` payloads for fixed-schema gameplay messages. |

## Tier-0 Capability Profile

| Capability | Gate | Failure Mode |
|---|---:|---|
| WebGL context | WebGL1 required; WebGL2 optional | Show unsupported-device screen if WebGL1 unavailable |
| Internal render resolution | <= 1280 x 720 before dynamic scale | Reduce scale to 0.75, then 0.5 |
| Device pixel ratio used by canvas | <= 2.0 | Clamp DPR for GPU cost stability |
| Texture atlas page | <= queried `MAX_TEXTURE_SIZE`; project target <= 2048 x 2048 | Split atlas into pages |
| Active render targets | <= 2 color targets in Tier-0 | Disable post stack beyond bloom-lite |
| GPU resource reconstruction | 100 percent of textures, buffers, programs rebuildable | Fatal only if rebuild fails |
| SharedArrayBuffer | Required only for SAB audio mode | Fallback to non-SAB AudioWorklet messaging or symbolic-lite audio |
| Cross-origin isolation | Required only for SAB mode | Disable SAB path if COOP/COEP missing |

## 16.67 ms Frame-Time Division

Project gate: 60 Hz frame target is `16.67 ms`. Any device that cannot hold this budget for 95 percent of frames over a 10-minute thermal soak must enter degradation mode.

| Lane | Max ms | Notes |
|---|---:|---|
| Input sample and gesture classification | 0.40 | Touch down, drag delta, cancel, focus routing |
| Deterministic game-state step | 1.20 | Seeded state transition, lockstep input application |
| Puzzle solve and match scan | 1.10 | Board-local scan only; no full-history search |
| Rapier coarse blockers | 1.20 | Optional Tier-0 slice; skip if board state does not need physics |
| Adaptive difficulty step | 0.60 | Bounded heuristic update; no large model inference in frame |
| Network encode/decode | 0.45 | Binary input/diff packets only |
| UI scripting and HUD update | 1.20 | No per-sample React/state render loop |
| Render command submission | 1.40 | Batching required; stable material set |
| GPU render | 5.20 | Includes board, tiles, HUD, particles, and minimal post |
| Audio control messages | 0.35 | Parameter updates only; DSP stays off main thread |
| Telemetry and counters | 0.20 | Ring buffer counters, no blocking upload |
| GC and thermal reserve | 1.20 | Zero-allocation hot path required |
| Frame slack | 2.17 | Absorbs browser/compositor variance |
| **Total** | **16.67** | Hard frame target |

### Group Caps

| Group | Max ms |
|---|---:|
| Scripting total | 4.30 |
| Rendering total | 6.60 |
| Physics total | 1.20 |
| Network total | 0.45 |
| Audio main-thread total | 0.35 |
| Reserve and slack | 3.77 |

## Degradation Ladder

| Trigger | Action |
|---|---|
| 95th percentile frame time > 16.67 ms for 5 s | Reduce render scale by 0.10 |
| Render scale reaches 0.70 and 95th percentile still > 16.67 ms | Disable high-frequency void noise |
| 95th percentile still > 16.67 ms | Disable bloom-lite and chromatic aberration |
| 95th percentile still > 16.67 ms | Reduce particle budget by 50 percent |
| 95th percentile still > 16.67 ms | Enter 30 FPS symbolic-lite mode |
| Audio underruns exceed gate | Reduce voices, then disable live DSP modulation |
| Network jitter exceeds gate | Increase client interpolation/rollback window; do not advance rhythm-critical remote effects without pre-roll |

## WebGL Budget

| Resource | Tier-0 Gate | Rationale |
|---|---:|---|
| Internal canvas pixels | <= 921,600 | 1280 x 720 project cap before dynamic scale |
| Draw calls | <= 80/frame | Keeps CPU submission bounded |
| Shader programs active per scene | <= 12 | Reduces program switch and compile pressure |
| Texture atlas pages | <= 4 | Must also satisfy queried texture-size limit |
| Tile materials | <= 6 | State color should use uniforms/instances, not material explosion |
| Particle instances | <= 512 active | Tier-0 particle cap |
| Fullscreen post passes | <= 2 | Vignette/dither plus optional bloom-lite |
| Render target bytes | <= 24 MiB project cap | Project cap because VRAM is not portable-queryable |

### Required WebGL Boot Probes

| Probe | Action |
|---|---|
| `MAX_TEXTURE_SIZE` | Clamp atlas page size |
| `MAX_RENDERBUFFER_SIZE` | Clamp render target size |
| `MAX_VERTEX_ATTRIBS` | Select instancing layout |
| `MAX_VERTEX_UNIFORM_VECTORS` | Select skeletal/board uniform packing |
| `MAX_FRAGMENT_UNIFORM_VECTORS` | Select shader feature set |
| `MAX_VARYING_VECTORS` | Select shader variant |
| `OES_vertex_array_object` on WebGL1 | Enable VAO fast path if present |
| Float/half-float texture extensions | Enable only if available and measured |
| Context loss event | Trigger resource reconstruction drill |

## WebAudio Budget

| Item | Gate | Notes |
|---|---:|---|
| AudioContexts | 1 | Avoid fragmented device output ownership |
| AudioWorklet processors | 1 mixer processor in Tier-0 | Additional processors require device proof |
| Render quantum | 128 sample frames | Treat as standards-backed current Web Audio block size |
| Live musical voices | <= 16 Tier-0 | Project cap; empirical, not standards-defined |
| One-shot SFX voices | <= 24 concurrent | Project cap; steal quietest/oldest voice |
| Main-thread audio work | <= 0.35 ms/frame | Parameter/control messages only |
| Ring buffer capacity | 2048 samples minimum for DSP bridge | Matches existing KB pattern for SPSC WASM bridge |
| Audio underrun gate | 0 underruns in 16 consecutive 128-frame quanta during idle loop | Fails Tier-0 audio acceptance |
| Jitter gate | < 12 ms Tier-0 UI/audio-control jitter | Matches existing KB Tier-0 rhythm constraint |

### DSP Worker Topology

| Thread/Context | Owns | Forbidden |
|---|---|---|
| Main UI thread | Input, layout, render scheduling, audio parameter intents | Sample generation, FFT hot loops, blocking decode |
| Audio rendering thread | AudioWorklet sample pull, mixing, envelope application | DOM access, async network waits, allocation-heavy logic |
| Decode/analysis worker | Asset decode preparation, beat grid preprocessing, spectral metadata | Direct DOM mutation |
| WASM linear memory | DSP kernel buffers, ring-buffer headers, optional Rapier heap | Unbounded memory growth in Tier-0 |

## WASM and Rapier3D Budget

| Area | Gate | Notes |
|---|---:|---|
| WASM page size | 64 KiB | Standards-backed WebAssembly memory unit |
| DSP initial memory | 4 pages / 256 KiB when using existing DSP bridge pattern | Project-local prior constraint |
| Rapier role | Coarse blockers only | No authoritative board state inside physics heap |
| Rapier step budget | <= 1.20 ms/frame Tier-0 | Skip physics step when no dynamic blockers exist |
| Rapier body count | <= 64 coarse bodies Tier-0 | Project cap until measured |
| Physics determinism | Presentation-only unless proved deterministic across target browsers | Puzzle state remains authoritative custom logic |
| Memory growth | Disabled or tightly capped in Tier-0 builds | Avoid jank from heap growth |

## Network Budget

WebSocket cannot guarantee sub-50 ms latency. The project gate below defines target behavior under acceptable network conditions; it is not a standards guarantee.

| Payload | Max Bytes | Frequency | Required Contents |
|---|---:|---:|---|
| Client input | 24 | On local input event | clientTick, inputId, tileId, direction, phase, checksum8 |
| Client heartbeat | 16 | 10 Hz | clientTick, lastAck, jitterEstimate |
| Server input ack | 24 | On accepted input | serverTick, inputId, accepted/rejected, checksum16 |
| State diff | 96 | <= 20 Hz | changed cells, score delta, seed cursor, phase |
| Rollback repair | 192 | On divergence | authoritative tick window and compact board cells |
| Snapshot | 512 | On join/resync | full board, module flags, economy counters, seed cursor |

### Latency and Sync Gates

| Metric | Gate | Response |
|---|---:|---|
| One-way estimate for rhythm-critical remote effect | < 50 ms target | If exceeded, delay presentation with pre-roll |
| Round-trip time | < 100 ms target | If exceeded, widen interpolation and rollback window |
| Jitter | < 12 ms target | If exceeded, show sync warning and avoid precision co-op prompts |
| Packet loss equivalent | 0 lost critical inputs without repair | Require ack/repair protocol |
| Desync checksum mismatch | 0 tolerated after repair window | Force rollback or resync snapshot |

## Allocation Policy

| Hot Path | Rule |
|---|---|
| Input events | Object pool or struct reuse |
| Puzzle scan | Preallocated arrays only |
| Network packets | Reused `ArrayBuffer`/typed-array views |
| Audio control | Ring-buffer/control queue; no heap allocation in processor |
| Render frame | No material/geometry creation |
| Telemetry | Fixed-size ring buffer, batch upload outside frame |

## Acceptance Tests

| Test | Pass Condition |
|---|---|
| 10-minute Tier-0 thermal soak | 95 percent frames <= 16.67 ms or degradation ladder reaches stable mode |
| Context-loss reconstruction | Board, HUD, shaders, textures, and sync overlay restored without state loss |
| Audio underrun probe | 16 x 128-sample windows without underrun in idle and puzzle interaction |
| WebSocket jitter simulation | Deterministic state remains correct with 100 ms RTT and 12 ms jitter |
| Rollback checksum drill | Divergence repairs within configured window without duplicate rewards |
| Memory ceiling drill | No unplanned WASM growth, no unbounded JS heap growth during 10-minute run |
| Human core-loop review | Discovery, prototype, and vertical-slice gates pass with recorded playtest notes |
| Stage approval harness | Every production stage passes softlock, shortcut, role, and balance checks |
| Competitive integrity drill | Ranked replay, reconnect, and leaderboard updates match authoritative state |

## Explicit Unknowns

| Unknown | Why Unknown | Required Measurement |
|---|---|---|
| Universal mobile WebAudio node ceiling | No standards-defined cross-device max node count | Device matrix voice/node stress test |
| Exact Rapier heap ceiling for Tier-0 | Scene shape and allocator behavior determine heap pressure | Heap profiling with final body/collider set |
| Guaranteed WebSocket sub-50 ms latency | Network path is outside browser/app control | Regional server RTT and jitter telemetry |
| Universal WebGL mobile texture/renderbuffer maxima | Must be queried per device/context | Boot capability profile |
| Exact audio output sample rate | Device/browser output configuration varies | Query `AudioContext.sampleRate` at runtime |

## Halt Conditions

| Condition | Required Action |
|---|---|
| A future task asks for exact device hardware limits without a device matrix | Halt and request measured target devices |
| A future task asks for guaranteed WebSocket rhythm sync under arbitrary networks | Halt and state the guarantee is impossible |
| A future task asks for fixed WebAudio node limits as a standards fact | Halt and state the limit must be empirical |
| A future task asks for WebGL VRAM availability | Halt and state no portable VRAM query exists |
| A future task asks to scale to 50+ levels before the vertical slice passes human review | Halt and complete the vertical-slice gate first |
| A future task asks adaptive AI to silently change core rules during a live ranked match | Halt and preserve competitive integrity |
