import { Chess } from "chess.js";
import type { GameEndReason, GameRecord, GameResult, GameMode, LastMove, PlayerSeat, Side, TimeControl } from "../../shared/types.js";

const startingPieces: Record<string, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1
};

export const pieceSymbols: Record<string, Record<string, string>> = {
  classic: {
    wp: "♙",
    wn: "♘",
    wb: "♗",
    wr: "♖",
    wq: "♕",
    wk: "♔",
    bp: "♟",
    bn: "♞",
    bb: "♝",
    br: "♜",
    bq: "♛",
    bk: "♚"
  },
  neo: {
    wp: "♙",
    wn: "♘",
    wb: "♗",
    wr: "♖",
    wq: "♕",
    wk: "♔",
    bp: "♟",
    bn: "♞",
    bb: "♝",
    br: "♜",
    bq: "♛",
    bk: "♚"
  },
  letters: {
    wp: "P",
    wn: "N",
    wb: "B",
    wr: "R",
    wq: "Q",
    wk: "K",
    bp: "p",
    bn: "n",
    bb: "b",
    br: "r",
    bq: "q",
    bk: "k"
  }
};

export function capturedFromFen(fen: string) {
  const chess = new Chess(fen);
  const counts = {
    white: { ...startingPieces },
    black: { ...startingPieces }
  };

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.type === "k") {
        continue;
      }
      const side = piece.color === "w" ? "white" : "black";
      counts[side][piece.type] -= 1;
    }
  }

  return {
    white: expandMissing(counts.white),
    black: expandMissing(counts.black)
  };
}

export function buildGameRecord(params: {
  id: string;
  mode: GameMode;
  timeControl?: TimeControl;
  white: PlayerSeat;
  black: PlayerSeat;
  result: GameResult;
  reason: GameEndReason;
  moves: string[];
  finalFen: string;
  startedAt: string;
}): GameRecord {
  const endedAt = new Date().toISOString();
  return {
    id: params.id,
    mode: params.mode,
    timeControl: params.timeControl,
    players: {
      white: params.white,
      black: params.black
    },
    result: params.result,
    reason: params.reason,
    moves: params.moves,
    finalFen: params.finalFen,
    startedAt: params.startedAt,
    endedAt,
    durationMs: new Date(endedAt).getTime() - new Date(params.startedAt).getTime()
  };
}

export function formatResult(result?: GameResult, reason?: GameEndReason) {
  if (!result) {
    return "In progress";
  }
  const label = result === "draw" ? "Draw" : result === "abandoned" ? "Abandoned" : `${title(result)} wins`;
  return reason ? `${label} by ${reason}` : label;
}

export function title(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function sameMove(a?: LastMove, square?: string) {
  return Boolean(a && square && (a.from === square || a.to === square));
}

function expandMissing(counts: Record<string, number>) {
  const order = ["q", "r", "b", "n", "p"];
  return order.flatMap((piece) => Array.from({ length: Math.max(0, startingPieces[piece] - counts[piece]) }, () => piece));
}
