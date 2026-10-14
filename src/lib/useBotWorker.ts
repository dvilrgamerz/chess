import { useEffect, useRef, useState } from "react";
import type { BotLevel } from "../../shared/types.js";

type BotMove = { from: string; to: string; promotion?: string; san?: string } | null;
type BotResponse = { requestId: number; move: BotMove };

interface BotSearchResult {
  fen: string;
  level: BotLevel;
  gameId: string;
  move: BotMove;
  startedAt: number;
}

/**
 * Keep an idle Web Worker ready between bot turns. Terminate it only when a
 * calculation is superseded, so stale searches cannot monopolize the worker.
 * Results are tied to the exact FEN and level, never to a previous game.
 */
export function useBotWorker(fen: string, level: BotLevel, enabled = true, gameId = "") {
  const [result, setResult] = useState<BotSearchResult | null>(null);
  const [thinking, setThinking] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Invalidate late messages on every position/difficulty change.
    const requestId = ++requestIdRef.current;
    if (pendingRef.current) {
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRef.current = false;
    }
    if (!enabled || !fen) {
      setResult(null);
      setThinking(false);
      return;
    }

    let worker = workerRef.current;
    if (!worker) {
      try {
        worker = new Worker(new URL("./botWorker.ts", import.meta.url), { type: "module" });
        workerRef.current = worker;
      } catch {
        setResult(null);
        setThinking(false);
        return;
      }
    }

    const startedAt = Date.now();
    setResult(null);
    setThinking(true);
    pendingRef.current = true;

    worker.onmessage = (event: MessageEvent<BotResponse>) => {
      if (requestIdRef.current !== requestId || event.data.requestId !== requestId) return;
      pendingRef.current = false;
      setResult({ fen, level, gameId, move: event.data.move, startedAt });
      setThinking(false);
    };
    worker.onerror = () => {
      if (requestIdRef.current !== requestId) return;
      pendingRef.current = false;
      workerRef.current?.terminate();
      workerRef.current = null;
      setResult(null);
      setThinking(false);
    };

    worker.postMessage({ fen, level, requestId });

    return () => {
      // The idle worker is reusable; interrupt only unfinished calculations.
      requestIdRef.current += 1;
      if (pendingRef.current) {
        workerRef.current?.terminate();
        workerRef.current = null;
        pendingRef.current = false;
      }
    };
  }, [fen, level, enabled, gameId]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const currentResult = enabled && result?.fen === fen && result?.level === level && result.gameId === gameId ? result : null;
  return {
    move: currentResult?.move ?? null,
    startedAt: currentResult?.startedAt ?? null,
    thinking
  };
}
