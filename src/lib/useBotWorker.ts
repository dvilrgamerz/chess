import { useEffect, useRef, useState } from "react";
import type { BotLevel } from "../../shared/types.js";

type BotMove = { from: string; to: string; promotion?: string; san?: string } | null;

/** Runs bot search off the React/main thread so board input and animation stay responsive. */
export function useBotWorker(fen: string, level: BotLevel, enabled = true) {
  const [move, setMove] = useState<BotMove>(null);
  const [thinking, setThinking] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || !fen) {
      setMove(null);
      setThinking(false);
      return;
    }

    workerRef.current?.terminate();
    const worker = new Worker(new URL("./botWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    let cancelled = false;

    setMove(null);
    setThinking(true);

    worker.onmessage = (event: MessageEvent<{ move: BotMove }>) => {
      if (cancelled) return;
      setMove(event.data.move);
      setThinking(false);
    };

    worker.onerror = () => {
      if (cancelled) return;
      setThinking(false);
    };

    worker.postMessage({ fen, level });

    return () => {
      cancelled = true;
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [fen, level, enabled]);

  return { move, thinking };
}
