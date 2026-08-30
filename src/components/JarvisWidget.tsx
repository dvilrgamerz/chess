import { useEffect, useState } from "react";
import { Bot, Check, Cpu, Layers, Play, Settings, ShieldAlert, Sparkles, Zap } from "lucide-react";
import type { PublicUser } from "../../shared/types.js";
import { useJarvisWorker, defaultJarvisSettings } from "../lib/useJarvisWorker.js";
import type { JarvisWorkerSettings } from "../lib/jarvisWorker.js";

interface JarvisWidgetProps {
  user: PublicUser;
  fen?: string;
  onExecuteMove?: (move: { from: string; to: string; promotion?: string }) => void;
  onOpenAdminPanel?: () => void;
}

export function JarvisWidget({ user, fen, onExecuteMove, onOpenAdminPanel }: JarvisWidgetProps) {
  const [enabled, setEnabled] = useState(user.settings.jarvisEnabled ?? true);
  const [minimized, setMinimized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [executed, setExecuted] = useState(false);

  const [jarvisSettings, setJarvisSettings] = useState<JarvisWorkerSettings>(defaultJarvisSettings);

  const isOwner = user?.role === "owner" && enabled;
  const { result: analysis, isCalculating } = useJarvisWorker(fen, isOwner, jarvisSettings);

  // Auto-move trigger when Auto-Move setting is ON
  useEffect(() => {
    if (jarvisSettings.autoMove && analysis?.bestMove && onExecuteMove && !executed) {
      onExecuteMove(analysis.bestMove);
      setExecuted(true);
    }
  }, [analysis?.bestMove, jarvisSettings.autoMove, onExecuteMove, executed]);

  useEffect(() => {
    setExecuted(false);
  }, [fen]);

  if (!user || user.role !== "owner") {
    return null; // Exclusive to Owner (Jenil P)
  }

  function handleExecute() {
    if (analysis?.bestMove && onExecuteMove) {
      onExecuteMove(analysis.bestMove);
      setExecuted(true);
    }
  }

  return (
    <div className={`jarvis-widget ${minimized ? "minimized" : ""}`}>
      {/* Widget Header */}
      <div className="jarvis-header">
        <div className="jarvis-title">
          <Cpu size={18} className="jarvis-glow-icon" />
          <strong>J.A.R.V.I.S. Engine</strong>
          <span className="jarvis-owner-tag">MAX POWER</span>
        </div>
        <div className="jarvis-controls">
          <button
            className="jarvis-settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
            title="J.A.R.V.I.S. Engine Settings"
          >
            <Settings size={14} />
          </button>
          <label className="jarvis-switch" title="Toggle J.A.R.V.I.S. ON/OFF">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="jarvis-slider" />
          </label>
          <button
            className="jarvis-min-btn"
            onClick={() => setMinimized(!minimized)}
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? "+" : "−"}
          </button>
        </div>
      </div>

      {!minimized && enabled && (
        <div className="jarvis-body">
          {/* Settings Drawer */}
          {showSettings ? (
            <div className="jarvis-settings-drawer">
              <h4>⚙️ J.A.R.V.I.S. Engine Controls</h4>

              <label className="jarvis-setting-row">
                <span>Strength (1-20): {jarvisSettings.strength}</span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={jarvisSettings.strength}
                  onChange={(e) => setJarvisSettings({ ...jarvisSettings, strength: Number(e.target.value) })}
                />
              </label>

              <label className="jarvis-setting-row">
                <span>Max Depth: {jarvisSettings.maxDepth} plies</span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={jarvisSettings.maxDepth}
                  onChange={(e) => setJarvisSettings({ ...jarvisSettings, maxDepth: Number(e.target.value) })}
                />
              </label>

              <label className="jarvis-setting-row">
                <span>Multi-PV Lines: {jarvisSettings.multiPV}</span>
                <select
                  value={jarvisSettings.multiPV}
                  onChange={(e) => setJarvisSettings({ ...jarvisSettings, multiPV: Number(e.target.value) })}
                  className="setting-item select inline-select"
                >
                  <option value={1}>1 Line</option>
                  <option value={2}>2 Lines</option>
                  <option value={3}>3 Lines</option>
                  <option value={5}>5 Lines</option>
                </select>
              </label>

              <div className="jarvis-toggles-grid">
                <label className="toggle-item text-xs">
                  <span>Auto-Move</span>
                  <input
                    type="checkbox"
                    checked={jarvisSettings.autoMove}
                    onChange={(e) => setJarvisSettings({ ...jarvisSettings, autoMove: e.target.checked })}
                  />
                </label>

                <label className="toggle-item text-xs">
                  <span>Board Overlay</span>
                  <input
                    type="checkbox"
                    checked={jarvisSettings.boardOverlay}
                    onChange={(e) => setJarvisSettings({ ...jarvisSettings, boardOverlay: e.target.checked })}
                  />
                </label>

                <label className="toggle-item text-xs">
                  <span>Tactical Radar</span>
                  <input
                    type="checkbox"
                    checked={jarvisSettings.tacticalRadar}
                    onChange={(e) => setJarvisSettings({ ...jarvisSettings, tacticalRadar: e.target.checked })}
                  />
                </label>

                <label className="toggle-item text-xs">
                  <span>Opening Book</span>
                  <input
                    type="checkbox"
                    checked={jarvisSettings.openingBook}
                    onChange={(e) => setJarvisSettings({ ...jarvisSettings, openingBook: e.target.checked })}
                  />
                </label>
              </div>

              <button className="secondary full small-btn mt-2" onClick={() => setShowSettings(false)}>
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Eval & Calculation Bar */}
              {analysis && fen ? (
                <>
                  <div className="jarvis-meta-bar">
                    <div className="jarvis-eval-chip">
                      <Zap size={14} />
                      <strong>{analysis.evalText}</strong>
                      {isCalculating && <span className="calc-dot">...</span>}
                    </div>
                    <div className="jarvis-opening-chip">
                      <span>{analysis.openingName}</span>
                    </div>
                  </div>

                  {/* Speech / Commentary */}
                  {jarvisSettings.commentary && (
                    <div className="jarvis-speech-bubble">
                      <Sparkles size={16} className="jarvis-sparkle" />
                      <p>"{analysis.commentary}"</p>
                    </div>
                  )}

                  {/* Multi-PV Candidate Lines */}
                  {analysis.candidateLines.length > 0 && (
                    <div className="jarvis-pv-lines">
                      <span className="text-xs text-muted">
                        <Layers size={12} /> Top Candidate Lines:
                      </span>
                      <div className="pv-chips">
                        {analysis.candidateLines.map((line, i) => (
                          <span key={i} className="pv-chip">
                            #{i + 1} {line.san} ({line.evalText})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tactical Radar */}
                  {jarvisSettings.tacticalRadar && analysis.tactics.length > 0 && (
                    <div className="jarvis-tactics">
                      <ShieldAlert size={14} />
                      <span>{analysis.tactics[0]}</span>
                    </div>
                  )}

                  {/* Execute Button */}
                  {analysis.bestMove && onExecuteMove && (
                    <button className="jarvis-execute-btn" onClick={handleExecute} disabled={executed}>
                      {executed ? (
                        <>
                          <Check size={16} /> J.A.R.V.I.S. Move Executed
                        </>
                      ) : (
                        <>
                          <Play size={16} /> Execute J.A.R.V.I.S. Move ({analysis.bestMove.san})
                        </>
                      )}
                    </button>
                  )}
                </>
              ) : (
                <div className="jarvis-admin-assistant">
                  <p>🤖 "Sir, J.A.R.V.I.S. Web Worker Engine standing by. Non-blocking calculation active."</p>
                  {onOpenAdminPanel && (
                    <button className="primary full small-btn mt-2" onClick={onOpenAdminPanel}>
                      Open Owner Admin Panel
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
