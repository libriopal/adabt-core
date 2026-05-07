import { DemandResult, DemandSignal, DemandSourceBreakdown, Design } from '../types';
import { DeterministicPRNG, hashString } from '../utils/prng';
import { DemandDB } from '../storage/db';

type DemandSourceId =
  | 'slotcatalog'
  | 'wizardofodds'
  | 'bigwinboard'
  | 'slotbeats'
  | 'casinogrounds'
  | 'google_patents'
  | 'uspto'
  | 'github_rtp';

interface RawDemandRecord {
  text: string;
  timestamp: number;
  source: DemandSourceId;
  popularity: number;
  confidence: number;
}

interface DemandSourceAdapter {
  id: DemandSourceId;
  weight: number;
  collect(input: string, seed: string, currentBucket: number): RawDemandRecord[];
}

const SOURCE_CONFIG: Array<{
  id: DemandSourceId;
  weight: number;
  lexicon: string[];
  templates: string[];
}> = [
  {
    id: 'slotcatalog',
    weight: 0.16,
    lexicon: ['mechanics', 'bonus', 'volatility', 'scatter', 'free spins'],
    templates: ['{quality} catalog demand for {keyword}', '{keyword} slot profiles show {sentiment} traction'],
  },
  {
    id: 'wizardofodds',
    weight: 0.14,
    lexicon: ['rtp', 'variance', 'math model', 'paytable', 'hit frequency'],
    templates: ['{keyword} math discussion has {sentiment} confidence', '{quality} risk appetite around {keyword}'],
  },
  {
    id: 'bigwinboard',
    weight: 0.14,
    lexicon: ['max win', 'streaming', 'bonus buy', 'multiplier', 'feature hunt'],
    templates: ['{quality} player interest in {keyword}', '{keyword} posts show {sentiment} engagement'],
  },
  {
    id: 'slotbeats',
    weight: 0.12,
    lexicon: ['launch', 'studio', 'brand', 'roadmap', 'market'],
    templates: ['{keyword} news velocity is {quality}', '{sentiment} operator coverage around {keyword}'],
  },
  {
    id: 'casinogrounds',
    weight: 0.12,
    lexicon: ['community', 'replay', 'challenge', 'bonus', 'stream'],
    templates: ['{sentiment} community discussion for {keyword}', '{quality} replay activity on {keyword}'],
  },
  {
    id: 'google_patents',
    weight: 0.12,
    lexicon: ['patent', 'mechanic', 'system', 'method', 'progressive'],
    templates: ['{keyword} filings imply {quality} mechanic pressure', '{sentiment} novelty signal for {keyword}'],
  },
  {
    id: 'uspto',
    weight: 0.10,
    lexicon: ['claim', 'symbol', 'wager', 'bonus', 'server'],
    templates: ['{quality} claim density around {keyword}', '{keyword} patent language has {sentiment} signal'],
  },
  {
    id: 'github_rtp',
    weight: 0.10,
    lexicon: ['simulation', 'rtp', 'monte carlo', 'rng', 'volatility'],
    templates: ['{quality} repository activity on {keyword}', '{keyword} code signals {sentiment} reproducibility'],
  },
];

const TREND_WINDOW_BUCKETS = 24 * 6;

function createAdapter(config: (typeof SOURCE_CONFIG)[number]): DemandSourceAdapter {
  return {
    id: config.id,
    weight: config.weight,
    collect(input, seed, currentBucket) {
      const prng = new DeterministicPRNG(`${seed}:${config.id}:${hashString(input)}`);
      const count = prng.nextInt(4, 10);
      const records: RawDemandRecord[] = [];

      for (let i = 0; i < count; i++) {
        const keyword = selectKeyword(input, config.lexicon, prng);
        const template = prng.pick(config.templates);
        const sentiment = prng.pick(['great', 'strong', 'mixed', 'weak', 'excellent', 'boring']);
        const quality = prng.pick(['rising', 'stable', 'volatile', 'fresh', 'crowded', 'strong']);
        const bucketOffset = prng.nextInt(0, TREND_WINDOW_BUCKETS / 2);

        records.push({
          source: config.id,
          text: template
            .replace('{keyword}', keyword)
            .replace('{sentiment}', sentiment)
            .replace('{quality}', quality),
          timestamp: (currentBucket - bucketOffset) * 10 * 60 * 1000,
          popularity: round(prng.nextFloat(0.25, 1)),
          confidence: round(prng.nextFloat(0.55, 0.98)),
        });
      }

      return records;
    },
  };
}

