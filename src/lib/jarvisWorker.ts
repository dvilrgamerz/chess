import { Chess, type Square } from "chess.js";

export interface JarvisWorkerSettings {
  strength: number; // 1-20
  maxDepth: number; // 1-20
  thinkingTimeMs: number; // 100 - 30000
  boardOverlay: boolean;
  tacticalRadar: boolean;
  commentary: boolean;
  openingBook: boolean;
  endgameKnowledge: boolean;
  autoMove: boolean;
  multiPV: number; // 1-5
}

export interface CandidateLine {
  san: string;
  evalText: string;
  score: number;
}

export interface JarvisWorkerResult {
  evalScore: number;
  evalText: string;
  bestMove: { from: string; to: string; promotion?: string; san: string } | null;
  candidateLines: CandidateLine[];
  openingName: string;
  threats: string[];
  tactics: string[];
  commentary: string;
  calcTimeMs: number;
}

// Piece-Square Evaluation Tables
const pawnPST = [
  0,  0,  0,  0,  0,  0,  0,  0,
 50, 50, 50, 50, 50, 50, 50, 50,
 10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 27, 27, 10,  5,  5,
  0,  0,  0, 24, 24,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-25,-25, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

const knightPST = [
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  5, 15, 20, 20, 15,  5,-30,
 -30,  0, 15, 20, 20, 15,  0,-30,
 -30,  5, 10, 15, 15, 10,  5,-30,
 -40,-20,  0,  5,  5,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50
];

const bishopPST = [
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5, 10, 10,  5,  0,-10,
 -10,  5,  5, 10, 10,  5,  5,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10, 10, 10, 10, 10, 10, 10,-10,
 -10,  5,  0,  0,  0,  0,  5,-10,
 -20,-10,-10,-10,-10,-10,-10,-20
];

const rookPST = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
];

const queenPST = [
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
   0,  0,  5,  5,  5,  5,  0, -5,
 -10,  5,  5,  5,  5,  5,  0,-10,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20
];

const kingMiddlePST = [
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -20,-30,-30,-40,-40,-30,-30,-20,
 -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20
];

const pieceValues: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

self.onmessage = (event: MessageEvent<{ type: string; fen: string; settings: JarvisWorkerSettings }>) => {
  if (event.data.type === "EVALUATE") {
    const startTime = performance.now();
    const result = evaluatePositionDeep(event.data.fen, event.data.settings);
    result.calcTimeMs = Math.round(performance.now() - startTime);
    self.postMessage({ type: "RESULT", result });
  }
};

function evaluatePositionDeep(fen: string, settings: JarvisWorkerSettings): JarvisWorkerResult {
  const chess = new Chess(fen);
  const turn = chess.turn();
  const sideName = turn === "w" ? "White" : "Black";
  const legalMoves = chess.moves({ verbose: true });

  if (legalMoves.length === 0) {
    const isCheck = chess.inCheck();
    return {
      evalScore: isCheck ? (turn === "w" ? -10000 : 10000) : 0,
      evalText: isCheck ? "Checkmate" : "Stalemate",
      bestMove: null,
      candidateLines: [],
      openingName: detectOpeningBook(chess),
      threats: [],
      tactics: [isCheck ? "Checkmate delivered" : "Stalemate draw"],
      commentary: isCheck ? "Sir, position is checkmate." : "Sir, position is stalemate.",
      calcTimeMs: 0
    };
  }

  // Determine search depth based on settings
  const depth = Math.min(settings.maxDepth, settings.strength >= 18 ? 5 : settings.strength >= 10 ? 3 : 2);
  const candidates: CandidateLine[] = [];

  let bestMoveObj: (typeof legalMoves)[0] | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  // Search moves with Alpha-Beta Pruning + Quiescence Search
  for (const move of legalMoves) {
    chess.move(move);
    const score = -alphaBeta(chess, depth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, chess.turn(), settings);
    chess.undo();

    const evalText = score > 0 ? `+${(score / 100).toFixed(1)}` : `${(score / 100).toFixed(1)}`;
    candidates.push({ san: move.san, evalText, score });

    if (score > bestScore) {
      bestScore = score;
      bestMoveObj = move;
    }
  }

  // Sort candidate lines for Multi-PV
  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, settings.multiPV ?? 3);

  // Format Eval Score & Text
  let evalText = "+0.0";
  const normScore = (bestScore / 100).toFixed(1);
  if (Math.abs(bestScore) > 9000) {
    const mateIn = Math.ceil((10000 - Math.abs(bestScore)) / 2);
    evalText = bestScore > 0 ? `M${mateIn}` : `-M${mateIn}`;
  } else {
    evalText = bestScore > 0 ? `+${normScore}` : `${normScore}`;
  }

  // Tactical Radar & Threat Detection
  const threats: string[] = [];
  const tactics: string[] = [];

  if (chess.inCheck()) {
    threats.push(`${sideName} king is currently in CHECK!`);
  }

  if (bestMoveObj) {
    if (bestMoveObj.captured) {
      tactics.push(`Capture ${bestMoveObj.captured.toUpperCase()} on ${bestMoveObj.to}`);
    }
    if (bestMoveObj.promotion) {
      tactics.push(`Pawn promotion available on ${bestMoveObj.to}`);
    }
    if (bestMoveObj.san.includes("+")) {
      tactics.push(`Check threat: ${bestMoveObj.san}`);
    }
  }

  const openingName = settings.openingBook ? detectOpeningBook(chess) : "Opening Book OFF";

  // Generate Voice Commentary
  let commentary = "Sir, position is balanced.";
  if (bestMoveObj) {
    if (bestScore > 250) {
      commentary = `Sir, ${bestMoveObj.san} grants a decisive advantage of ${evalText}.`;
    } else if (bestMoveObj.captured) {
      commentary = `Sir, capturing on ${bestMoveObj.to} wins material advantage.`;
    } else if (chess.inCheck()) {
      commentary = `Sir, escape check immediately with ${bestMoveObj.san}.`;
    } else {
      commentary = `Sir, ${bestMoveObj.san} strengthens central control and piece mobility.`;
    }
  }

  return {
    evalScore: bestScore,
    evalText,
    bestMove: bestMoveObj
      ? { from: bestMoveObj.from, to: bestMoveObj.to, promotion: bestMoveObj.promotion, san: bestMoveObj.san }
      : null,
    candidateLines: topCandidates,
    openingName,
    threats,
    tactics,
    commentary,
    calcTimeMs: 0
  };
}

function alphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  perspective: "w" | "b",
  settings: JarvisWorkerSettings
): number {
  if (depth <= 0 || chess.isGameOver()) {
    return quiescenceSearch(chess, alpha, beta, perspective, 2);
  }

  let best = Number.NEGATIVE_INFINITY;
  const moves = chess.moves({ verbose: true });

  // Move ordering: captures first
  moves.sort((a, b) => (b.captured ? 10 : 0) - (a.captured ? 10 : 0));

  for (const move of moves) {
    chess.move(move);
    const score = -alphaBeta(chess, depth - 1, -beta, -alpha, chess.turn(), settings);
    chess.undo();

    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) {
      break; // Cut-off
    }
  }
  return best;
}

function quiescenceSearch(chess: Chess, alpha: number, beta: number, perspective: "w" | "b", qDepth: number): number {
  const standPat = scoreBoardFull(chess, perspective);
  if (qDepth <= 0 || chess.isGameOver()) {
    return standPat;
  }
  if (standPat >= beta) return beta;
  if (alpha < standPat) alpha = standPat;

  const captures = chess.moves({ verbose: true }).filter((m) => Boolean(m.captured));
  for (const capture of captures) {
    chess.move(capture);
    const score = -quiescenceSearch(chess, -beta, -alpha, chess.turn(), qDepth - 1);
    chess.undo();

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function scoreBoardFull(chess: Chess, perspective: "w" | "b"): number {
  if (chess.isCheckmate()) {
    return chess.turn() === perspective ? -10000 : 10000;
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const baseVal = pieceValues[piece.type] ?? 0;
      const idx = r * 8 + c;
      const flippedIdx = (7 - r) * 8 + c;

      let pstVal = 0;
      const isWhite = piece.color === "w";

      switch (piece.type) {
        case "p": pstVal = pawnPST[isWhite ? flippedIdx : idx]; break;
        case "n": pstVal = knightPST[isWhite ? flippedIdx : idx]; break;
        case "b": pstVal = bishopPST[isWhite ? flippedIdx : idx]; break;
        case "r": pstVal = rookPST[isWhite ? flippedIdx : idx]; break;
        case "q": pstVal = queenPST[isWhite ? flippedIdx : idx]; break;
        case "k": pstVal = kingMiddlePST[isWhite ? flippedIdx : idx]; break;
      }

      const totalPieceVal = baseVal + pstVal;
      score += piece.color === perspective ? totalPieceVal : -totalPieceVal;
    }
  }

  // King safety & mobility bonus
  if (chess.inCheck()) {
    score += chess.turn() === perspective ? -35 : 35;
  }

  return score;
}

function detectOpeningBook(chess: Chess): string {
  const history = chess.history();
  if (history.length === 0) return "Starting Position";

  const moveStr = history.slice(0, 4).join(" ");
  if (moveStr.startsWith("e4 e5 Nf3 Nc6 Bb5")) return "Ruy Lopez";
  if (moveStr.startsWith("e4 e5 Nf3 Nc6 Bc4")) return "Italian Game";
  if (moveStr.startsWith("e4 c5")) return "Sicilian Defense";
  if (moveStr.startsWith("e4 e6")) return "French Defense";
  if (moveStr.startsWith("e4 c6")) return "Caro-Kann Defense";
  if (moveStr.startsWith("d4 d5 c4")) return "Queen's Gambit";
  if (moveStr.startsWith("d4 Nf6 c4 g6")) return "King's Indian Defense";
  if (moveStr.startsWith("c4")) return "English Opening";
  if (moveStr.startsWith("e4 e5")) return "King's Pawn Game";
  if (moveStr.startsWith("d4 d5")) return "Queen's Pawn Game";

  return "Middlegame Theory";
}
