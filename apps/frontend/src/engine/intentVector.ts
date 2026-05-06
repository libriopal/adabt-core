import { IntentVector, NarrativeInput } from '../lib/types';
import { DeterministicPRNG } from '../utils/prng';
import { djb2Hash } from '../utils/crypto';

export function generateIntentVector(narrative: NarrativeInput, seed: string): IntentVector {
  const prng = new DeterministicPRNG(seed);

  const conflictIntensity = analyzeConflict(narrative.input, prng);
  const volatilitySignal = detectVolatility(narrative.input, prng);
  const symbolicDensity = calculateSymbolicDensity(narrative.input, prng);
  const aestheticIntensity = measureAestheticIntensity(narrative.input, prng);
  const thematicCluster = identifyTheme(narrative.input, prng);
  const contentComplexity = assessComplexity(narrative.input);
  const renderingMode = selectRenderingMode(narrative.input, {
    conflictIntensity,
    symbolicDensity,
    complexity: contentComplexity,
  });

  return {
    conflictIntensity,
    volatilitySignal,
    symbolicDensity,
    aestheticIntensity,
    thematicCluster,
    contentComplexity,
    renderingMode,
  };
}

function analyzeConflict(input: string, prng: DeterministicPRNG): number {
  const markers = ['war', 'battle', 'fight', 'conflict', 'clash', 'struggle', 'vs', 'against'];
  const lower = input.toLowerCase();
  let score = 0;
  markers.forEach(m => { if (lower.includes(m)) score += 0.25; });
  return clamp(score + (prng.next() * 0.1 - 0.05), 0, 1);
}

function detectVolatility(input: string, prng: DeterministicPRNG): number {
  const high = ['chaos', 'wild', 'extreme', 'madness', 'frenzy', 'storm'];
  const low = ['calm', 'peaceful', 'zen', 'relax', 'steady', 'smooth'];
  const lower = input.toLowerCase();
  let score = 0.5;
  high.forEach(m => { if (lower.includes(m)) score += 0.3; });
  low.forEach(m => { if (lower.includes(m)) score -= 0.3; });
  return clamp(score + (prng.next() * 0.1 - 0.05), 0, 1);
}

function calculateSymbolicDensity(input: string, prng: DeterministicPRNG): number {
  const words = ['myth', 'legend', 'ancient', 'symbol', 'rune', 'totem', 'archetype'];
  const lower = input.toLowerCase();
  let matches = 0;
  words.forEach(w => { if (lower.includes(w)) matches++; });
  return clamp((matches / 3) + (prng.next() * 0.1), 0, 1);
}

function measureAestheticIntensity(input: string, prng: DeterministicPRNG): number {
  const markers = ['beautiful', 'stunning', 'aesthetic', 'art', 'visual', 'design', 'look'];
  const lower = input.toLowerCase();
  let score = 0.3;
  markers.forEach(m => { if (lower.includes(m)) score += 0.25; });
  score += clamp(input.split(' ').length / 50, 0, 0.3);
  return clamp(score, 0, 1);
}

function identifyTheme(input: string, prng: DeterministicPRNG): string {
  const themes = ['fantasy', 'scifi', 'horror', 'crime', 'romance', 'mystery', 'adventure', 'mythology', 'cyberpunk', 'western'];
  const lower = input.toLowerCase();
  for (const theme of themes) {
    if (lower.includes(theme)) return theme;
  }
  const seed = parseInt(djb2Hash(input), 16);
  return themes[seed % themes.length];
}

function assessComplexity(input: string): number {
  const words = input.split(/\s+/).length;
  const unique = new Set(input.toLowerCase().split(/\s+/)).size;
  const avgLen = input.replace(/\s/g, '').length / words;
  const diversity = unique / words;
  const lengthScore = clamp(words / 20, 0, 1);
  return clamp(diversity * 0.4 + lengthScore * 0.4 + avgLen * 0.2, 0, 1);
}

function selectRenderingMode(
  _input: string,
  metrics: { conflictIntensity: number; symbolicDensity: number; complexity: number },
): 'direct' | 'symbolic' | 'encoded' {
  const score = metrics.conflictIntensity * 0.3 + metrics.symbolicDensity * 0.4 + metrics.complexity * 0.3;
  if (score > 0.7) return 'encoded';
  if (score > 0.4) return 'symbolic';
  return 'direct';
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}