function analyzeSentiment(text: string): number {
  const positive = ['good', 'great', 'amazing', 'love', 'best', 'excellent', 'awesome', 'fantastic', 'strong', 'rising', 'fresh'];
  const negative = ['bad', 'terrible', 'worst', 'hate', 'awful', 'boring', 'dread', 'weak', 'crowded'];
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  words.forEach(word => {
    if (positive.includes(word)) score += 0.2;
    if (negative.includes(word)) score -= 0.2;
  });
  return clamp(score / Math.max(words.length * 0.1, 1), -1, 1);
}

function measureIntensity(text: string): number {
  const exclamations = (text.match(/!/g) || []).length;
  const caps = (text.match(/[A-Z]{2,}/g) || []).length;
  const words = text.toLowerCase().split(/\s+/);
  const unique = new Set(words);
  const repetition = words.length > 0 ? 1 - unique.size / words.length : 0;
  let score = 0;
  score += Math.min(exclamations * 0.1, 0.3);
  score += Math.min(caps * 0.15, 0.3);
  score += repetition * 0.2;
  score += Math.min(text.length / 500, 0.2);
  return clamp(score, 0, 1);
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 4);
  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq)
    .sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([word]) => word);
}

function calculateTrendWeight(timestamp: number, currentBucket: number): number {
  const reviewBucket = Math.floor(timestamp / (10 * 60 * 1000));
  const bucketAge = currentBucket - reviewBucket;
  return clamp(1 - bucketAge / TREND_WINDOW_BUCKETS, 0, 1);
}

function getTimeBucket(): number {
  return Math.floor(Date.now() / (10 * 60 * 1000));
}

function collectDemandRecords(
  input: string,
  seed: string,
  adapters: DemandSourceAdapter[],
  currentBucket: number,
): RawDemandRecord[] {
  return adapters.flatMap(adapter => adapter.collect(input, seed, currentBucket));
}

function processDemandSignals(reviews: RawDemandRecord[], currentBucket: number): DemandSignal[] {
  return reviews.map(review => ({
    source: review.source,
    sentiment: analyzeSentiment(review.text),
    intensity: measureIntensity(review.text),
    keywords: extractKeywords(review.text),
    trendWeight: calculateTrendWeight(review.timestamp, currentBucket),
    popularity: review.popularity,
    confidence: review.confidence,
  }));
}

function calculateDemandScore(
  signals: DemandSignal[],
  sourceWeights: Record<string, number>,
): {
  demandScore: number;
  keywordVector: Record<string, number>;
  trendVector: number[];
  keywordClusters: string[];
  sourceBreakdown: DemandSourceBreakdown[];
  reinforcementInputs: DemandResult['reinforcementInputs'];
  checksum: string;
} {
  if (signals.length === 0) {
    return {
      demandScore: 0.5,
      keywordVector: {},
      trendVector: [0.5],
      keywordClusters: [],
      sourceBreakdown: [],
      reinforcementInputs: {
        demandWeight: 0.5,
        trendMomentum: 0.5,
        sentimentBias: 0,
        popularityPressure: 0.5,
      },
      checksum: hashString('empty-demand'),
    };
  }

  const weighted = signals.map(signal => {
    const sourceWeight = sourceWeights[signal.source || ''] ?? 0.1;
    const confidence = signal.confidence ?? 0.75;
    return {
      signal,
      weight: sourceWeight * confidence,
    };
  });
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;

  const avgSentiment = weighted.reduce((s, x) => s + x.signal.sentiment * x.weight, 0) / totalWeight;
  const avgIntensity = weighted.reduce((s, x) => s + x.signal.intensity * x.weight, 0) / totalWeight;
  const avgTrend = weighted.reduce((s, x) => s + x.signal.trendWeight * x.weight, 0) / totalWeight;
  const avgPopularity = weighted.reduce((s, x) => s + (x.signal.popularity ?? 0.5) * x.weight, 0) / totalWeight;

  const keywordVector: Record<string, number> = {};
  signals.forEach(signal => {
    const sourceWeight = sourceWeights[signal.source || ''] ?? 0.1;
    signal.keywords.forEach((kw, idx) => {
      keywordVector[kw] = (keywordVector[kw] || 0) + ((5 - idx) / 5) * sourceWeight * (signal.confidence ?? 0.75);
    });
  });
  const maxVal = Math.max(...Object.values(keywordVector), 1);
  Object.keys(keywordVector).forEach(k => { keywordVector[k] = round(keywordVector[k] / maxVal); });

  const rawScore = clamp(
    0.36 * ((avgSentiment + 1) / 2) +
    0.22 * avgIntensity +
    0.24 * avgTrend +
    0.18 * avgPopularity,
    0, 1,
  );
  const demandScore = clamp(rawScore, 0.2, 0.85);

  const trendVector = signals.map(s => round(s.trendWeight));
  const keywordClusters = Object.entries(keywordVector)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k);
  const sourceBreakdown = summarizeSources(signals);
  const reinforcementInputs = {
    demandWeight: round(demandScore),
    trendMomentum: round(avgTrend),
    sentimentBias: round(avgSentiment),
    popularityPressure: round(avgPopularity),
  };
  const checksum = hashString(JSON.stringify({
    demandScore: round(demandScore),
    keywordClusters,
    sources: sourceBreakdown.map(source => `${source.source}:${source.signalCount}:${source.confidence}`),
  }));

  return {
    demandScore,
    keywordVector,
    trendVector,
    keywordClusters,
    sourceBreakdown,
    reinforcementInputs,
    checksum,
  };
}

