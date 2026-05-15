/**
 * RhythmEngine.ts — Singleton game engine for the Inverted Guitar Hero mechanic.
 *
 * Manages all game state (falling blocks, health, score, emotional state) and
 * owns the frequency modulation pipeline that drives the WASM DSP kernel.
 *
 * EMOTION-TARGETING FREQUENCY MATH
 * ──────────────────────────────────
 * 1. Glide (LERP) — α = 0.05
 *      f_current += α * (f_target - f_current)
 *    Simulates string tension: frequency shifts feel "weighted", not instant.
 *
 * 2. Tension state (misses)
 *      LFO amplitude: 15–20 Hz  (nervous vibrato)
 *      LFO rate:       8–12 Hz  (flutter)
 *      f_target:      +12 cents  (microtonal dissonance)
 *
 * 3. Relief / Flow state (≥3 consecutive perfect catches)
 *      LFO amplitude:  2 Hz     (subtle breathing)
 *      LFO rate:       0.5 Hz   (slow oscillation)
 *      f_target:  f_base × 1.5 (Perfect Fifth) or × 2 (Octave)
 *
 * 4. Anticipation (block speed → LFO rate escalation)
 *      lfoRate_escalated = lfoRate × e^(k × normalisedSpeed),  k = 0.5
 *    As gameplay accelerates the vibrato tightens, elevating tension.
 *
 * AUDIO DECOUPLING
 * ────────────────
 * The engine calls setFreq() with the fully-modulated frequency every
 * update tick.  It never touches React state or the DOM — those are the
 * caller's responsibility.  Wire via RhythmEngine.init({ setFreq, setGain }).
 */

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface FreqBlock {
  id: number;
  x: number;          // canvas px, center
  y: number;          // canvas px from top, center
  vy: number;         // fall speed px/s
  targetFreq: number; // Hz
  hue: number;        // CSS hue 0–360
  caught: boolean;
  burstTimer: number; // ms remaining for burst animation
}

export type EmotionState = 'neutral' | 'tension' | 'flow' | 'anticipation';

export interface EngineSnapshot {
  blocks: ReadonlyArray<FreqBlock>;
  health: number;
  score: number;
  emotion: EmotionState;
  currentFreq: number;
  lfoAmplitude: number;
  lfoRate: number;
  canvasW: number;
  canvasH: number;
}

type AudioCallbacks = {
  setFreq: (hz: number) => void;
  setGain: (g: number) => void;
};

/* ─── Constants ──────────────────────────────────────────────────────────── */

const ALPHA               = 0.05;   // LERP smoothing factor
const K_ESCALATION        = 0.5;    // Exponential escalation constant
const BASE_BLOCK_SPEED    = 55;     // px/s
const SPEED_NORM_RANGE    = 120;    // px/s range for normalisation
const MIN_FREQ            = 60;     // Hz
const MAX_FREQ            = 1800;   // Hz
const SPAWN_INTERVAL_BASE = 2200;   // ms
const SPAWN_INTERVAL_MIN  = 700;    // ms
const HEALTH_MISS_COST    = 18;     // % per miss
const HEALTH_CATCH_GAIN   = 12;     // % per catch
const HEALTH_DECAY_RATE   = 2;      // % per second
const CATCH_RADIUS        = 36;     // px
const PERFECT_CATCH_Y_FRAC = 0.75; // block must be above this fraction of canvas height
const FLOW_STREAK_NEEDED  = 3;      // consecutive perfect catches → flow state
const CENTS_12            = Math.pow(2, 12 / 1200); // +12 cents multiplier

/* ─── Singleton ──────────────────────────────────────────────────────────── */

class RhythmEngineImpl {
  /* Audio callbacks */
  private _setFreq: ((hz: number) => void) | null = null;
  private _setGain: ((g: number) => void) | null = null;
  private _active = false;

  /* Frequency modulation */
  currentFreq   = 440;
  targetFreq    = 440;
  baseFreq      = 440;
  lfoPhase      = 0;   // 0–1 normalised phase
  lfoAmplitude  = 2;   // Hz
  lfoRate       = 0.5; // Hz

  /* Emotional state */
  emotion: EmotionState = 'neutral';
  catchStreak   = 0;
  missStreak    = 0;

