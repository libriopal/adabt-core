import { IntentVector, SlotMechanics, RenderedContent, DemandResult, Cache } from '../lib/types';

export class CacheManager {
  private cache: Cache;
  private static instance: CacheManager;

  private constructor() {
    this.cache = {
      themeCache: new Map(),
      intentVectorCache: new Map(),
      mechanicCache: new Map(),
      contentCache: new Map(),
      bypassCache: new Map(),
      demandCache: new Map(),
    };
    this.hydrateFromStorage();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  lookup(sessionSeed: string): any {
    return this.cache.themeCache.get(sessionSeed);
  }

  has(sessionSeed: string): boolean {
    return this.cache.themeCache.has(sessionSeed);
  }

  store(sessionSeed: string, data: any): void {
    this.cache.themeCache.set(sessionSeed, data);
    if (data.content) this.cache.contentCache.set(sessionSeed, data.content);
    if (data.intentVector) this.cache.intentVectorCache.set(sessionSeed, data.intentVector);
    if (data.mechanics) this.cache.mechanicCache.set(sessionSeed, data.mechanics);
    if (data.demandResult) this.cache.demandCache.set(sessionSeed, data.demandResult);
    this.persistToStorage();
  }

  getDemand(sessionSeed: string): DemandResult | undefined {
    return this.cache.demandCache.get(sessionSeed);
  }

  storeDemand(sessionSeed: string, result: DemandResult): void {
    this.cache.demandCache.set(sessionSeed, result);
    this.persistToStorage();
  }

  clear(): void {
    Object.values(this.cache).forEach((m: Map<any, any>) => m.clear());
    localStorage.removeItem('slotgpt_cache');
  }

  private persistToStorage(): void {
    try {
      localStorage.setItem('slotgpt_cache', JSON.stringify({
        themeCache: Array.from(this.cache.themeCache.entries()),
        demandCache: Array.from(this.cache.demandCache.entries()),
      }));
    } catch { /* quota exceeded or SSR */ }
  }

  private hydrateFromStorage(): void {
    try {
      const stored = localStorage.getItem('slotgpt_cache');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      parsed.themeCache?.forEach(([k, v]: [string, any]) => this.cache.themeCache.set(k, v));
      parsed.demandCache?.forEach(([k, v]: [string, DemandResult]) => this.cache.demandCache.set(k, v));
    } catch { /* corrupted data */ }
  }
}

export const cache = CacheManager.getInstance();
