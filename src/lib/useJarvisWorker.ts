import { useEffect, useRef, useState } from "react";
import type { JarvisWorkerResult, JarvisWorkerSettings } from "./jarvisWorker.js";

export const defaultJarvisSettings: JarvisWorkerSettings = {
  strength: 15,
  maxDepth: 3, // Fast 3-ply in Game Mode for zero-lag response (<30ms)
  thinkingTimeMs: 200,
  boardOverlay: true,
  tacticalRadar: true,
  commentary: true,
  openingBook: true,
  endgameKnowledge: true,
  autoMove: false,
  multiPV: 2
};

export function useJarvisWorker(fen?: string, isOwner = false, settings: Partial<JarvisWorkerSettings> = {}) {
  const mergedSettings = { ...defaultJarvisSettings, ...settings };
  const [result, setResult] = useState<JarvisWorkerResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const lastFenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOwner || !fen) {
      setResult(null);
      setIsCalculating(false);
      return;
    }

    // Deduplication: Do NOT recalculate if position has not changed!
    if (lastFenRef.current === fen && result) {
      return;
    }
    lastFenRef.current = fen;

    // Cancellation: Terminate running worker if position changes while thinking!
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    // Spawn isolated Web Worker
    try {
      const worker = new Worker(new URL("./jarvisWorker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<{ type: string; result: JarvisWorkerResult }>) => {
        if (e.data.type === "RESULT") {
          setResult(e.data.result);
          setIsCalculating(false);
        }
      };

      setIsCalculating(true);
      worker.postMessage({ type: "EVALUATE", fen, settings: mergedSettings });
    } catch {
      setIsCalculating(false);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [fen, isOwner, mergedSettings.strength, mergedSettings.maxDepth, mergedSettings.multiPV]);

  return { result, isCalculating, settings: mergedSettings };
}
