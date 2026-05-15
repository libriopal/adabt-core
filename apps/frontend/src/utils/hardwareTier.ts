// ─────────────────────────────────────────────────────
// Hardware Tier Detection — Organic Vegas
// Auto-selects LITE / ELITE quality based on measured device capability.
// Tier enum mirrors dream-core DSP tiers (0–4).
// ─────────────────────────────────────────────────────

export type QualityTier = 'LITE' | 'ELITE';

export interface HardwareProfile {
  quality: QualityTier;
  dspTier: 0 | 1 | 2 | 3 | 4;
  maxDiceBodies: number;         // physics body budget
  shadowsEnabled: boolean;
  particlesEnabled: boolean;
  postProcessing: boolean;
  audioLayerDensity: 'minimal' | 'standard' | 'full';
  isMobile: boolean;
  screenWrap: boolean;           // true → fit-to-screen CSS applied
}

function isMobileDevice(): boolean {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.screen.width < 1024);
}

function measureGPUScore(): number {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 0;
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!ext) return 50; // can't probe, assume mid
    const renderer = (gl as WebGLRenderingContext)
      .getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
    // Heuristic: Apple/NVIDIA/AMD high-end → 90; Intel integrated → 30; unknown → 50
    if (/Apple M[2-9]|RTX|RX\s*[6-9]|GeForce\s*[3-9]/i.test(renderer)) return 90;
    if (/Apple M1|GTX\s*[0-9]{3}|RX\s*[5]/i.test(renderer)) return 70;
    if (/Intel|Adreno\s*[3-9][0-9]{2}/i.test(renderer)) return 30;
    return 50;
  } catch {
    return 50;
  }
}

function measureCores(): number {
  return navigator.hardwareConcurrency ?? 2;
}

export function detectHardwareProfile(): HardwareProfile {
  const mobile = isMobileDevice();
  const gpuScore = measureGPUScore();
  const cores = measureCores();

  // DSP tier: 0 = weakest (Android baseline), 4 = strongest (desktop high-end)
  let dspTier: 0 | 1 | 2 | 3 | 4;
  if (mobile && gpuScore < 40) dspTier = 0;
  else if (mobile) dspTier = 1;
  else if (cores <= 2 || gpuScore < 35) dspTier = 1;
  else if (cores <= 4 || gpuScore < 55) dspTier = 2;
  else if (gpuScore < 75) dspTier = 3;
  else dspTier = 4;

  const quality: QualityTier = dspTier >= 3 ? 'ELITE' : 'LITE';

  return {
    quality,
    dspTier,
    maxDiceBodies: quality === 'ELITE' ? 60 : 30,
    shadowsEnabled: quality === 'ELITE',
    particlesEnabled: quality === 'ELITE',
    postProcessing: quality === 'ELITE' && !mobile,
    audioLayerDensity: dspTier >= 3 ? 'full' : dspTier >= 2 ? 'standard' : 'minimal',
    isMobile: mobile,
    screenWrap: mobile,
  };
}

// Singleton — computed once per session, exported for hooks/components
export const HARDWARE = detectHardwareProfile();
