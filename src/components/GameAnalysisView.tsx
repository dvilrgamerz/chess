import { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, HelpCircle, Shield, Sparkles, Star } from "lucide-react";
import { analyzeFullGame } from "../lib/jarvisAI.js";
import type { BoardTheme, GameRecord, PieceStyle } from "../../shared/types.js";
import { ChessBoard } from "./ChessBoard.js";

interface GameAnalysisViewProps {
  game: GameRecord;
  boardTheme: BoardTheme;
  pieceStyle: PieceStyle;
  onClose: () => void;
}

export function GameAnalysisView({ game, boardTheme, pieceStyle, onClose }: GameAnalysisViewProps) {
  const [report] = useState(() => analyzeFullGame(game.moves));
  const [stepIndex, setStepIndex] = useState(0);

  const currentMoveAnalysis = report.moves[stepIndex];
  const fen = currentMoveAnalysis ? currentMoveAnalysis.fenAfter : game.finalFen;

  function renderQualityBadge(quality: string) {
    switch (quality) {
      case "best":
        return <span className="quality-badge best"><Star size={12} /> Best Move</span>;
      case "great":
        return <span className="quality-badge great"><Sparkles size={12} /> Great Move</span>;
      case "inaccuracy":
        return <span className="quality-badge inaccuracy"><HelpCircle size={12} /> Inaccuracy</span>;
      case "mistake":
        return <span className="quality-badge mistake"><AlertTriangle size={12} /> Mistake</span>;
      case "blunder":
        return <span className="quality-badge blunder"><AlertCircle size={12} /> Blunder</span>;
      default:
        return <span className="quality-badge"><CheckCircle size={12} /> Good Move</span>;
    }
  }

  // Calculate Eval bar percentage
  const rawEval = currentMoveAnalysis ? currentMoveAnalysis.evalAfter : 0;
  // Map score -500 to +500 into 0% to 100% (50% is even)
  const evalPercent = Math.max(5, Math.min(95, 50 + (rawEval / 600) * 50));

  return (
    <section className="analysis-view-screen">
      <div className="toolbar">
        <div>
          <span className="eyebrow">🔍 Post-Game Review</span>
          <h1>Game Analysis & Accuracy Report</h1>
        </div>
        <button className="secondary" onClick={onClose}>
          <ChevronLeft size={16} /> Back to Games
        </button>
      </div>

      {/* Accuracy & Summary Banner */}
      <div className="analysis-summary-banner">
        <div className="accuracy-box white">
          <span className="eyebrow">{game.players.white.username} (White)</span>
          <strong className="font-numeric">{report.whiteAccuracy}% Accuracy</strong>
          <div className="blunder-row">
            <span>💥 {report.whiteBlunders} Blunders</span>
            <span>❌ {report.whiteMistakes} Mistakes</span>
          </div>
        </div>

        <div className="vs-divider">
          <Shield size={24} className="icon-accent" />
          <span>VS</span>
        </div>

        <div className="accuracy-box black">
          <span className="eyebrow">{game.players.black.username} (Black)</span>
          <strong className="font-numeric">{report.blackAccuracy}% Accuracy</strong>
          <div className="blunder-row">
            <span>💥 {report.blackBlunders} Blunders</span>
            <span>❌ {report.blackMistakes} Mistakes</span>
          </div>
        </div>
      </div>

      <div className="analysis-main-layout">
        {/* Eval Bar + Board */}
        <div className="analysis-board-col">
          <div className="eval-bar-shell">
            <div className="eval-bar-fill" style={{ height: `${evalPercent}%` }} />
            <span className="eval-text">{rawEval > 0 ? `+${(rawEval / 100).toFixed(1)}` : (rawEval / 100).toFixed(1)}</span>
          </div>

          <div className="analysis-board-wrap">
            <ChessBoard
              fen={fen}
              orientation="white"
              theme={boardTheme}
              pieceStyle={pieceStyle}
              legalHints={false}
              disabled
            />
          </div>
        </div>

        {/* Move Step Controls & Commentary Panel */}
        <aside className="analysis-side-panel">
          <div className="analysis-step-header">
            <h3>
              Move {stepIndex + 1} of {report.moves.length}
            </h3>
            <div className="step-btn-row">
              <button
                className="secondary small-btn"
                disabled={stepIndex <= 0}
                onClick={() => setStepIndex((prev) => prev - 1)}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button
                className="secondary small-btn"
                disabled={stepIndex >= report.moves.length - 1}
                onClick={() => setStepIndex((prev) => prev + 1)}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {currentMoveAnalysis && (
            <div className="analysis-move-card">
              <div className="move-card-top">
                <strong>
                  {currentMoveAnalysis.playerSide === "white" ? "White" : "Black"} played:{" "}
                  <span className="highlight-san">{currentMoveAnalysis.san}</span>
                </strong>
                {renderQualityBadge(currentMoveAnalysis.quality)}
              </div>

              <p className="move-explanation mt-2">{currentMoveAnalysis.explanation}</p>

              {currentMoveAnalysis.bestMoveSan && currentMoveAnalysis.bestMoveSan !== currentMoveAnalysis.san && (
                <div className="recommended-alt-box mt-3">
                  <Sparkles size={16} className="icon-accent" />
                  <div>
                    <span>Better move recommendation:</span>
                    <strong>{currentMoveAnalysis.bestMoveSan}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Move History Table Step Picker */}
          <div className="analysis-moves-scroll">
            {report.moves.map((m, idx) => (
              <button
                key={idx}
                className={`analysis-move-row ${idx === stepIndex ? "active" : ""}`}
                onClick={() => setStepIndex(idx)}
              >
                <span>{idx + 1}.</span>
                <strong>{m.san}</strong>
                {renderQualityBadge(m.quality)}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
