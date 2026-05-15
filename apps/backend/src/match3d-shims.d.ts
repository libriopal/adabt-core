declare module '@match3d/farkle-shared' {
  export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;
  export type GamePhase = string;

  export interface Cell {
    id: string;
    face: DieFace;
    row: number;
    col: number;
    locked?: boolean;
    selected?: boolean;
  }

  export interface Player {
    id: string;
    name: string;
    banked: number;
    isActive?: boolean;
    vote?: string | null;
    isConnected?: boolean;
    avatar?: string;
  }

  export interface LobbySettings {
    stakeAmount: number;
    playerCount: number;
    turnTimerSeconds?: number;
    [key: string]: unknown;
  }

  export const GAME_CONSTANTS: Record<string, unknown>;
  export const RALLY_MILESTONES: readonly {
    tier: number;
    points: number;
    multiplier: number;
  }[];
}

declare module '@match3d/farkle-engine' {
  import type { Cell, DieFace } from '@match3d/farkle-shared';

  export class CSPRNG {
    constructor(seed?: string);
    next(): number;
    revealSeed(): string;
    getSeed(): string;
  }

  export class SixPoolManager {
    constructor(...args: unknown[]);
  }

  export function createGrid(...args: unknown[]): Cell[][];
  export function scoreFarkle(faces: DieFace[]): { score: number; isFarkle: boolean };
  export function hashServerSeed(seed: string): Promise<string>;
  export function estimateFarkleRisk(ones: number, fives: number, diceCount: number): number;
  export function isOptimalDecision(
    decision: string,
    unbanked: number,
    multiplierStep: number,
    farkleRisk: number,
  ): boolean;
}