  /* Game state */
  blocks: FreqBlock[]  = [];
  health               = 100;
  score                = 0;
  blockSpeed           = BASE_BLOCK_SPEED;
  spawnInterval        = SPAWN_INTERVAL_BASE;
  lastSpawnTs          = 0;
  nextId               = 0;

  /* Canvas dimensions — updated by the React component */
  canvasW = 0;
  canvasH = 0;

  /* ─── Lifecycle ────────────────────────────────────────────────────── */

  init({ setFreq, setGain }: AudioCallbacks): void {
    this._setFreq = setFreq;
    this._setGain = setGain;
  }

  setActive(active: boolean): void {
    this._active = active;
  }

  reset(): void {
    this.blocks        = [];
    this.health        = 100;
    this.score         = 0;
    this.currentFreq   = 440;
    this.targetFreq    = 440;
    this.baseFreq      = 440;
    this.lfoPhase      = 0;
    this.lfoAmplitude  = 2;
    this.lfoRate       = 0.5;
    this.emotion       = 'neutral';
    this.catchStreak   = 0;
    this.missStreak    = 0;
    this.blockSpeed    = BASE_BLOCK_SPEED;
    this.spawnInterval = SPAWN_INTERVAL_BASE;
    this.lastSpawnTs   = 0;
    this.nextId        = 0;
  }

  snapshot(): EngineSnapshot {
    return {
      blocks:       this.blocks,
      health:       this.health,
      score:        this.score,
      emotion:      this.emotion,
      currentFreq:  this.currentFreq,
      lfoAmplitude: this.lfoAmplitude,
      lfoRate:      this.lfoRate,
      canvasW:      this.canvasW,
      canvasH:      this.canvasH,
    };
  }

  /* ─── Main Update Loop ─────────────────────────────────────────────── */

