import { Chess, type Square } from "chess.js";
import type { GameAnalysisReport, SingleMoveAnalysis, MoveQuality } from "../../shared/types.js";

export interface JarvisAnalysis {
  evalScore: number;
  evalText: string;
  bestMove: { from: string; to: string; promotion?: string; san: string } | null;
  openingName: string;
  threats: string[];
  tactics: string[];
  commentary: string;
}

const pieceNames: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king"
};

const squareNames: Record<string, string> = {
  e4: "king's pawn square",
  d4: "queen's pawn square",
  c4: "bishop's file",
  f3: "kingside developing square",
  c3: "queenside developing square",
  d5: "central square d5",
  e5: "central square e5"
};

export function analyzeWithJarvis(fen: string): JarvisAnalysis {
  const chess = new Chess(fen);
  const turn = chess.turn();
  const sideName = turn === "w" ? "White" : "Black";
  const legalMoves = chess.moves({ verbose: true });

  if (legalMoves.length === 0) {
    const isCheck = chess.inCheck();
    return {
      evalScore: isCheck ? (turn === "w" ? -100 : 100) : 0,
      evalText: isCheck ? "Checkmate" : "Stalemate",
      bestMove: null,
      openingName: detectOpening(chess),
      threats: [],
      tactics: [isCheck ? "Game Over by Checkmate" : "Game Over by Stalemate"],
      commentary: isCheck ? `Sir, game over. Checkmate delivered.` : `Sir, game ended in a draw.`
    };
  }

  // 1. Calculate best move using 3-ply Minimax + Positional score
  let bestMoveObj: (typeof legalMoves)[0] | null = null;
  let maxScore = Number.NEGATIVE_INFINITY;

  for (const move of legalMoves) {
    chess.move(move);
    const score = -evaluatePosition(chess, 2, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, chess.turn());
    chess.undo();

    if (score > maxScore) {
      maxScore = score;
      bestMoveObj = move;
    }
  }

  // 2. Format Eval Text
  let evalText = "+0.0";
  const normalizedScore = (maxScore / 100).toFixed(1);
  if (Math.abs(maxScore) > 9000) {
    const movesToMate = Math.ceil((10000 - Math.abs(maxScore)) / 10);
    evalText = maxScore > 0 ? `M${movesToMate}` : `-M${movesToMate}`;
  } else {
    evalText = maxScore > 0 ? `+${normalizedScore}` : `${normalizedScore}`;
  }

  // 3. Detect Tactics & Threats
  const threats: string[] = [];
  const tactics: string[] = [];

  if (chess.inCheck()) {
    threats.push(`${sideName} king is currently in CHECK!`);
  }

  if (bestMoveObj) {
    if (bestMoveObj.captured) {
      tactics.push(`Capture opportunity: take ${pieceNames[bestMoveObj.captured] ?? "piece"} on ${bestMoveObj.to}`);
    }
    if (bestMoveObj.promotion) {
      tactics.push(`Pawn promotion available on ${bestMoveObj.to}`);
    }
  }

  // Detect forks or double attacks
  for (const move of legalMoves) {
    if (move.captured) {
      chess.move(move);
      const attacks = chess.moves({ verbose: true }).filter((m) => m.captured);
      chess.undo();
      if (attacks.length >= 2) {
        tactics.push(`Fork/Double attack threat available with ${move.san}`);
        break;
      }
    }
  }

  const openingName = detectOpening(chess);

  // 4. Generate J.A.R.V.I.S. Commentary
  let commentary = "Sir, position is balanced.";
  if (bestMoveObj) {
    const piece = pieceNames[bestMoveObj.piece] ?? "piece";
    const targetDesc = squareNames[bestMoveObj.to] ?? `square ${bestMoveObj.to}`;

    if (maxScore > 200) {
      commentary = `Sir, ${bestMoveObj.san} (${piece} to ${bestMoveObj.to}) grants an advantageous +${normalizedScore} position.`;
    } else if (bestMoveObj.captured) {
      commentary = `Sir, capturing the ${pieceNames[bestMoveObj.captured]} on ${bestMoveObj.to} secures tactical material advantage.`;
    } else if (chess.inCheck()) {
      commentary = `Sir, urgent: respond to check with ${bestMoveObj.san}.`;
    } else {
      commentary = `Sir, ${bestMoveObj.san} develops your ${piece} toward ${targetDesc} to strengthen central control.`;
    }
  }

  return {
    evalScore: maxScore,
    evalText,
    bestMove: bestMoveObj ? { from: bestMoveObj.from, to: bestMoveObj.to, promotion: bestMoveObj.promotion, san: bestMoveObj.san } : null,
    openingName,
    threats,
    tactics,
    commentary
  };
}

