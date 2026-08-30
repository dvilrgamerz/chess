import { useState } from "react";
import { BookOpen, ChevronRight, PieChart, Shield } from "lucide-react";
import { openingsList, type OpeningDef } from "../lib/openingsData.js";

export function OpeningsView() {
  const [selected, setSelected] = useState<OpeningDef>(openingsList[0]);

  return (
    <section className="table-screen">
      <div className="toolbar">
        <div>
          <span className="eyebrow">📚 Chess Theory</span>
          <h1>Opening Explorer & Book Trainer</h1>
        </div>
      </div>

      <div className="openings-layout mt-4">
        {/* Left List of Openings */}
        <div className="openings-sidebar">
          {openingsList.map((op) => (
            <button
              key={op.eco}
              className={`opening-item ${selected.eco === op.eco ? "active" : ""}`}
              onClick={() => setSelected(op)}
            >
              <div>
                <span className="opening-eco">{op.eco}</span>
                <strong>{op.name}</strong>
              </div>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>

        {/* Right Details Panel */}
        <div className="dash-card opening-details">
          <div className="opening-header">
            <BookOpen size={28} className="icon-accent" />
            <div>
              <span className="eyebrow">ECO {selected.eco}</span>
              <h2>{selected.name}</h2>
            </div>
          </div>

          <div className="opening-moves-strip mt-2">
            <span>Main Line Moves:</span>
            <div className="moves-seq">
              {selected.moves.map((m, i) => (
                <strong key={i} className="move-chip">
                  {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}
                  {m}
                </strong>
              ))}
            </div>
          </div>

          <p className="opening-desc mt-3">{selected.description}</p>

          <div className="stats-breakdown mt-3">
            <h3><PieChart size={16} /> Win / Draw / Loss Statistics</h3>
            <div className="stat-bar-container mt-2">
              <div className="stat-seg win" style={{ width: `${selected.whiteWins}%` }}>
                White {selected.whiteWins}%
              </div>
              <div className="stat-seg draw" style={{ width: `${selected.draws}%` }}>
                Draw {selected.draws}%
              </div>
              <div className="stat-seg loss" style={{ width: `${selected.blackWins}%` }}>
                Black {selected.blackWins}%
              </div>
            </div>
          </div>

          <div className="concepts-block mt-4">
            <h3><Shield size={16} /> Key Strategic Concepts</h3>
            <ul>
              {selected.keyConcepts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
