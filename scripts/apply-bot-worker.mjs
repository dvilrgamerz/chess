import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.tsx");
let source = fs.readFileSync(appPath, "utf8");

if (!source.includes('import { useBotWorker } from "./lib/useBotWorker.js";')) {
  source = source.replace(
    'import { GameClock } from "./components/GameClock.js";\n',
    'import { GameClock } from "./components/GameClock.js";\nimport { useBotWorker } from "./lib/useBotWorker.js";\n'
  );
}

source = source.replace('import { selectBotMove } from "../shared/bot.js";\n', "");

const oldBlock = `  useEffect(() => {\n    if (outcome || turn === playerColor || chess.isGameOver() || botThinkingRef.current) {\n      return;\n    }\n    botThinkingRef.current = true;\n\n    const timer = window.setTimeout(() => {\n      const active = new Chess(fen);\n      const move = selectBotMove(active.fen(), level);\n      if (move) {\n        const made = active.move(move);\n        const nextMoves = [...moves, made.san];\n        setFen(active.fen());\n        setMoves(nextMoves);\n        setLastMove({ from: made.from, to: made.to, san: made.san });\n\n        const soundType = detectMoveSound(active, made.from, made.to);\n        playSound(soundType, user.settings);\n\n        const result = getGameResult(active);\n        if (result) {\n          finishGame(result.result, result.reason, active.fen(), nextMoves);\n        }\n      }\n      botThinkingRef.current = false;\n    }, user.settings.botDelayMs);\n\n    return () => {\n      window.clearTimeout(timer);\n      botThinkingRef.current = false;\n    };\n  }, [fen, outcome, turn, playerColor, level, user.settings.botDelayMs]);`;

const newBlock = `  const botEnabled = !outcome && turn !== playerColor && !chess.isGameOver();\n  const { move: workerMove, thinking: workerThinking } = useBotWorker(fen, level, botEnabled);\n\n  useEffect(() => {\n    botThinkingRef.current = workerThinking;\n  }, [workerThinking]);\n\n  useEffect(() => {\n    if (!workerMove || !botEnabled) return;\n\n    const timer = window.setTimeout(() => {\n      const active = new Chess(fen);\n      if (active.turn() === (playerColor === "white" ? "w" : "b") || active.isGameOver()) return;\n\n      const made = active.move(workerMove);\n      if (!made) return;\n\n      const nextMoves = [...moves, made.san];\n      setFen(active.fen());\n      setMoves(nextMoves);\n      setLastMove({ from: made.from, to: made.to, san: made.san });\n\n      const soundType = detectMoveSound(active, made.from, made.to);\n      playSound(soundType, user.settings);\n\n      const result = getGameResult(active);\n      if (result) {\n        finishGame(result.result, result.reason, active.fen(), nextMoves);\n      }\n    }, user.settings.botDelayMs);\n\n    return () => window.clearTimeout(timer);\n  }, [workerMove, botEnabled, fen, moves, playerColor, user.settings.botDelayMs]);`;

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
} else if (!source.includes("useBotWorker(fen, level, botEnabled)")) {
  throw new Error("BotGame search block was not found; refusing to modify App.tsx");
}

fs.writeFileSync(appPath, source);
console.log("Chess Arena: BotGame now uses the Web Worker for bot search.");
