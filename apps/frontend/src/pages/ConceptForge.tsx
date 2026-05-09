/**
 * ConceptForge — Narrative Intent Compiler for Slot Mechanics (NIC-SM)
 *
 * Deterministic AGROS module that transforms narrative slot concepts
 * into cinematic slot game designs through a 7-stage pipeline:
 *   1. Session Seed Generation
 *   2. Narrative Interpretation
 *   3. Intent Vector Generation
 *   4. Mechanic Mapping Engine
 *   5. Poetry Abstraction Layer
 *   6. Plugin Augmentation
 *   7. Final Narrative Rendering
 *
 * Architecture: matches SlotGen / EvolutionLab patterns
 *   - useState + localStorage only (no global state)
 *   - Deterministic PRNG from utils/prng
 *   - Inline logic, minimal abstraction
 */

import React, { useState, useCallback } from 'react';
import { DeterministicPRNG } from '../utils/prng';
import { djb2Hash } from '../utils/crypto';
import { SessionManager } from '../utils/session';
import { generateIntentVector } from '../engine/intentVector';
import { mapMechanics } from '../engine/mechanicMapper';
import { ContentRenderer } from '../engine/contentRenderer';
import type { IntentVector, SlotMechanics, RenderedContent, Explainability, NarrativeInput } from '../lib/types';

// ─── Plugin System ──────────────────────────────────────────────────────────

interface ConceptPlugin {
  id: string;
  name: string;
  apply: (content: string, mechanics: SlotMechanics, rng: DeterministicPRNG) => string;
}

const PLUGINS: ConceptPlugin[] = [
  {
    id: 'aura-fx',
    name: 'AuraFXPlugin',
    apply: (content, mechanics, rng) => {
      const auras = ['golden radiance', 'crimson surge', 'violet storm', 'emerald pulse', 'azure cascade'];
      const aura = auras[Math.floor(rng.next() * auras.length)];
      return content.replace(
        /reels?/gi,
        (m) => `${m} wreathed in ${aura}`
      ) || content + ` A shimmering ${aura} envelops every winning formation.`;
    },
  },
  {
    id: 'anime-escalation',
    name: 'AnimeEscalationPlugin',
    apply: (content, _mechanics, rng) => {
      const escalations = [
        'Power levels surge beyond measure.',
        'The battlefield trembles under unleashed fury.',
        'Transformation sequences ignite with blinding intensity.',
        'Energy beams collide in devastating spectacle.',
      ];
      return content + ' ' + escalations[Math.floor(rng.next() * escalations.length)];
    },
  },
  {
    id: 'dragon-cinematic',
    name: 'DragonCinematicPlugin',
    apply: (content, mechanics, rng) => {
      if (mechanics.volatilityClass === 'high' || mechanics.volatilityClass === 'extreme') {
        const dragons = ['a colossal celestial dragon', 'twin serpentine dragons', 'an ancient fire wyrm'];
        return content + ` ${dragons[Math.floor(rng.next() * dragons.length)]} circles the arena, enhancing multipliers with every strike.`;
      }
      return content;
    },
  },
  {
    id: 'impact-shake',
    name: 'ImpactShakePlugin',
    apply: (content, mechanics, _rng) => {
      if (mechanics.volatilityClass === 'extreme') {
        return content + ' Seismic shockwaves fracture the display as cascading combo wins erupt.';
      }
      return content;
    },
  },
  {
    id: 'sky-battle',
    name: 'SkyBattlePlugin',
    apply: (content, _mechanics, rng) => {
      const lower = content.toLowerCase();
      if (lower.includes('aerial') || lower.includes('sky') || lower.includes('air') || lower.includes('fly')) {
        const envs = [
          'Dynamic animations intensify as the battlefield shifts from calm blue skies into a storm of cosmic destruction.',
          'Lightning fractures the heavens as aerial combatants clash above shattered mountain peaks.',
        ];
        return content + ' ' + envs[Math.floor(rng.next() * envs.length)];
      }
      return content;
    },
  },
];

