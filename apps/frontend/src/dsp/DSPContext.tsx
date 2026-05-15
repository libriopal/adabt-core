import { createContext, useContext } from 'react';

export interface SabViews {
  heads: Uint32Array;
  data: Float32Array;
  capacity: number;
  mask: number;
}

export interface DSPContextValue {
  /** Update frequency — syncs React state + worker (use for UI controls). */
  setFreq: (hz: number) => void;
  /** Update gain — syncs React state + worker (use for UI controls). */
  setGain: (g: number) => void;
  /** Hot-path frequency setter — worker-only, no React re-render (use in game loops). */
  setFreqHot: (hz: number) => void;
  /** Hot-path gain setter — worker-only, no React re-render (use in game loops). */
  setGainHot: (g: number) => void;
  running: boolean;
  sabViews: SabViews | null;
}

export const DSPContext = createContext<DSPContextValue>({
  setFreq: () => {},
  setGain: () => {},
  setFreqHot: () => {},
  setGainHot: () => {},
  running: false,
  sabViews: null,
});

export const useDSP = () => useContext(DSPContext);