  /**
   * Advance the game simulation by dt seconds.
   * Call from a requestAnimationFrame loop.
   *
   * @param dt  Delta time in seconds (clamped to 50 ms to avoid tunnelling).
   * @param now Timestamp in milliseconds (from performance.now / RAF).
   */
  update(dt: number, now: number): void {
    const safe_dt = Math.min(dt, 0.05);

    /* ── 1. Frequency LERP glide ─────────────────────────────────────── */
    this.currentFreq += ALPHA * (this.targetFreq - this.currentFreq);

    /* ── 2. Anticipation: LFO rate escalates exponentially with speed ── */
    const normSpeed = Math.max(0, (this.blockSpeed - BASE_BLOCK_SPEED) / SPEED_NORM_RANGE);
    const escalatedRate = this.lfoRate * Math.exp(K_ESCALATION * normSpeed);

    /* ── 3. LFO phase advance + modulation ──────────────────────────── */
    this.lfoPhase = (this.lfoPhase + escalatedRate * safe_dt) % 1;
    const lfoValue = this.lfoAmplitude * Math.sin(2 * Math.PI * this.lfoPhase);
    const modulatedFreq = Math.max(20, Math.min(20000, this.currentFreq + lfoValue));

    /* ── 4. Push to WASM kernel (decoupled from UI) ──────────────────── */
    if (this._active) {
      this._setFreq?.(modulatedFreq);

      /* Passive health drain → controls master gain */
      this.health = Math.max(0, this.health - HEALTH_DECAY_RATE * safe_dt);
      this._setGain?.(Math.max(0, (this.health / 100) * 0.8));

      /* Block speed creep */
      this.blockSpeed += 0.4 * safe_dt;

      /* Spawn interval tightens as speed increases */
      this.spawnInterval = Math.max(
        SPAWN_INTERVAL_MIN,
        SPAWN_INTERVAL_BASE - (this.blockSpeed - BASE_BLOCK_SPEED) * 10,
      );
    }

    /* ── 5. Spawn new blocks ─────────────────────────────────────────── */
    if (this._active && this.canvasW > 0 && now - this.lastSpawnTs > this.spawnInterval) {
      this.blocks.push(this._spawnBlock());
      this.lastSpawnTs = now;
    }

    /* ── 6. Update block positions, detect misses ────────────────────── */
    const toRemove: number[] = [];
    this.blocks.forEach((b, i) => {
      if (b.caught) {
        b.burstTimer -= safe_dt * 1000;
        if (b.burstTimer <= 0) toRemove.push(i);
        return;
      }
      b.y += b.vy * safe_dt;
      if (b.y > this.canvasH + 40) {
        this._onMiss();
        toRemove.push(i);
      }
    });
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.blocks.splice(toRemove[i], 1);
    }
  }

  /* ─── Player Input ─────────────────────────────────────────────────── */

  /**
   * Test a pointer-down event against all live blocks.
   * Returns true if a block was caught.
   */
  tryPointerCatch(px: number, py: number): boolean {
    let best: FreqBlock | null = null;
    let bestDist = CATCH_RADIUS;
    this.blocks.forEach(b => {
      if (b.caught) return;
      const d = Math.hypot(px - b.x, py - b.y);
      if (d < bestDist) { bestDist = d; best = b; }
    });
    if (!best) return false;
    const caught = best as FreqBlock;

    const isPerfect = caught.y / Math.max(1, this.canvasH) < PERFECT_CATCH_Y_FRAC;
    this._onCatch(caught, isPerfect);
    return true;
  }

  /* ─── Emotion State Transitions ────────────────────────────────────── */

  private _onCatch(block: FreqBlock, isPerfect: boolean): void {
    block.caught     = true;
    block.burstTimer = 350;
    this.score++;
    this.health      = Math.min(100, this.health + HEALTH_CATCH_GAIN);
    this.missStreak  = 0;
    this.catchStreak++;

    if (isPerfect && this.catchStreak >= FLOW_STREAK_NEEDED) {
      /* ── Flow state: harmonic resolution ──────────────────────────── */
      this.emotion      = 'flow';
      this.lfoAmplitude = 2;    // Subtle breathing
      this.lfoRate      = 0.5;  // Slow oscillation

      /* Snap to nearest Perfect Fifth (×1.5) or Octave (×2) */
      const fifth  = block.targetFreq * 1.5;
      const octave = block.targetFreq * 2;
      this.targetFreq = Math.abs(fifth  - this.currentFreq) <=
                        Math.abs(octave - this.currentFreq) ? fifth : octave;
      this.baseFreq   = block.targetFreq;
    } else {
      /* ── Normal catch: reduce LFO tension gradually ───────────────── */
      this.emotion      = this.catchStreak >= 2 ? 'neutral' : this.emotion;
      this.targetFreq   = block.targetFreq;
      this.baseFreq     = block.targetFreq;
      this.lfoAmplitude = Math.max(2,   this.lfoAmplitude * 0.65);
      this.lfoRate      = Math.max(0.5, this.lfoRate      * 0.65);
    }
  }

  private _onMiss(): void {
    this.health      = Math.max(0, this.health - HEALTH_MISS_COST);
    this.catchStreak = 0;
    this.missStreak++;

    /* ── Tension state: erratic vibrato + microtonal dissonance ──────── */
    this.emotion      = 'tension';
    this.lfoAmplitude = 15 + Math.random() * 5;  // 15–20 Hz (nervous)
    this.lfoRate      = 8  + Math.random() * 4;  // 8–12 Hz (flutter)
    // +12 cents: subtle detuning that signals failure without being jarring
    this.targetFreq   = this.currentFreq * CENTS_12;
  }

  /* ─── Block Factory ────────────────────────────────────────────────── */

  private _spawnBlock(): FreqBlock {
    const logMin    = Math.log(MIN_FREQ);
    const logMax    = Math.log(MAX_FREQ);
    const targetFreq = Math.exp(logMin + Math.random() * (logMax - logMin));
    const t         = (Math.log(targetFreq) - logMin) / (logMax - logMin);
    const hue       = 200 + t * 120; // Deep blue → magenta (log-scaled)

    /* Y at spawn: the block's target frequency band, offset above it */
    const bandY = this.canvasH * (1 - t);
    return {
      id:          this.nextId++,
      x:           44 + Math.random() * (this.canvasW - 88),
      y:           Math.max(-40, bandY - 60 - Math.random() * 80),
      vy:          this.blockSpeed + Math.random() * 25,
      targetFreq,
      hue,
      caught:      false,
      burstTimer:  0,
    };
  }
}

/* ─── Singleton Export ───────────────────────────────────────────────────── */

export const RhythmEngine = new RhythmEngineImpl();