// ─── Narrative Interpretation (Stage 2) ─────────────────────────────────────

interface NarrativeAnalysis {
  conflictSystems: string;
  progressionLoops: string;
  emotionalEscalation: string;
  symbolicMythology: string;
  collectibleMechanics: string;
  cinematicEnvironments: string;
  interpretation: string;
}

function interpretNarrative(input: string, rng: DeterministicPRNG): NarrativeAnalysis {
  const lower = input.toLowerCase();

  const conflictKeywords = ['fight', 'battle', 'war', 'clash', 'vs', 'combat', 'duel', 'strike'];
  const progressionKeywords = ['evolve', 'transform', 'level', 'grow', 'ascend', 'power up', 'upgrade'];
  const emotionKeywords = ['fury', 'rage', 'love', 'fear', 'hope', 'despair', 'glory', 'triumph'];
  const mythKeywords = ['dragon', 'god', 'ancient', 'myth', 'legend', 'sacred', 'divine', 'eternal'];
  const collectKeywords = ['collect', 'gather', 'scatter', 'orb', 'gem', 'ball', 'crystal', 'token'];
  const envKeywords = ['sky', 'ocean', 'mountain', 'forest', 'city', 'space', 'temple', 'arena'];

  const score = (keywords: string[]) => {
    const hits = keywords.filter(k => lower.includes(k));
    return hits.length > 0
      ? hits.join(', ') + ` (intensity: ${(hits.length / keywords.length).toFixed(2)})`
      : 'minimal presence';
  };

  // Build cinematic interpretation phrase
  const adjectives: string[] = [];
  if (conflictKeywords.some(k => lower.includes(k))) adjectives.push('combat');
  if (mythKeywords.some(k => lower.includes(k))) adjectives.push('mythic');
  if (envKeywords.some(k => lower.includes(k))) {
    const env = envKeywords.find(k => lower.includes(k)) || 'aerial';
    adjectives.push(env);
  }
  if (emotionKeywords.some(k => lower.includes(k))) adjectives.push('emotional');
  if (progressionKeywords.some(k => lower.includes(k))) adjectives.push('escalation');

  const interpretBase = adjectives.length > 0
    ? adjectives.join(' ') + ' narrative'
    : 'thematic exploration';

  return {
    conflictSystems: score(conflictKeywords),
    progressionLoops: score(progressionKeywords),
    emotionalEscalation: score(emotionKeywords),
    symbolicMythology: score(mythKeywords),
    collectibleMechanics: score(collectKeywords),
    cinematicEnvironments: score(envKeywords),
    interpretation: interpretBase,
  };
}

// ─── Final Narrative Rendering (Stage 7) ────────────────────────────────────

