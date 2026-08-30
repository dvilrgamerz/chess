import { useState } from "react";
import { CheckCircle, Flame, Medal, RefreshCw, Shield, Sparkles, Target, Trophy, XCircle } from "lucide-react";
import { chessPuzzles, getRandomPuzzle } from "../lib/puzzlesData.js";
import { submitPuzzleSolve } from "../lib/api.js";
import type { BoardTheme, PieceStyle, PublicUser, Puzzle } from "../../shared/types.js";
import { ChessBoard } from "./ChessBoard.js";

interface PuzzlesViewProps {
  user: PublicUser;
  onUserUpdate: (u: PublicUser) => void;
  boardTheme: BoardTheme;
  pieceStyle: PieceStyle;
}

export function PuzzlesView({ user, onUserUpdate, boardTheme, pieceStyle }: PuzzlesViewProps) {
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle>(() => getRandomPuzzle(user.puzzleRating ?? 1200));
  const [status, setStatus] = useState<"solving" | "correct" | "wrong">("solving");
  const [puzzleStreak, setPuzzleStreak] = useState(0);

  function handleMove(move: { from: string; to: string; promotion?: string }) {
    if (status !== "solving") return;

    const moveSan = `${move.from}${move.to}`;
    const expected = currentPuzzle.solutionMoves[0].toLowerCase();
    const isMatch =
      moveSan === expected.toLowerCase() ||
      move.to === expected.toLowerCase() ||
      expected.includes(move.to);

    if (isMatch) {
      setStatus("correct");
      setPuzzleStreak((prev) => prev + 1);
      submitPuzzleSolve(true)
        .then((res) => onUserUpdate(res.user))
        .catch(() => {});
    } else {
      setStatus("wrong");
      setPuzzleStreak(0);
      submitPuzzleSolve(false)
        .then((res) => onUserUpdate(res.user))
        .catch(() => {});
    }
  }

  function nextPuzzle() {
    setCurrentPuzzle(getRandomPuzzle(user.puzzleRating ?? 1200));
    setStatus("solving");
  }

  return (
    <section className="puzzles-screen">
      <div className="toolbar">
        <div>
          <span className="eyebrow">🧩 Tactics Trainer</span>
          <h1>Chess Puzzles & Mate Challenges</h1>
        </div>
        <div className="toolbar-actions">
          <span className="hero-streak">
            <Flame size={16} /> {puzzleStreak} Streak
          </span>
          <span className="status-pill online font-numeric">
            <Trophy size={14} /> Puzzle Rating: {user.puzzleRating ?? 1200}
          </span>
          <button className="primary" onClick={nextPuzzle}>
            <RefreshCw size={16} /> Next Puzzle
          </button>
        </div>
      </div>

      <div className="game-layout">
        <div className="board-column">
          <ChessBoard
            fen={currentPuzzle.fen}
            orientation="white"
            theme={boardTheme}
            pieceStyle={pieceStyle}
            legalHints={true}
            interactiveSide="both"
            onMove={handleMove}
          />
        </div>

        <aside className="game-side">
          <div className="dash-card">
            <div className="dash-card-header">
              <Target size={20} />
              <strong>{currentPuzzle.title}</strong>
              <span className="mode-badge">{currentPuzzle.category.toUpperCase()}</span>
            </div>

            <p className="muted text-sm">{currentPuzzle.description}</p>
            <span className="eyebrow">Puzzle Elo Rating: {currentPuzzle.rating}</span>

            {status === "correct" && (
              <div className="puzzle-banner correct mt-3">
                <CheckCircle size={24} />
                <div>
                  <strong>Solved! Excellent tactic!</strong>
                  <span>+15 Puzzle Rating • XP Gained</span>
                </div>
              </div>
            )}

            {status === "wrong" && (
              <div className="puzzle-banner wrong mt-3">
                <XCircle size={24} />
                <div>
                  <strong>Incorrect Move</strong>
                  <span>Try again or click Next Puzzle.</span>
                </div>
              </div>
            )}

            {status !== "solving" && (
              <button className="primary full mt-3" onClick={nextPuzzle}>
                Next Puzzle
              </button>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