function evaluatePosition(chess: Chess, depth: number, alpha: number, beta: number, perspective: "w" | "b"): number {
  if (depth <= 0 || chess.isGameOver()) {
    return scoreBoard(chess, perspective);
  }

  let best = Number.NEGATIVE_INFINITY;
  const moves = chess.moves({ verbose: true });
  for (const move of moves) {
    chess.move(move);
    const score = -evaluatePosition(chess, depth - 1, -beta, -alpha, chess.turn());
    chess.undo();
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}

function scoreBoard(chess: Chess, perspective: "w" | "b"): number {
  if (chess.isCheckmate()) {
    return chess.turn() === perspective ? -10000 : 10000;
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return 0;
  }

  const pieceValues: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  let score = 0;

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const val = pieceValues[piece.type] ?? 0;
      score += piece.color === perspective ? val : -val;
    }
  }

  if (chess.inCheck()) {
    score += chess.turn() === perspective ? -30 : 30;
  }

  return score;
}

export function detectOpening(chess: Chess): string {
  const history = chess.history();
  if (history.length === 0) return "Starting Position";

  const moveStr = history.slice(0, 4).join(" ");
  if (moveStr.startsWith("e4 e5 Nf3 Nc6 Bb5")) return "Ruy Lopez (Spanish Opening)";
  if (moveStr.startsWith("e4 e5 Nf3 Nc6 Bc4")) return "Italian Game";
  if (moveStr.startsWith("e4 c5")) return "Sicilian Defense";
  if (moveStr.startsWith("e4 e6")) return "French Defense";
  if (moveStr.startsWith("e4 c6")) return "Caro-Kann Defense";
  if (moveStr.startsWith("d4 d5 c4")) return "Queen's Gambit";
  if (moveStr.startsWith("d4 Nf6 c4 g6")) return "King's Indian Defense";
  if (moveStr.startsWith("c4")) return "English Opening";
  if (moveStr.startsWith("Nf3")) return "Réti Opening";
  if (moveStr.startsWith("e4 e5")) return "Open Game (King's Pawn)";
  if (moveStr.startsWith("d4 d5")) return "Closed Game (Queen's Pawn)";

  return "Standard Opening Phase";
}

/** Full Game Post-Analysis Generator */
export function analyzeFullGame(moves: string[]): GameAnalysisReport {
  const chess = new Chess();
  const moveAnalyses: SingleMoveAnalysis[] = [];

  let whiteAccSum = 0;
  let blackAccSum = 0;
  let whiteCount = 0;
  let blackCount = 0;

  let wBlunders = 0, bBlunders = 0;
  let wMistakes = 0, bMistakes = 0;

  for (let i = 0; i < moves.length; i++) {
    const san = moves[i];
    const fenBefore = chess.fen();
    const side = chess.turn() === "w" ? "white" : "black";

    const jarvisBefore = analyzeWithJarvis(fenBefore);
    const made = chess.move(san);
    const fenAfter = chess.fen();
    const jarvisAfter = analyzeWithJarvis(fenAfter);

    const evalBefore = jarvisBefore.evalScore;
    const evalAfter = -jarvisAfter.evalScore;
    const diff = evalAfter - evalBefore;

    let quality: MoveQuality = "best";
    let explanation = "Solid positional move.";

    if (diff < -300) {
      quality = "blunder";
      explanation = `Blunder! Dropped advantage by ${(Math.abs(diff) / 100).toFixed(1)} points.`;
      if (side === "white") wBlunders++; else bBlunders++;
    } else if (diff < -150) {
      quality = "mistake";
      explanation = `Mistake. Overlooked a stronger tactical move.`;
      if (side === "white") wMistakes++; else bMistakes++;
    } else if (diff < -60) {
      quality = "inaccuracy";
      explanation = `Inaccuracy. Slightly weaker than optimal continuation.`;
    } else if (diff > 50) {
      quality = "great";
      explanation = `Great move! Expanded position advantage.`;
    } else if (jarvisBefore.bestMove?.san === san) {
      quality = "best";
      explanation = `Best move found by calculation!`;
    }

    const moveAcc = Math.max(0, Math.min(100, 100 + diff * 0.25));
    if (side === "white") {
      whiteAccSum += moveAcc;
      whiteCount++;
    } else {
      blackAccSum += moveAcc;
      blackCount++;
    }

    moveAnalyses.push({
      moveNumber: Math.floor(i / 2) + 1,
      playerSide: side,
      san,
      fenBefore,
      fenAfter,
      quality,
      evalBefore,
      evalAfter,
      bestMoveSan: jarvisBefore.bestMove?.san,
      explanation
    });
  }

  const whiteAccuracy = whiteCount > 0 ? Math.round(whiteAccSum / whiteCount) : 100;
  const blackAccuracy = blackCount > 0 ? Math.round(blackAccSum / blackCount) : 100;

  return {
    gameId: "analysis-" + Date.now(),
    whiteAccuracy,
    blackAccuracy,
    whiteBlunders: wBlunders,
    blackBlunders: bBlunders,
    whiteMistakes: wMistakes,
    blackMistakes: bMistakes,
    moves: moveAnalyses
  };
}
