import { DemandResult, DemandSignal, Design } from '../types';
import { DeterministicPRNG, hashString } from '../utils/prng';
import { DemandDB } from '../storage/db';

// ─── NLP Helpers ─────────────────────────────────────────────────────────────

function analyzeSentiment(text: string): number {
  const positive = ['good', 'great', 'amazing', 'love', 'best', 'excellent', 'awesome', 'fantastic'];
  const negative = ['bad', 'terrible', 'worst', 'hate', 'awful', 'boring', 'dread'];
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
  const repetition = 1 - unique.size / words.length;
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

const TREND_WINDOW_BUCKETS = 24 * 6;

function calculateTrendWeight(timestamp: number, currentBucket: number): number {
  const reviewBucket = Math.floor(timestamp / (10 * 60 * 1000));
  const bucketAge = currentBucket - reviewBucket;
  return clamp(1 - bucketAge / TREND_WINDOW_BUCKETS, 0, 1);
}

function getTimeBucket(): number {
  return Math.floor(Date.now() / (10 * 60 * 1000));
}

// ─── Mock Scraper ─────────────────────────────────────────────────────────────

interface RawReview { text: string; timestamp: number; source: string; }

function fetchMockReviews(input: string, seed: string): RawReview[] {
  const prng = new DeterministicPRNG(seed + hashString(input));
  const count = prng.nextInt(10, 50);

  const templates = [
    "This is the {quality} game I've played",
    "{emotion} experience, would recommend",
    "The {feature} is {adjective}",
    "{intensity} gameplay hours",
    "{sentiment} about the progression system",
  ];
  const qualities = ['best', 'worst', 'most addictive', 'least interesting'];
  const emotions = ['amazing', 'terrible', 'exciting', 'boring'];
  const features = ['graphics', 'mechanics', 'soundtrack', 'story'];
  const adjectives = ['stunning', 'awful', 'mediocre', 'revolutionary'];
  const sentiments = ['love', 'hate', 'enjoy', 'dread'];

  const reviews: RawReview[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const template = prng.pick(templates);
    const review = template
      .replace('{quality}', prng.pick(qualities))
      .replace('{emotion}', prng.pick(emotions))
      .replace('{feature}', prng.pick(features))
      .replace('{adjective}', prng.pick(adjectives))
      .replace('{intensity}', String(prng.nextInt(10, 500)))
      .replace('{sentiment}', prng.pick(sentiments));

    reviews.push({
      text: review,
      timestamp: now - prng.nextInt(0, 10) * 10 * 60 * 1000,
      source: 'mock_store',
    });
  }
  return reviews;
}

// ─── Demand Processor ────────────────────────────────────────────────────────

function processDemandSignals(reviews: RawReview[]): DemandSignal[] {
  const currentBucket = getTimeBucket();
  return reviews.map(review => ({
    sentiment: analyzeSentiment(review.text),
    intensity: measureIntensity(review.text),
    keywords: extractKeywords(review.text),
    trendWeight: calculateTrendWeight(review.timestamp, currentBucket),
  }));
}

function calculateDemandScore(signals: DemandSignal[]): {
  demandScore: number;
  keywordVector: Record<string, number>;
  trendVector: number[];
  keywordClusters: string[];
} {
  if (signals.length === 0) {
    return { demandScore: 0.5, keywordVector: {}, trendVector: [0.5], keywordClusters: [] };
  }

  const avgSentiment = signals.reduce((s, x) => s + x.sentiment, 0) / signals.length;
  const avgIntensity = signals.reduce((s, x) => s + x.intensity, 0) / signals.length;
  const avgTrend = signals.reduce((s, x) => s + x.trendWeight, 0) / signals.length;

  const keywordVector: Record<string, number> = {};
  signals.forEach(s => {
    s.keywords.forEach((kw, idx) => {
      keywordVector[kw] = (keywordVector[kw] || 0) + (5 - idx) / 5;
    });
  });
  const maxVal = Math.max(...Object.values(keywordVector), 1);
  Object.keys(keywordVector).forEach(k => { keywordVector[k] /= maxVal; });

  const rawScore = clamp(
    0.5 * ((avgSentiment + 1) / 2) +
    0.3 * avgIntensity +
    0.2 * avgTrend,
    0, 1,
  );
  const demandScore = clamp(rawScore, 0.2, 0.8);

  const trendVector = signals.map(s => s.trendWeight);
  const keywordClusters = Object.entries(keywordVector)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k);

  return { demandScore, keywordVector, trendVector, keywordClusters };
}

// ─── Demand Engine ────────────────────────────────────────────────────────────

export class DemandEngine {
  private seed: string;
  private lastResult: DemandResult | null = null;
  private updateInterval = 60_000;
  private lastUpdateTime = 0;

  constructor(seed: string = 'default_seed') {
    this.seed = seed;
  }

  async updateDemand(input: string = 'slot_machine_game'): Promise<DemandResult> {
    const now = Date.now();

    // Throttle: reuse recent result within the update interval
    if (this.lastResult && now - this.lastUpdateTime < this.updateInterval) {
      return this.lastResult;
    }

    const reviews = fetchMockReviews(input, this.seed);
    const signals = processDemandSignals(reviews);
    const { demandScore, keywordVector, trendVector, keywordClusters } = calculateDemandScore(signals);

    const result: DemandResult = {
      demandScore,
      trendVector,
      keywordClusters,
      timestamp: now,
      volume: signals.length,
      keywordVector,
    };

    this.lastResult = result;
    this.lastUpdateTime = now;

    try {
      DemandDB.save(result);
    } catch {
      // DB may not be ready in tests — non-fatal
    }

    return result;
  }

  scoreDesign(design: Design, demand: DemandResult): number {
    if (!demand) return 0.5;

    // Base score from demand signal
    let score = demand.demandScore;

    // Keyword match bonus
    if (demand.keywordVector && design.intentVector) {
      const thematic = design.intentVector.thematicCluster.toLowerCase();
      const bonus = Object.entries(demand.keywordVector)
        .filter(([kw]) => thematic.includes(kw) || kw.includes(thematic))
        .reduce((sum, [, w]) => sum + w * 0.05, 0);
      score = clamp(score + bonus, 0, 1);
    }

    return score;
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export const demandEngine = new DemandEngine();