function renderFinalNarrative(
  input: string,
  analysis: NarrativeAnalysis,
  intentVector: IntentVector,
  mechanics: SlotMechanics,
  poeticContent: RenderedContent,
  rng: DeterministicPRNG,
): string {
  // Build a ~100-word cinematic slot description
  const volatilityAdj = {
    low: 'steady',
    medium: 'balanced',
    high: 'high-volatility',
    extreme: 'explosive',
  }[mechanics.volatilityClass];

  const themeAdj = intentVector.thematicCluster.charAt(0).toUpperCase() + intentVector.thematicCluster.slice(1);

  // Core narrative skeleton
  const featureNames = mechanics.featureTriggers
    .map(f => f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
    .slice(0, 3);

  const bonusParts = mechanics.bonusLogic.split('_');
  const bonusName = bonusParts.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const openings = [
    `In a realm of ${analysis.interpretation}, the reels come alive with ${volatilityAdj} intensity.`,
    `${themeAdj} forces collide across the ${volatilityAdj} battlefield of spinning reels.`,
    `The ${analysis.interpretation} unfolds across reels pulsing with ${volatilityAdj} energy.`,
  ];
  const opening = openings[Math.floor(rng.next() * openings.length)];

  const middles = [
    `${featureNames[0] || 'Wild Symbols'} triggers chain reactions while ${featureNames[1] || 'Scatter Bonuses'} unlock hidden pathways.`,
    `As ${featureNames[0] || 'expanding wilds'} cascade, ${bonusName} mechanics drive escalating rewards.`,
    `${bonusName} activates through ${featureNames[0] || 'symbol collection'}, unleashing ${featureNames[1] || 'multiplier trails'} across the grid.`,
  ];
  const middle = middles[Math.floor(rng.next() * middles.length)];

  const closings = [
    `The experience blends ${volatilityAdj} action, cinematic spectacle, and escalating transformation sequences into a ${themeAdj.toLowerCase()} slot adventure.`,
    `Every spin drives toward cinematic climax — ${volatilityAdj} pacing meets ${themeAdj.toLowerCase()} storytelling in a deterministic spectacle.`,
    `Dynamic animations intensify as the ${themeAdj.toLowerCase()} narrative crescendos through ${volatilityAdj} reward cascades.`,
  ];
  const closing = closings[Math.floor(rng.next() * closings.length)];

  let narrative = `${opening} ${middle} ${closing}`;

  // Apply plugins
  for (const plugin of PLUGINS) {
    narrative = plugin.apply(narrative, mechanics, rng);
  }

  return narrative;
}

// ─── Explainability Generation ──────────────────────────────────────────────

function generateExplainability(
  intentVector: IntentVector,
  mechanics: SlotMechanics,
  poeticContent: RenderedContent,
): Explainability {
  const weights = {
    volatilityWeight: intentVector.conflictIntensity * 0.4 + intentVector.volatilitySignal * 0.6,
    bonusWeight: intentVector.volatilitySignal * 0.5 + intentVector.symbolicDensity * 0.5,
    featureWeight: intentVector.symbolicDensity * 0.6 + intentVector.contentComplexity * 0.4,
    poeticWeight: intentVector.aestheticIntensity * 0.5 + intentVector.contentComplexity * 0.5,
  };

  const dominant = Object.entries(weights).sort((a, b) => b[1] - a[1])[0];

  return {
    reasoning: `Intent vector mapped ${intentVector.thematicCluster} theme → ${mechanics.volatilityClass} volatility via ${mechanics.poeticStrategy} rendering. `
      + `Conflict intensity (${intentVector.conflictIntensity.toFixed(2)}) drove volatility class. `
      + `Symbolic density (${intentVector.symbolicDensity.toFixed(2)}) shaped feature complexity (${mechanics.featureTriggers.length} triggers).`,
    dominantIntent: dominant[0].replace('Weight', ''),
    weightSnapshot: weights,
    renderingPath: `narrative → intent_vector → mechanics → ${mechanics.poeticStrategy} → plugins → final_render`,
    poetryTechnique: poeticContent.poetryTechnique,
  };
}

// ─── Stored result type ─────────────────────────────────────────────────────

interface ForgeResult {
  id: string;
  input: string;
  seed: string;
  timestamp: number;
  narrativeAnalysis: NarrativeAnalysis;
  intentVector: IntentVector;
  mechanics: SlotMechanics;
  poeticContent: RenderedContent;
  finalNarrative: string;
  explainability: Explainability;
  pluginsApplied: string[];
}

// ─── Storage helpers ────────────────────────────────────────────────────────

const STORAGE_KEY = 'conceptforge_history';

function loadHistory(): ForgeResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(results: ForgeResult[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results.slice(0, 50)));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

const ConceptForge: React.FC = () => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'FAST' | 'FULL' | 'HYBRID'>('FULL');
  const [results, setResults] = useState<ForgeResult[]>(() => loadHistory());
  const [activeResult, setActiveResult] = useState<ForgeResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Pipeline execution ──────────────────────────────────────────────────

  const runPipeline = useCallback(() => {
    if (!input.trim()) return;
    setProcessing(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const timeBucket = SessionManager.getTimeBucket();

      // Stage 1: Session Seed Generation
      const sessionSeed = djb2Hash(JSON.stringify({ input, mode, timeBucket }));
      const rng = new DeterministicPRNG(sessionSeed);

      // Stage 2: Narrative Interpretation
      const narrativeAnalysis = interpretNarrative(input, rng);

      // Stage 3: Intent Vector Generation
      const narrativeInput: NarrativeInput = { input, timestamp };
      const intentVector = generateIntentVector(narrativeInput, sessionSeed);

      // Stage 4: Mechanic Mapping Engine
      const mechanicSeed = djb2Hash(`${sessionSeed}_mechanics`);
      const mechanics = mapMechanics(intentVector, mechanicSeed);

      // Stage 5: Poetry Abstraction Layer
      const renderer = new ContentRenderer();
      const poeticContent = renderer.render(mechanics, mechanics.poeticStrategy);

      // Stage 6 + 7: Plugin Augmentation + Final Narrative Rendering
      const finalNarrative = renderFinalNarrative(
        input, narrativeAnalysis, intentVector, mechanics, poeticContent, rng,
      );

      // Explainability
      const explainability = generateExplainability(intentVector, mechanics, poeticContent);

      const result: ForgeResult = {
        id: `cf_${sessionSeed}_${timestamp}`,
        input,
        seed: sessionSeed,
        timestamp,
        narrativeAnalysis,
        intentVector,
        mechanics,
        poeticContent,
        finalNarrative,
        explainability,
        pluginsApplied: PLUGINS.map(p => p.name),
      };

      const updated = [result, ...results].slice(0, 50);
      setResults(updated);
      setActiveResult(result);
      saveHistory(updated);
    } catch (err: any) {
      setError(err.message || 'Pipeline execution failed');
    } finally {
      setProcessing(false);
    }
  }, [input, mode, results]);

  // ── Styles (matching AGROS dark theme) ──────────────────────────────────

  const card = {
    background: '#12172B',
    borderRadius: 8,
    padding: 24,
    border: '1px solid #1E293B',
    marginBottom: 24,
  } as const;

  const label = {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 6,
  } as const;

  const badge = (color: string) => ({
    display: 'inline-block',
    fontSize: 10,
    color,
    background: `${color}22`,
    border: `1px solid ${color}44`,
    borderRadius: 10,
    padding: '2px 8px',
    fontFamily: 'JetBrains Mono, monospace',
    marginRight: 4,
    marginBottom: 4,
  } as const);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ color: '#22D3EE', fontFamily: 'JetBrains Mono, monospace', marginBottom: 4, marginTop: 0 }}>
            ConceptForge
          </h1>
          <p style={{ color: '#64748B', margin: 0, fontSize: 14 }}>
            Narrative Intent Compiler for Slot Mechanics (NIC-SM)
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #EF4444', borderRadius: 6, padding: '10px 16px', marginBottom: 16, color: '#FCA5A5', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Input Panel */}
        <div style={card}>
          <h2 style={{ color: '#94A3B8', fontSize: 14, marginTop: 0, marginBottom: 16 }}>Narrative Input</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runPipeline()}
              placeholder="Enter narrative concept (e.g. super Saiyans fight in the air)"
              style={{ flex: 1, minWidth: 280, background: '#0A0E1A', border: '1px solid #1E293B', borderRadius: 6, padding: '10px 14px', color: '#E2E8F0', fontSize: 14 }}
            />
            <select
              value={mode}
              onChange={e => setMode(e.target.value as any)}
              style={{ background: '#0A0E1A', border: '1px solid #1E293B', borderRadius: 6, padding: '10px 14px', color: '#E2E8F0', fontSize: 14 }}
            >
              <option value="FAST">FAST</option>
              <option value="FULL">FULL</option>
              <option value="HYBRID">HYBRID</option>
            </select>
            <button
              onClick={runPipeline}
              disabled={processing || !input.trim()}
              style={{
                padding: '10px 24px',
                background: processing ? '#1E293B' : '#22D3EE',
                color: '#0A0E1A',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                cursor: processing ? 'default' : 'pointer',
                fontSize: 14,
              }}
            >
              {processing ? 'Forging...' : 'Forge Concept'}
            </button>
          </div>
        </div>

        {/* Active Result */}
        {activeResult && (
          <>
            {/* Final Narrative */}
            <div style={card}>
              <h2 style={{ color: '#22D3EE', fontSize: 14, marginTop: 0, marginBottom: 12 }}>
                Cinematic Narrative
              </h2>
              <p style={{ color: '#E2E8F0', fontSize: 14, lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
                {activeResult.finalNarrative}
              </p>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={badge('#22D3EE')}>{activeResult.mechanics.volatilityClass} volatility</span>
                <span style={badge('#6366F1')}>{activeResult.intentVector.thematicCluster}</span>
                <span style={badge('#10B981')}>{activeResult.mechanics.poeticStrategy}</span>
                <span style={badge('#F59E0B')}>{activeResult.mechanics.featureTriggers.length} features</span>
              </div>
            </div>

            {/* Pipeline Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16, marginBottom: 24 }}>
              {/* Narrative Analysis (Stage 2) */}
              <div style={card}>
                <h3 style={{ color: '#94A3B8', fontSize: 12, marginTop: 0, marginBottom: 12 }}>
                  Stage 2 — Narrative Interpretation
                </h3>
                <div style={{ ...label }}>Interpretation</div>
                <div style={{ color: '#22D3EE', fontSize: 13, marginBottom: 12 }}>{activeResult.narrativeAnalysis.interpretation}</div>
                {Object.entries(activeResult.narrativeAnalysis).filter(([k]) => k !== 'interpretation').map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 6 }}>
                    <span style={{ ...label, display: 'inline' }}>{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                    <span style={{ color: '#CBD5E1', fontSize: 11 }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Intent Vector (Stage 3) */}
              <div style={card}>
                <h3 style={{ color: '#94A3B8', fontSize: 12, marginTop: 0, marginBottom: 12 }}>
                  Stage 3 — Intent Vector
                </h3>
                {Object.entries(activeResult.intentVector).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ ...label, margin: 0 }}>{key}</span>
                      <span style={{ color: '#22D3EE', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                        {typeof val === 'number' ? val.toFixed(3) : val}
                      </span>
                    </div>
                    {typeof val === 'number' && (
                      <div style={{ height: 4, background: '#1E293B', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${val * 100}%`, background: '#22D3EE', borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Mechanics (Stage 4) */}
              <div style={card}>
                <h3 style={{ color: '#94A3B8', fontSize: 12, marginTop: 0, marginBottom: 12 }}>
                  Stage 4 — Mechanic Mapping
                </h3>
                <div style={{ marginBottom: 8 }}>
                  <span style={label}>Volatility Class</span>
                  <div style={{ color: '#F59E0B', fontSize: 14, fontWeight: 600 }}>{activeResult.mechanics.volatilityClass.toUpperCase()}</div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={label}>Bonus Logic</span>
                  <div style={{ color: '#CBD5E1', fontSize: 12 }}>{activeResult.mechanics.bonusLogic.replace(/_/g, ' ')}</div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={label}>Payout Behavior</span>
                  <div style={{ color: '#CBD5E1', fontSize: 12 }}>{activeResult.mechanics.payoutBehavior.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <span style={label}>Feature Triggers</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {activeResult.mechanics.featureTriggers.map((f, i) => (
                      <span key={i} style={badge('#6366F1')}>{f.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Poetic Content (Stage 5) */}
              <div style={card}>
                <h3 style={{ color: '#94A3B8', fontSize: 12, marginTop: 0, marginBottom: 12 }}>
                  Stage 5 — Poetry Abstraction
                </h3>
                <div style={{ marginBottom: 8 }}>
                  <span style={label}>Type</span>
                  <div style={{ color: '#A78BFA', fontSize: 12 }}>{activeResult.poeticContent.type}</div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={label}>Technique</span>
                  <div style={{ color: '#CBD5E1', fontSize: 12 }}>{activeResult.poeticContent.poetryTechnique}</div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={label}>Entropy</span>
                  <div style={{ color: '#22D3EE', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
                    {activeResult.poeticContent.entropy.toFixed(4)}
                  </div>
                </div>
                <div>
                  <span style={label}>Rendered Output</span>
                  <div style={{ color: '#94A3B8', fontSize: 11, fontStyle: 'italic', background: '#0A0E1A', padding: 8, borderRadius: 4, maxHeight: 120, overflow: 'auto' }}>
                    {activeResult.poeticContent.content}
                  </div>
                </div>
              </div>
            </div>

            {/* Plugins Applied (Stage 6) */}
            <div style={card}>
              <h3 style={{ color: '#94A3B8', fontSize: 12, marginTop: 0, marginBottom: 12 }}>
                Stage 6 — Plugins Applied
              </h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {activeResult.pluginsApplied.map(name => (
                  <span key={name} style={badge('#10B981')}>{name}</span>
                ))}
              </div>
            </div>

            {/* Explainability */}
            <div style={card}>
              <h3 style={{ color: '#94A3B8', fontSize: 12, marginTop: 0, marginBottom: 12 }}>
                Explainability Trace
              </h3>
              <div style={{ marginBottom: 12 }}>
                <span style={label}>Reasoning</span>
                <div style={{ color: '#CBD5E1', fontSize: 12, lineHeight: 1.6 }}>{activeResult.explainability.reasoning}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={label}>Rendering Path</span>
                <div style={{ color: '#22D3EE', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                  {activeResult.explainability.renderingPath}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={label}>Dominant Intent</span>
                <span style={badge('#F59E0B')}>{activeResult.explainability.dominantIntent}</span>
              </div>
              <div>
                <span style={label}>Weight Snapshot</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  {Object.entries(activeResult.explainability.weightSnapshot).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B', fontSize: 11 }}>{k.replace('Weight', '')}</span>
                      <span style={{ color: '#22D3EE', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{v.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <span style={label}>Seed</span>
                <code style={{ color: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                  {activeResult.seed}
                </code>
              </div>
            </div>
          </>
        )}

        {/* History */}
        {results.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>
                Forge History ({results.length})
              </h2>
              <button
                onClick={() => { setResults([]); localStorage.removeItem(STORAGE_KEY); setActiveResult(null); }}
                style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 11 }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {results.map(r => (
                <div
                  key={r.id}
                  onClick={() => setActiveResult(r)}
                  style={{
                    background: activeResult?.id === r.id ? '#1E293B' : '#0A0E1A',
                    borderRadius: 6,
                    padding: 16,
                    border: `1px solid ${activeResult?.id === r.id ? '#22D3EE' : '#1E293B'}`,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ color: '#E2E8F0', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
                    "{r.input.length > 50 ? r.input.slice(0, 50) + '…' : r.input}"
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={badge('#22D3EE')}>{r.mechanics.volatilityClass}</span>
                    <span style={badge('#6366F1')}>{r.intentVector.thematicCluster}</span>
                  </div>
                  <div style={{ color: '#64748B', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>
                    {new Date(r.timestamp).toLocaleTimeString()} · seed: {r.seed.slice(0, 8)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConceptForge;
