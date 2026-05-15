// ─────────────────────────────────────────────────────
// DREAM-CORE — Audio Engine
// The game doesn't just HAVE music — it IS music.
// Integrates Heartbeat LFO, Rhythm quantization,
// Acoustic Decorations, Trick Meter stems, and
// Hero's Journey key changes into a unified Web Audio graph.
// ─────────────────────────────────────────────────────

import type { HeartbeatAudioParams } from '../genres/horror';
import type { DecorationAudioConfig } from '../genres/simulation';
import type { TrickAudioParams } from '../genres/sports';
import type { ChapterAudioParams } from '../genres/adventure';

// ── Audio Graph Architecture ──────────────────────────────────────────────────
//
//  [Oscillators/Sources]
//        │
//    [Decoration FX Chain] ← reverb, delay, bitcrush, filter
//        │
//    [Stem Mixer] ← percussion, bass, harmonic, melody, ambient
//        │
//    [Heartbeat LFO Node] ← sub-bass pulse, stem muting
//        │
//    [Trick Meter Filter] ← dynamic cutoff
//        │
//    [Master Gain]
//        │
//    [Destination]
//

export class DreamAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Stem channels
  private stems: Record<string, { gain: GainNode; source: AudioNode | null }> = {};

  // Heartbeat sub-bass
  private heartbeatOsc: OscillatorNode | null = null;
  private heartbeatGain: GainNode | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  // Decoration FX nodes
  private convolver: ConvolverNode | null = null;
  private decorationFilter: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  // Trick meter filter
  private trickFilter: BiquadFilterNode | null = null;

  // Beat tracking
  private audioStartTime: number = 0;
  private currentBpm: number = 120;

  // ── Initialization ──────────────────────────────────────────────────────────

  init(): AudioContext {
    if (this.ctx) return this.ctx;

    this.ctx = new AudioContext();
    this.audioStartTime = this.ctx.currentTime;

    // Master output
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);

    // Trick meter filter (before master)
    this.trickFilter = this.ctx.createBiquadFilter();
    this.trickFilter.type = 'lowpass';
    this.trickFilter.frequency.value = 20000;
    this.trickFilter.Q.value = 0.7;
    this.trickFilter.connect(this.masterGain);

    // Create stem channels
    const stemNames = ['percussion', 'bass', 'harmonic', 'melody', 'ambient'];
    for (const name of stemNames) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0.5;
      gain.connect(this.trickFilter);
      this.stems[name] = { gain, source: null };
    }

    // Initialize decoration FX chain (bypassed by default)
    this.decorationFilter = this.ctx.createBiquadFilter();
    this.decorationFilter.type = 'lowpass';
    this.decorationFilter.frequency.value = 20000;

    return this.ctx;
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  // ── Heartbeat LFO ──────────────────────────────────────────────────────────

  startHeartbeat(params: HeartbeatAudioParams): void {
    if (!this.ctx || !this.masterGain) return;

    this.stopHeartbeat();

    // Sub-bass oscillator
    this.heartbeatOsc = this.ctx.createOscillator();
    this.heartbeatOsc.type = params.oscillatorType;
    this.heartbeatOsc.frequency.value = params.oscillatorFrequency;

    // Heartbeat gain envelope (pulsing)
    this.heartbeatGain = this.ctx.createGain();
    this.heartbeatGain.gain.value = 0;

    // Low-pass filter for chest vibration
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = params.filterCutoff;
    filter.Q.value = params.filterQ;

    this.heartbeatOsc.connect(filter);
    filter.connect(this.heartbeatGain);
    this.heartbeatGain.connect(this.masterGain);

    this.heartbeatOsc.start();

    // Pulse at heartbeat BPM
    const { attack, sustain, release, peak } = params.gainEnvelope;
    const pulseHeartbeat = () => {
      if (!this.ctx || !this.heartbeatGain) return;
      const now = this.ctx.currentTime;
      this.heartbeatGain.gain.cancelScheduledValues(now);
      this.heartbeatGain.gain.setValueAtTime(0, now);
      this.heartbeatGain.gain.linearRampToValueAtTime(peak, now + attack);
      this.heartbeatGain.gain.setValueAtTime(peak, now + attack + sustain);
      this.heartbeatGain.gain.linearRampToValueAtTime(0, now + attack + sustain + release);
    };

    pulseHeartbeat();
    this.heartbeatInterval = setInterval(pulseHeartbeat, params.beatIntervalMs);

    // Mute stems if requested
    if (params.muteAllStems) {
      this.muteAllStems(200);
    }
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatOsc) {
      try { this.heartbeatOsc.stop(); } catch {}
      this.heartbeatOsc = null;
    }
    this.heartbeatGain = null;
  }

  // ── Stem Control ────────────────────────────────────────────────────────────

  setStemVolume(stemName: string, volume: number, fadeMs: number = 100): void {
    const stem = this.stems[stemName];
    if (!stem || !this.ctx) return;

    const now = this.ctx.currentTime;
    stem.gain.gain.cancelScheduledValues(now);
    stem.gain.gain.setValueAtTime(stem.gain.gain.value, now);
    stem.gain.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, volume)),
      now + fadeMs / 1000,
    );
  }

  muteAllStems(fadeMs: number = 200): void {
    for (const name of Object.keys(this.stems)) {
      this.setStemVolume(name, 0, fadeMs);
    }
  }

  restoreAllStems(fadeMs: number = 200): void {
    for (const name of Object.keys(this.stems)) {
      this.setStemVolume(name, 0.5, fadeMs);
    }
  }

  // ── Trick Meter Integration ─────────────────────────────────────────────────

  applyTrickMeter(params: TrickAudioParams): void {
    if (!this.ctx || !this.trickFilter) return;

    const now = this.ctx.currentTime;
    this.trickFilter.frequency.cancelScheduledValues(now);
    this.trickFilter.frequency.setValueAtTime(this.trickFilter.frequency.value, now);
    this.trickFilter.frequency.linearRampToValueAtTime(params.filterCutoff, now + 0.3);

    this.setStemVolume('percussion', params.percussionLayer, 300);
    this.setStemVolume('bass', params.bassLayer, 300);
    this.setStemVolume('melody', params.leadLayer, 300);
  }

  // ── Acoustic Decoration ─────────────────────────────────────────────────────

  applyDecoration(config: DecorationAudioConfig | null): void {
    if (!this.ctx) return;

    // Reset FX chain
    this.clearDecoration();

    if (!config) return;

    // Apply filter
    if (config.filter && this.decorationFilter) {
      this.decorationFilter.type = config.filter.type;
      this.decorationFilter.frequency.value = config.filter.frequency;
    }

    // Apply delay
    if (config.delay) {
      this.delayNode = this.ctx.createDelay(2.0);
      this.delayNode.delayTime.value = config.delay.timeMs / 1000;
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.value = config.delay.feedback;

      // Delay → feedback → delay (loop)
      if (this.trickFilter) {
        this.delayNode.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode);
        // Mix in with dry signal
        const wetGain = this.ctx.createGain();
        wetGain.gain.value = 0.3;
        this.delayNode.connect(wetGain);
        if (this.masterGain) wetGain.connect(this.masterGain);
      }
    }
  }

  private clearDecoration(): void {
    if (this.delayNode) {
      try { this.delayNode.disconnect(); } catch {}
      this.delayNode = null;
    }
    if (this.delayFeedback) {
      try { this.delayFeedback.disconnect(); } catch {}
      this.delayFeedback = null;
    }
  }

  // ── Hero's Journey Key Changes ──────────────────────────────────────────────

  applyChapterAudio(params: ChapterAudioParams): void {
    if (!this.ctx) return;

    this.currentBpm = params.tempo;

    // Apply stem volumes
    this.setStemVolume('percussion', params.stemVolumes.percussion, params.keyGlide ? 2000 : 300);
    this.setStemVolume('bass', params.stemVolumes.bass, params.keyGlide ? 2000 : 300);
    this.setStemVolume('harmonic', params.stemVolumes.harmonic, params.keyGlide ? 2000 : 300);
    this.setStemVolume('melody', params.stemVolumes.melody, params.keyGlide ? 2000 : 300);
    this.setStemVolume('ambient', params.stemVolumes.ambient, params.keyGlide ? 2000 : 300);

    // Apply filter for mood
    if (this.trickFilter && this.ctx) {
      const now = this.ctx.currentTime;
      this.trickFilter.frequency.cancelScheduledValues(now);
      this.trickFilter.frequency.linearRampToValueAtTime(
        params.filterCutoff,
        now + (params.keyGlide ? 2 : 0.3),
      );
    }
  }

  // ── Beat Quantization ──────────────────────────────────────────────────────

  getBpm(): number {
    return this.currentBpm;
  }

  getAudioStartTime(): number {
    return this.audioStartTime;
  }

  getCurrentAudioTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /**
   * Get the next beat time in AudioContext seconds.
   */
  getNextBeatTime(): number {
    if (!this.ctx) return 0;
    const beatInterval = 60 / this.currentBpm;
    const elapsed = this.ctx.currentTime - this.audioStartTime;
    const currentBeat = Math.floor(elapsed / beatInterval);
    return this.audioStartTime + (currentBeat + 1) * beatInterval;
  }

  // ── SFX (ported from FAR_NZY gameAudio.ts, extended) ───────────────────────

  playChainAdd(chainLen: number): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    g.gain.value = 0;
    osc.type = 'sine';
    osc.frequency.value = 300 + chainLen * 55;
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start();

    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.005);
    g.gain.setValueAtTime(0.18, now + 0.025);
    g.gain.linearRampToValueAtTime(0, now + 0.085);
    osc.stop(now + 0.1);
  }

  playFarkle(): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    g.gain.value = 0;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.45);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start();

    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.45, now + 0.005);
    g.gain.setValueAtTime(0.45, now + 0.085);
    g.gain.linearRampToValueAtTime(0, now + 0.435);
    osc.stop(now + 0.5);
  }

  playBank(pts: number): void {
    if (!this.ctx || !this.masterGain) return;

    const freqs = [523, 659, 784];
    freqs.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq + Math.min(pts * 0.02, 200);
      osc.connect(g);
      g.connect(this.masterGain!);
      const delay = i * 0.06;
      const now = this.ctx!.currentTime;
      osc.start(now + delay);
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(0.22, now + delay + 0.01);
      g.gain.linearRampToValueAtTime(0, now + delay + 0.25);
      osc.stop(now + delay + 0.3);
    });
  }

  playReversalSting(): void {
    if (!this.ctx || !this.masterGain) return;

    // Dramatic reversal: ascending chromatic burst
    const notes = [261.63, 329.63, 392.00, 523.25]; // C-E-G-C5
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(this.masterGain!);
      const delay = i * 0.04;
      const now = this.ctx!.currentTime;
      osc.start(now + delay);
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(0.3, now + delay + 0.01);
      g.gain.linearRampToValueAtTime(0, now + delay + 0.15);
      osc.stop(now + delay + 0.2);
    });
  }

  playFlatline(): void {
    if (!this.ctx || !this.masterGain) return;

    // Sustained minor second dissonance
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 40;   // sub-bass
    osc2.type = 'sine';
    osc2.frequency.value = 42.4; // minor second above
    osc1.connect(g);
    osc2.connect(g);
    g.connect(this.masterGain);

    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.5, now + 0.05);
    g.gain.setValueAtTime(0.5, now + 0.4);
    g.gain.linearRampToValueAtTime(0, now + 0.6);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.65);
    osc2.stop(now + 0.65);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  destroy(): void {
    this.stopHeartbeat();
    this.clearDecoration();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.stems = {};
  }
}

// Singleton
export const dreamAudio = new DreamAudioEngine();
