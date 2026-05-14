/**
 * worklet-global.d.ts — AudioWorkletGlobalScope type declarations.
 *
 * The AudioWorklet spec defines its own global scope with classes and
 * functions that are not part of the standard DOM lib.  This file provides
 * minimal type declarations so TypeScript can compile worklet processor
 * files without errors.
 *
 * These types only apply inside the AudioWorklet scope (dsp-worklet-processor.ts).
 * They supplement the DOM lib types already included via tsconfig.
 */

/* eslint-disable no-var */

/** The global AudioWorkletProcessor base class. */
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

/** Register a processor class with the AudioWorklet global scope. */
declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor,
): void;

/** The currentTime in the AudioWorklet scope. */
declare var currentTime: number;

/** The currentFrame in the AudioWorklet scope. */
declare var currentFrame: number;

/** The sampleRate in the AudioWorklet scope. */
declare var sampleRate: number;
