import { selectBotMove } from "../../shared/bot.js";
import type { BotLevel } from "../../shared/types.js";

self.onmessage = (event: MessageEvent<{ fen: string; level: BotLevel }>) => {
  const { fen, level } = event.data;
  const move = selectBotMove(fen, level);
  self.postMessage({ move });
};
