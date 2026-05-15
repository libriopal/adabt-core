import { createContext, useContext } from 'react';

export interface SabViews {
  heads: Uint32Array;
  data: Float32Array;
  capacity: number;
  mask: number;
}

export interface DSPContextValue {
  setFreq: (hz: number) => void;
  setGain: (g: number) => void;
  running: boolean;
  sabViews: SabViews | null;
}

export const DSPContext = createContext<DSPContextValue>({
  setFreq: () => {},
  setGain: () => {},
  running: false,
  sabViews: null,
});

export const useDSP = () => useContext(DSPContext);
