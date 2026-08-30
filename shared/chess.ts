import { Chess } from "chess.js";
import type { GameEndReason, GameResult, LastMove, Side } from "./types.js";

export function sideFromTurn(turn: "w" | "b"): Side {
  return turn === "w" ? "white" : "black";
}

export function turnFromSide(side: Side): "w" | "b" {
  return side === "white" ? "w" : "b";
}

export function oppositeSide(side: Side): Side {
  return side === "white" ? "black" : "white";
}

export function getLastMove(chess: Chess): LastMove | undefined {
  const history = chess.history({ verbose: true });
  const last = history.at(-1);
  if (!last) {
    return undefined;
  }
  return {
    from: last.from,
    to: last.to,
    san: last.san
  };
}

export function getGameResult(chess: Chess): { result: GameResult; reason: GameEndReason } | null {
  if (!chess.isGameOver()) {
    return null;
  }
  if (chess.isCheckmate()) {
    return {
      result: sideFromTurn(chess.turn()) === "white" ? "black" : "white",
      reason: "checkmate"
    };
  }
  if (chess.isStalemate()) {
    return { result: "draw", reason: "stalemate" };
  }
  return { result: "draw", reason: "draw" };
}

export function getCapturedPieces(chess: Chess): { white: string[]; black: string[] } {
  const captured = { white: [] as string[], black: [] as string[] };
  for (const move of chess.history({ verbose: true })) {
    if (!move.captured) {
      continue;
    }
    const capturedSide = move.color === "w" ? "black" : "white";
    captured[capturedSide].push(move.captured);
  }
  return captured;
}

export function tryMove(chess: Chess, from: string, to: string, promotion = "q") {
  try {
    return chess.move({ from, to, promotion });
  } catch {
    return null;
  }
}
