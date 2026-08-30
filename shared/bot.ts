import { Chess } from "chess.js";
import type { BotLevel } from "./types.js";

interface SearchMove {
  from: string;
  to: string;
  promotion?: string;
  san?: string;
  flags?: string;
  captured?: string;
}

const pieceValues: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0
};

const centerSquares = new Set(["d4", "e4", "d5", "e5", "c3", "d3", "e3", "f3", "c6", "d6", "e6", "f6"]);

export function selectBotMove(fen: string, level: BotLevel, rng: () => number = Math.random): SearchMove | null {
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true }) as SearchMove[];
  if (legalMoves.length === 0) {
    return null;
  }

  if (level <= 2) {
    return chooseNoisyMove(chess, legalMoves, level, rng);
  }

  const depth = level >= 10 ? 3 : level >= 7 ? 2 : 1;
  const mistakeRate = level >= 10 ? 0 : Math.max(0.02, 0.34 - level * 0.035);

  if (rng() < mistakeRate) {
    return chooseFromTop(chess, legalMoves, Math.min(legalMoves.length, level <= 4 ? 6 : 4), rng);
  }

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestMoves: SearchMove[] = [];
  for (const move of orderMoves(legalMoves)) {
    const next = new Chess(fen);
    next.move(move);
    const score = -negamax(next, depth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, next.turn());
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  return bestMoves[Math.floor(rng() * bestMoves.length)] ?? legalMoves[0];
}

function chooseNoisyMove(chess: Chess, legalMoves: SearchMove[], level: BotLevel, rng: () => number): SearchMove {
  const captures = legalMoves.filter((move) => Boolean(move.captured));
  if (level === 2 && captures.length > 0 && rng() > 0.45) {
    return captures[Math.floor(rng() * captures.length)];
  }
  return chooseFromTop(chess, legalMoves, Math.min(legalMoves.length, 8), rng);
}

function chooseFromTop(chess: Chess, legalMoves: SearchMove[], count: number, rng: () => number): SearchMove {
  const scored = legalMoves
    .map((move) => ({ move, score: scoreMove(chess, move) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
  return scored[Math.floor(rng() * scored.length)]?.move ?? legalMoves[0];
}

function negamax(chess: Chess, depth: number, alpha: number, beta: number, turn: "w" | "b"): number {
  if (depth <= 0 || chess.isGameOver()) {
    return evaluate(chess, turn);
  }

  let best = Number.NEGATIVE_INFINITY;
  for (const move of orderMoves(chess.moves({ verbose: true }) as SearchMove[]).slice(0, depth >= 2 ? 18 : 40)) {
    chess.move(move);
    const score = -negamax(chess, depth - 1, -beta, -alpha, chess.turn());
    chess.undo();
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) {
      break;
    }
  }
  return best;
}

function evaluate(chess: Chess, perspective: "w" | "b"): number {
  if (chess.isCheckmate()) {
    return chess.turn() === perspective ? -100000 : 100000;
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return 0;
  }

  let score = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) {
        continue;
      }
      const value = pieceValues[piece.type] ?? 0;
      score += piece.color === perspective ? value : -value;
    }
  }

  if (chess.inCheck()) {
    score += chess.turn() === perspective ? -35 : 35;
  }

  score += chess.moves().length * (chess.turn() === perspective ? 0.12 : -0.12);

  return score;
}

function scoreMove(chess: Chess, move: SearchMove): number {
  let score = 0;
  if (move.captured) {
    score += pieceValues[move.captured] ?? 0;
  }
  if (move.promotion) {
    score += pieceValues[move.promotion] ?? 0;
  }
  if (centerSquares.has(move.to)) {
    score += 18;
  }
  chess.move(move);
  if (chess.inCheck()) {
    score += 35;
  }
  if (chess.isCheckmate()) {
    score += 100000;
  }
  chess.undo();
  return score;
}

function orderMoves(moves: SearchMove[]): SearchMove[] {
  return [...moves].sort((a, b) => Number(Boolean(b.captured)) - Number(Boolean(a.captured)));
}
