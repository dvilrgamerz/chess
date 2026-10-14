import { selectBotMove } from "../../shared/bot.js";
import type { BotLevel } from "../../shared/types.js";

interface BotSearchRequest {
  requestId: number;
  fen: string;
  level: BotLevel;
}

self.onmessage = (event: MessageEvent<BotSearchRequest>) => {
  const { requestId, fen, level } = event.data;
  // The calculation runs only on this worker, never on the UI thread.
  // The caller discards late results from previous positions.
  const move = selectBotMove(fen, level);
  self.postMessage({ requestId, move });
};
