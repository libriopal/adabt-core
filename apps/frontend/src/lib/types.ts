// Frontend type definitions — superset of backend types

export interface IntentVector {
  conflictIntensity: number;
  volatilitySignal: number;
  symbolicDensity: number;
  aestheticIntensity: number;
  thematicCluster: string;
  contentComplexity: number;
  renderingMode: 'direct' | 'symbolic' | 'encoded';
}

export interface SlotMechanics {
  volatilityClass: 'low' | 'medium' | 'high' | 'extreme';
  bonusLogic: string;
  featureTriggers: string[];
  payoutBehavior: string;
  poeticStrategy: 'literal' | 'symbolic' | 'encodedVerse' | 'abstract';
}

export interface NarrativeInput {
  input: string;
  timestamp: number;
}

export interface RenderedContent {
  type: 'literal' | 'symbolic' | 'encodedVerse' | 'abstract' | 'conceit';
  content: string;
  entropy: number;
  poetryTechnique: string;
  verseKey?: string;
  fibonacciFragments?: string[];
}

export interface Plugin {
  id: string;
  name: string;
  type: 'aesthetic' | 'mechanic' | 'content';
  apply: (input: any) => any;
  bypass?: boolean;
}

export interface Explainability {
  reasoning: string;
  dominantIntent: string;
  weightSnapshot: {
    volatilityWeight: number;
    bonusWeight: number;
    featureWeight: number;
    poeticWeight: number;
  };
  renderingPath: string;
  poetryTechnique?: string;
  bypassTechnique?: string;
}

export interface Cache {
  themeCache: Map<string, any>;
  intentVectorCache: Map<string, IntentVector>;
  mechanicCache: Map<string, SlotMechanics>;
  contentCache: Map<string, RenderedContent>;
  bypassCache: Map<string, any>;
  demandCache: Map<string, DemandResult>;
}

export interface RawReview {
  text: string;
  timestamp: number;
  source: string;
  rating?: number;
}

export interface DemandSignal {
  sentiment: number;
  intensity: number;
  keywords: string[];
  trendWeight: number;
}

export interface DemandResult {
  demandScore: number;
  volume: number;
  keywordVector: Record<string, number>;
  signals: DemandSignal[];
}

export interface SlotGPTOutput {
  id: string;
  transformedTheme: string;
  structuredTheme: any;
  slotgptPrompt: string;
  agents: any;
  simulation: number;
  variants: { A: any; B: any; C: any };
  explainability: Explainability;
  score: number;
  contentRendered: RenderedContent;
  poetryApplied: boolean;
  demandResult?: DemandResult;
}

export interface TransformResult {
  narrative: NarrativeInput;
  mechanics: SlotMechanics;
  content: RenderedContent;
  explainability: Explainability;
}
