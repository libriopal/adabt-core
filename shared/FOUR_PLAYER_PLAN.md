# 4-Player Multiplayer — Next-Sprint Plan

Current: 2-player WebSocket rooms (day-one, live in `apps/backend/src/index.ts`).

## Scope

Target: up to 4 players per room in free-for-all or 2v2 team mode.

## Changes Required

### Backend (`apps/backend/src/`)
1. Change `MAX_PLAYERS_PER_ROOM` from `2` to `4` in `index.ts`.
2. Update `LobbySettings.playerCount` to accept `1 | 2 | 3 | 4` (already typed correctly in `farkle-shared/src/types.ts`).
3. `GameRoom` already gates grid dimension by `playerCount` (7/8/9/10 columns). No Sacred Core change needed.
4. Add `teamMode: boolean` flag to `LobbySettings` for 2v2 support. Team scoring = shared `banked` pool per team.
5. Extend `ROOM_STATE` broadcast to include per-player banked scores and turn order array.
6. Turn order: implement round-robin via `activePlayerIndex` cycling through `players` array.

### Frontend (`apps/frontend/src/`)
1. `useOrganicMultiplayer.ts`: already supports `players[]` array — just renders 2 slots today. Expand lobby UI slots to 4.
2. `OrganicVegasLobby.tsx`: render 4 player slots instead of hardcoded 2.
3. `OrganicVegas.tsx`: render up to 3 opponent panels in HUD overlay.
4. `MAX_PLAYERS_PER_ROOM` constant should be moved to a shared config (`shared/gameConfig.ts`) so frontend and backend stay in sync.

### Determinism / sync
- 4-player turn order is authoritative server-side only (CSPRNG-seeded first-player determination).
- Client applies turn state from server `ROOM_STATE` — never client-side turn arbitration.
- No Math.random() usage added.

## Estimated effort: 1 sprint (2–3 days)

The heaviest work is QA: 4-player turn-ordering edge cases, disconnect-mid-turn handling,
and re-join flow when a player drops and reconnects.
