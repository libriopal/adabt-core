import { IntentVector, SlotMechanics } from '../lib/types';
import { DeterministicPRNG } from '../utils/prng';

export function mapMechanics(intentVector: IntentVector, seed: string): SlotMechanics {
  const prng = new DeterministicPRNG(seed);

  return {
    volatilityClass: determineVolatility(intentVector.conflictIntensity),
    bonusLogic: constructBonusLogic(intentVector.volatilitySignal, prng),
    featureTriggers: mapFeatureTriggers(intentVector.symbolicDensity, prng),
    payoutBehavior: designPayoutBehavior(intentVector.aestheticIntensity),
    poeticStrategy: selectPoeticStrategy(intentVector.renderingMode),
  };
}

function determineVolatility(intensity: number): SlotMechanics['volatilityClass'] {
  if (intensity < 0.25) return 'low';
  if (intensity < 0.5) return 'medium';
  if (intensity < 0.75) return 'high';
  return 'extreme';
}

function constructBonusLogic(volatility: number, prng: DeterministicPRNG): string {
  const types = ['free_spins', 'pick_bonus', 'cascading_wins', 'expanding_wilds', 'progressive_jackpot', 'multiplier_trail'];
  const selected = prng.pick(types);
  const frequency = volatility > 0.6 ? 'high' : 'moderate';
  const difficulty = volatility > 0.7 ? 'volatile' : 'balanced';
  return `${selected}_${frequency}_${difficulty}`;
}

function mapFeatureTriggers(density: number, prng: DeterministicPRNG): string[] {
  const features = ['scatter_trigger', 'symbol_collection', 'wild_expansion', 'reel_modification', 'mystery_symbol', 'colossal_reel'];
  const count = prng.nextInt(2, Math.floor(density * features.length) + 2);
  return prng.shuffle(features).slice(0, count);
}

function designPayoutBehavior(intensity: number): string {
  if (intensity > 0.7) return 'high_variance_burst';
  if (intensity > 0.4) return 'medium_sustained';
  return 'low_consistent';
}

function selectPoeticStrategy(mode: string): SlotMechanics['poeticStrategy'] {
  switch (mode) {
    case 'encoded': return 'encodedVerse';
    case 'symbolic': return 'symbolic';
    case 'direct': return 'literal';
    default: return 'abstract';
  }
}
