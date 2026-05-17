// ThemeRegistry — Organic Vegas r1 design_tokens.json → CSS vars + shader uniforms
// Source of truth: shared/source-of-truth/organic-vegas/design_tokens.json (r1)
// Do not edit token values here; supersede by publishing a new SOT release.

// ── Canonical color tokens ────────────────────────────────────────────────────

export const Colors = {
  acidLime:   '#c8d400',
  syncBlue:   '#3388ff',
  ritualGold: '#c9a84c',
  voidBlack:  '#050008',

  bgBase:     '#050008',
  bgElevated: '#0d0712',
  bgSunken:   '#020003',
  bgScrim:    'rgba(5, 0, 8, 0.72)',

  primaryBase:   '#c8d400',
  primaryHover:  '#dce81c',
  primaryActive: '#a8b300',

  syncPulse:  '#79b2ff',
  syncDesync: '#ff4d6d',

  rewardBase:  '#c9a84c',
  rewardGlint: '#ffe28a',
  rewardSpent: '#6e5b2c',

  dangerBase: '#ff2b55',
  dangerLow:  '#7a1026',
  dangerHigh: '#ff8aa2',

  stateDisabled: '#5a5260',
} as const;

// ── CSS custom property map ───────────────────────────────────────────────────

const CSS_VARS: Record<string, string> = {
  '--ov-acid-lime':     Colors.acidLime,
  '--ov-sync-blue':     Colors.syncBlue,
  '--ov-ritual-gold':   Colors.ritualGold,
  '--ov-void-black':    Colors.voidBlack,

  '--ov-bg-base':       Colors.bgBase,
  '--ov-bg-elevated':   Colors.bgElevated,
  '--ov-bg-sunken':     Colors.bgSunken,
  '--ov-bg-scrim':      Colors.bgScrim,

  '--ov-primary':       Colors.primaryBase,
  '--ov-primary-hover': Colors.primaryHover,
  '--ov-primary-active':Colors.primaryActive,
  '--ov-primary-text':  Colors.voidBlack,

  '--ov-sync-pulse':    Colors.syncPulse,
  '--ov-sync-desync':   Colors.syncDesync,

  '--ov-reward':        Colors.rewardBase,
  '--ov-reward-glint':  Colors.rewardGlint,
  '--ov-reward-spent':  Colors.rewardSpent,

  '--ov-danger':        Colors.dangerBase,
  '--ov-danger-low':    Colors.dangerLow,
  '--ov-danger-high':   Colors.dangerHigh,

  '--ov-disabled':      Colors.stateDisabled,

  // Typography
  '--ov-font-display':  '"Cinzel", "Cormorant Garamond", Georgia, serif',
  '--ov-font-ui':       '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
  '--ov-font-code':     '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',

  // Spacing
  '--ov-touch-min':     '44px',
  '--ov-touch-pref':    '48px',
  '--ov-panel-gap':     '8px',
  '--ov-board-inset':   '12px',

  // Shape
  '--ov-radius-tile':   '6px',
  '--ov-radius-button': '8px',
  '--ov-radius-panel':  '8px',
  '--ov-border-hair':   '1px',
  '--ov-border-focus':  '2px',
  '--ov-border-ritual': '3px',

  // Motion durations
  '--ov-dur-tap-down':  '55ms',
  '--ov-dur-tap-up':    '85ms',
  '--ov-dur-slide':     '135ms',
  '--ov-dur-bank':      '220ms',
  '--ov-dur-modal-in':  '180ms',
  '--ov-dur-modal-out': '130ms',

  // Easing
  '--ov-ease-snap':         'cubic-bezier(0.2, 0.8, 0.2, 1)',
  '--ov-ease-ritual-rise':  'cubic-bezier(0.12, 0.76, 0.24, 1)',
  '--ov-ease-danger-cut':   'cubic-bezier(0.72, 0, 0.84, 0.22)',
};

// ── Shader uniform exports ────────────────────────────────────────────────────
// Use these directly in Three.js ShaderMaterial uniforms.

export const ShaderUniforms = {
  global: {
    uTimeScale:               1,
    uPixelRatioMax:           2,
    uDitherStrength:          0.012,
    uChromaticAberrationPx:   0.65,
    uVignetteStrength:        0.42,
  },
  voidNoise: {
    uNoiseFrequencyLow:  0.85,
    uNoiseFrequencyMid:  3.2,
    uNoiseFrequencyHigh: 11.5,
    uNoiseOctaves:       4,
    uNoiseLacunarity:    2.02,
    uNoiseGain:          0.48,
    uFlowSpeed:          0.035,
  },
  tileFresnel: {
    uFresnelPowerIdle:   2.8,
    uFresnelPowerActive: 4.6,
    uFresnelBias:        0.08,
    uFresnelScale:       1.15,
    uRimColor:           Colors.syncBlue,
    uRewardRimColor:     Colors.ritualGold,
  },
  organicMembrane: {
    uWarpFrequency:    2.4,
    uWarpAmplitudePx:  1.8,
    uPulseFrequencyHz: 0.72,
    uPulseAmplitude:   0.06,
    uVeinThreshold:    0.61,
    uVeinSoftness:     0.08,
  },
  casinoGlint: {
    uGlintWidth:     0.055,
    uGlintSpeed:     0.8,
    uGlintIntensity: 0.72,
    uGoldBias:       0.35,
  },
  syncField: {
    uPhaseBands:        6,
    uPhaseDrift:        0.015,
    uDesyncPulseHz:     7.5,
    uLatencyColorLow:   Colors.acidLime,
    uLatencyColorMid:   Colors.ritualGold,
    uLatencyColorHigh:  Colors.dangerBase,
  },
} as const;

// ── AudioVisual event token map ───────────────────────────────────────────────

export const AVBindings = {
  tap:        { colorImpulse: Colors.syncBlue,   shader: 'tileFresnel',     durationMs: 85 },
  validSlide: { colorImpulse: Colors.acidLime,   shader: 'organicMembrane', durationMs: 135 },
  match:      { colorImpulse: Colors.acidLime,   shader: 'casinoGlint',     durationMs: 220 },
  bank:       { colorImpulse: Colors.ritualGold, shader: 'casinoGlint',     durationMs: 320 },
  desync:     { colorImpulse: Colors.dangerBase, shader: 'syncField',        durationMs: 160 },
} as const;

// ── Runtime CSS injection ─────────────────────────────────────────────────────
// Call once at app boot (e.g. in main.tsx or agros/init.ts).

export function injectTheme(root: HTMLElement = document.documentElement): void {
  for (const [prop, value] of Object.entries(CSS_VARS)) {
    root.style.setProperty(prop, value);
  }
}

// ── Three Tissue palette (Gold / Neon / Obsidian) ────────────────────────────

export const ThreeTissues = {
  Gold:    { base: Colors.ritualGold, glow: '#ffe28a', deep: '#6e5b2c' },
  Neon:    { base: Colors.acidLime,   glow: '#dce81c', deep: '#a8b300' },
  Obsidian:{ base: Colors.voidBlack,  glow: Colors.bgElevated, deep: Colors.bgSunken },
} as const;
