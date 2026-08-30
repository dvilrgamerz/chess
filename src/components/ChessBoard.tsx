import React, { useCallback, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { sideFromTurn } from "../../shared/chess.js";
import type { BoardTheme, LastMove, PieceStyle, Side } from "../../shared/types.js";
import { pieceSymbols, sameMove } from "../lib/chessDisplay.js";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

interface ChessBoardProps {
  fen: string;
  orientation: Side;
  theme: BoardTheme;
  pieceStyle: PieceStyle;
  legalHints: boolean;
  lastMove?: LastMove;
  isCheck?: boolean;
  interactiveSide?: Side | "both" | null;
  disabled?: boolean;
  jarvisRecommendedMove?: { from: string; to: string } | null;
  onMove?: (move: { from: string; to: string; promotion?: string }) => void;
  onInvalidMove?: () => void;
}

export const ChessBoard = React.memo(function ChessBoard({
  fen,
  orientation,
  theme,
  pieceStyle,
  legalHints,
  lastMove,
  isCheck,
  interactiveSide,
  disabled,
  jarvisRecommendedMove,
  onMove,
  onInvalidMove
}: ChessBoardProps) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [shakeSquare, setShakeSquare] = useState<string | null>(null);
  const shakeTimer = useRef<number | null>(null);

  const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const boardFiles = orientation === "white" ? files : [...files].reverse();
  const legalTargets = selected
    ? new Set(
        chess
          .moves({ square: selected as Square, verbose: true })
          .map((move) => move.to)
      )
    : new Set<string>();

  // Find king square for check glow
  const kingSquare = useMemo(() => {
    if (!isCheck) return null;
    const turn = chess.turn();
    for (const row of chess.board()) {
      for (const piece of row) {
        if (piece && piece.type === "k" && piece.color === turn) {
          return `${files[chess.board().indexOf(row) !== -1 ? 0 : 0]}`;
        }
      }
    }
    // Find king square by scanning all squares
    for (const rank of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const file of files) {
        const sq = `${file}${rank}` as Square;
        const piece = chess.get(sq);
        if (piece && piece.type === "k" && piece.color === turn) {
          return sq;
        }
      }
    }
    return null;
  }, [fen, isCheck]);

  function canMoveTurn() {
    const turn = sideFromTurn(chess.turn());
    return interactiveSide === "both" || interactiveSide === turn;
  }

  function triggerShake(square: string) {
    if (shakeTimer.current) {
      window.clearTimeout(shakeTimer.current);
    }
    setShakeSquare(square);
    shakeTimer.current = window.setTimeout(() => {
      setShakeSquare(null);
      shakeTimer.current = null;
    }, 400);
    onInvalidMove?.();
  }

  const executeMove = useCallback(
    (from: string, to: string) => {
      if (disabled || !onMove || chess.isGameOver()) return;

      const movingPiece = chess.get(from as Square);
      if (!movingPiece) return;

      // Check if it's a legal move
      const legalMoves = chess.moves({ square: from as Square, verbose: true });
      const isLegal = legalMoves.some((m) => m.to === to);
      if (!isLegal) {
        triggerShake(to);
        return;
      }

      const isPromotion =
        movingPiece.type === "p" &&
        ((movingPiece.color === "w" && to.endsWith("8")) ||
          (movingPiece.color === "b" && to.endsWith("1")));

      if (isPromotion) {
        setPromotion({ from, to });
      } else {
        onMove({ from, to });
        setSelected(null);
      }
    },
    [chess, disabled, onMove, onInvalidMove]
  );

  function clickSquare(square: string) {
    if (disabled || !onMove || chess.isGameOver()) {
      return;
    }
    const piece = chess.get(square as Square);
    const turn = chess.turn();
    const canMove = canMoveTurn();

    if (!selected) {
      if (piece && piece.color === turn && canMove) {
        setSelected(square);
      }
      return;
    }

    if (piece && piece.color === turn && canMove) {
      setSelected(square);
      return;
    }

    if (!legalTargets.has(square)) {
      if (selected !== square) {
        triggerShake(square);
      }
      setSelected(null);
      return;
    }

    executeMove(selected, square);
  }

  function choosePromotion(piece: string) {
    if (!promotion) {
      return;
    }
    onMove?.({ ...promotion, promotion: piece });
    setPromotion(null);
    setSelected(null);
  }

  function cancelPromotion() {
    setPromotion(null);
    setSelected(null);
  }

  // --- Drag-and-drop handlers ---
  function handleDragStart(event: React.DragEvent, square: string) {
    if (disabled || chess.isGameOver()) {
      event.preventDefault();
      return;
    }
    const piece = chess.get(square as Square);
    const canMove = canMoveTurn();
    if (!piece || piece.color !== chess.turn() || !canMove) {
      event.preventDefault();
      return;
    }
    setDragFrom(square);
    setSelected(square);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", square);
  }

  function handleDragOver(event: React.DragEvent, square: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOver !== square) {
      setDragOver(square);
    }
  }

  function handleDragLeave() {
    setDragOver(null);
  }

  function handleDrop(event: React.DragEvent, square: string) {
    event.preventDefault();
    setDragOver(null);
    if (dragFrom && dragFrom !== square) {
      executeMove(dragFrom, square);
    }
    setDragFrom(null);
  }

  function handleDragEnd() {
    setDragFrom(null);
    setDragOver(null);
  }

  // --- Touch drag handlers ---
  const touchState = useRef<{
    square: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  function handleTouchStart(event: React.TouchEvent, square: string) {
    if (disabled || chess.isGameOver()) return;
    const piece = chess.get(square as Square);
    const canMove = canMoveTurn();
    if (!piece || piece.color !== chess.turn() || !canMove) return;

    const touch = event.touches[0];
    touchState.current = {
      square,
      startX: touch.clientX,
      startY: touch.clientY,
      moved: false
    };
    setSelected(square);
  }

  function handleTouchMove(event: React.TouchEvent) {
    if (!touchState.current) return;
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - touchState.current.startX);
    const dy = Math.abs(touch.clientY - touchState.current.startY);
    if (dx > 10 || dy > 10) {
      touchState.current.moved = true;
    }
    // Find square under touch
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const squareEl = element?.closest("[data-square]") as HTMLElement | null;
    if (squareEl) {
      setDragOver(squareEl.dataset.square ?? null);
    }
  }

  function handleTouchEnd() {
    if (!touchState.current) return;
    if (touchState.current.moved && dragOver && dragOver !== touchState.current.square) {
      executeMove(touchState.current.square, dragOver);
    }
    // If not moved, the click handler handles it
    touchState.current = null;
    setDragOver(null);
  }

  return (
    <div className={`board-wrap theme-${theme} pieces-${pieceStyle}`}>
      <div
        className="chess-board"
        role="grid"
        aria-label="Chess board"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {ranks.flatMap((rank) =>
          boardFiles.map((file) => {
            const square = `${file}${rank}`;
            const piece = chess.get(square as Square);
            const key = piece ? `${piece.color}${piece.type}` : "";
            const light = (files.indexOf(file) + rank) % 2 === 1;
            const selectedClass = selected === square ? " selected" : "";
            const legalClass = legalHints && legalTargets.has(square) ? " legal" : "";
            const lastClass = sameMove(lastMove, square) ? " last" : "";
            const checkClass = isCheck && kingSquare === square ? " in-check" : "";
            const dragOverClass = dragOver === square ? " drag-over" : "";
            const shakeClass = shakeSquare === square ? " invalid-shake" : "";
            const canDrag = Boolean(
              piece &&
                piece.color === chess.turn() &&
                canMoveTurn() &&
                !disabled &&
                !chess.isGameOver()
            );
            const isJarvisFrom = jarvisRecommendedMove && jarvisRecommendedMove.from === square;
            const isJarvisTo = jarvisRecommendedMove && jarvisRecommendedMove.to === square;
            const jarvisClass = isJarvisFrom ? " jarvis-from" : isJarvisTo ? " jarvis-to" : "";

            return (
              <button
                key={square}
                data-square={square}
                className={`square ${light ? "light" : "dark"}${selectedClass}${legalClass}${lastClass}${checkClass}${dragOverClass}${shakeClass}${jarvisClass}`}
                onClick={() => clickSquare(square)}
                draggable={canDrag}
                onDragStart={(event) => handleDragStart(event, square)}
                onDragOver={(event) => handleDragOver(event, square)}
                onDragLeave={handleDragLeave}
                onDrop={(event) => handleDrop(event, square)}
                onDragEnd={handleDragEnd}
                onTouchStart={(event) => handleTouchStart(event, square)}
                role="gridcell"
                aria-label={square}
              >
                <span className="coord file-label">{rank === (orientation === "white" ? 1 : 8) ? file : ""}</span>
                <span className="coord rank-label">{file === (orientation === "white" ? "a" : "h") ? rank : ""}</span>
                {isJarvisTo && <span className="jarvis-target-badge" title="J.A.R.V.I.S. Recommended Target" />}
                {piece ? (
                  <span
                    className={`piece ${piece.color === "w" ? "white-piece" : "black-piece"}${dragFrom === square ? " dragging" : ""}`}
                  >
                    {pieceSymbols[pieceStyle][key]}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
      {promotion ? (
        <div className="promotion-popover" role="dialog" aria-label="Choose promotion">
          {["q", "r", "b", "n"].map((piece) => (
            <button key={piece} onClick={() => choosePromotion(piece)}>
              {piece.toUpperCase()}
            </button>
          ))}
          <button className="promotion-cancel" onClick={cancelPromotion} aria-label="Cancel promotion">
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
});
