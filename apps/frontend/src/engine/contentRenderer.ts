import { SlotMechanics, RenderedContent } from '../lib/types';
import { SessionManager } from '../utils/session';

export class ContentRenderer {
  private conceitMap: Record<string, string>;

  constructor() {
    this.conceitMap = {
      love: 'Fusion_Reactor',
      pain: 'Thermal_Overflow',
      fear: 'System_Breach',
      death: 'Process_Termination',
      heart: 'Primary_Engine',
      soul: 'Core_Matrix',
      blood: 'Lubricant_System',
      war: 'Resource_Conflict',
      peace: 'Equilibrium_State',
      chaos: 'Entropy_Maximum',
    };
  }

  render(mechanics: SlotMechanics, strategy: string): RenderedContent {
    switch (strategy) {
      case 'encodedVerse': return this.renderEncodedVerse(mechanics);
      case 'symbolic': return this.renderSymbolicPoetry(mechanics);
      case 'abstract': return this.renderAbstractPoetry(mechanics);
      case 'literal':
      default: return this.renderLiteral(mechanics);
    }
  }

  private renderLiteral(mechanics: SlotMechanics): RenderedContent {
    const content = `System: ${mechanics.volatilityClass} volatility | ${mechanics.bonusLogic} | Features: ${mechanics.featureTriggers.join(', ')}`;
    return { type: 'literal', content, entropy: this.calculateEntropy(content), poetryTechnique: 'none' };
  }

  private renderSymbolicPoetry(mechanics: SlotMechanics): RenderedContent {
    let content = `The ${mechanics.volatilityClass} tides of fortune`;
    content += `, where ${mechanics.bonusLogic.replace(/_/g, ' ')} manifests`;
    content += ` through ${mechanics.featureTriggers[0]?.replace(/_/g, ' ') || 'mystery'}.`;

    const subtracted = this.semanticSubtraction(content);
    const fibonacci = this.fibonacciDistortion(subtracted);
    const finalContent = fibonacci.join(' / ');

    return {
      type: 'symbolic',
      content: finalContent,
      entropy: this.calculateEntropy(finalContent),
      poetryTechnique: 'semantic_subtraction + fibonacci_distortion',
      fibonacciFragments: fibonacci,
    };
  }

  private renderAbstractPoetry(mechanics: SlotMechanics): RenderedContent {
    const symbols = ['◈', '◉', '◆', '▣', '◊', '⚉', '⚛'];
    const fragments = mechanics.featureTriggers.map((f, i) =>
      `${symbols[i % symbols.length]} ${f.charAt(0).toUpperCase() + f.slice(1, 3)}`,
    );
    const content = fragments.join(' ⟁ ');
    const conceit = this.generateConceit(content);
    return { type: 'abstract', content: conceit, entropy: this.calculateEntropy(conceit), poetryTechnique: 'metaphysical_conceit + glyph_substitution' };
  }

  private renderEncodedVerse(mechanics: SlotMechanics): RenderedContent {
    const encoded = this.encodeMechanics(mechanics);
    let processed = this.semanticSubtraction(encoded);
    const fibonacci = this.fibonacciDistortion(processed);
    const conceit = this.generateConceit(fibonacci.join(' ⇄ '));
    const verseKey = `KEY_${SessionManager.getTimeBucket()}_${Math.floor(Date.now() / 1000)}`;

    return {
      type: 'encodedVerse',
      content: conceit,
      entropy: this.calculateEntropy(conceit),
      poetryTechnique: 'full_pipeline: subtraction → distortion → conceit',
      verseKey,
    };
  }

  calculateEntropy(text: string): number {
    const freq = [...text].reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {} as Record<string, number>);
    const len = text.length;
    if (len === 0) return 0;
    return Object.values(freq).reduce((sum, f) => {
      const p = f / len;
      return sum - p * Math.log2(p);
    }, 0);
  }

  semanticSubtraction(text: string): string {
    const tokens = Object.keys(this.conceitMap);
    return text.split(/\s+/).map(word => {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      return tokens.includes(clean) ? `[${this.conceitMap[clean]}]` : word;
    }).join(' ');
  }

  fibonacciDistortion(text: string): string[] {
    const words = text.split(/\s+/);
    const fib = [1, 1];
    const result: string[] = [];
    let start = 0;
    while (start < words.length) {
      const count = fib[fib.length - 1];
      const slice = words.slice(start, start + count);
      if (slice.length > 0) result.push(slice.join(' '));
      start += count;
      fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
      if (fib[fib.length - 1] > words.length * 2) break;
    }
    return result;
  }

  generateConceit(intent: string, customMap?: Record<string, string>): string {
    const map = customMap || this.conceitMap;
    let output = intent;
    Object.entries(map).forEach(([key, val]) => {
      output = output.replace(new RegExp(`\\b${key}\\b`, 'gi'), val);
    });
    return `Apparatus Status: ${output} [SYSTEM: ONLINE]`;
  }

  private encodeMechanics(mechanics: SlotMechanics): string {
    const glyph = { low: '▽', medium: '◐', high: '◑', extreme: '▲' }[mechanics.volatilityClass];
    return `${glyph} ${mechanics.bonusLogic} [${mechanics.featureTriggers.join('|')}] ${mechanics.payoutBehavior}`;
  }

  setConceitMap(map: Record<string, string>): void {
    this.conceitMap = { ...this.conceitMap, ...map };
  }
}

export function renderPoeticContent(mechanics: SlotMechanics): RenderedContent {
  return new ContentRenderer().render(mechanics, mechanics.poeticStrategy);
}