function summarizeSources(signals: DemandSignal[]): DemandSourceBreakdown[] {
  const bySource = new Map<string, DemandSignal[]>();
  signals.forEach(signal => {
    const source = signal.source || 'unknown';
    bySource.set(source, [...(bySource.get(source) || []), signal]);
  });

  return Array.from(bySource.entries()).map(([source, sourceSignals]) => {
    const keywordVector: Record<string, number> = {};
    sourceSignals.forEach(signal => {
      signal.keywords.forEach(keyword => {
        keywordVector[keyword] = (keywordVector[keyword] || 0) + 1;
      });
    });

    return {
      source,
      signalCount: sourceSignals.length,
      sentiment: round(avg(sourceSignals.map(signal => signal.sentiment))),
      intensity: round(avg(sourceSignals.map(signal => signal.intensity))),
      trendWeight: round(avg(sourceSignals.map(signal => signal.trendWeight))),
      popularity: round(avg(sourceSignals.map(signal => signal.popularity ?? 0.5))),
      confidence: round(avg(sourceSignals.map(signal => signal.confidence ?? 0.75))),
      keywords: Object.entries(keywordVector)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([keyword]) => keyword),
    };
  }).sort((a, b) => b.signalCount - a.signalCount || a.source.localeCompare(b.source));
}

export class DemandEngine {
  private seed: string;
  private adapters: DemandSourceAdapter[];
  private lastResult: DemandResult | null = null;
  private lastInput = '';
  private updateInterval = 60_000;
  private lastUpdateTime = 0;

  constructor(seed: string = 'default_seed', adapters: DemandSourceAdapter[] = SOURCE_CONFIG.map(createAdapter)) {
    this.seed = seed;
    this.adapters = adapters;
  }

  async updateDemand(input: string = 'slot_machine_game'): Promise<DemandResult> {
    const now = Date.now();

    if (this.lastResult && this.lastInput === input && now - this.lastUpdateTime < this.updateInterval) {
      return this.lastResult;
    }

    const currentBucket = getTimeBucket();
    const sourceWeights = this.getSourceWeights();
    const records = collectDemandRecords(input, this.seed, this.adapters, currentBucket);
    const signals = processDemandSignals(records, currentBucket);
    const {
      demandScore,
      keywordVector,
      trendVector,
      keywordClusters,
      sourceBreakdown,
      reinforcementInputs,
      checksum,
    } = calculateDemandScore(signals, sourceWeights);

    const result: DemandResult = {
      demandScore,
      trendVector,
      keywordClusters,
      timestamp: now,
      volume: signals.length,
      keywordVector,
      sourceBreakdown,
      sourceWeights,
      reinforcementInputs,
      checksum,
    };

    this.lastResult = result;
    this.lastInput = input;
    this.lastUpdateTime = now;

    try {
      DemandDB.save(result);
    } catch {
      // DB may not be ready in tests - non-fatal.
    }

    return result;
  }

  scoreDesign(design: Design, demand: DemandResult): number {
    if (!demand) return 0.5;

    let score = demand.demandScore;

    if (demand.keywordVector && design.intentVector) {
      const thematic = design.intentVector.thematicCluster.toLowerCase();
      const featureText = design.mechanics?.featureTriggers?.join(' ').toLowerCase() || '';
      const bonus = Object.entries(demand.keywordVector)
        .filter(([kw]) => thematic.includes(kw) || kw.includes(thematic) || featureText.includes(kw))
        .reduce((sum, [, w]) => sum + w * 0.05, 0);
      score = clamp(score + bonus, 0, 1);
    }

    return score;
  }

  getSourceWeights(): Record<string, number> {
    return this.adapters.reduce<Record<string, number>>((weights, adapter) => {
      weights[adapter.id] = adapter.weight;
      return weights;
    }, {});
  }
}

function selectKeyword(input: string, lexicon: string[], prng: DeterministicPRNG): string {
  const words = input.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(word => word.length > 3);
  const candidates = words.length > 0 ? [...words, ...lexicon] : lexicon;
  return prng.pick(candidates);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export const demandEngine = new DemandEngine();
