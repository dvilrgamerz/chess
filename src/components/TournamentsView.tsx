import { useState } from "react";
import { Clock, Medal, Play, Swords, Trophy, Users } from "lucide-react";
import type { PublicUser } from "../../shared/types.js";

interface TournamentsViewProps {
  user: PublicUser;
  onJoinTournament: () => void;
}

export function TournamentsView({ user, onJoinTournament }: TournamentsViewProps) {
  const [joined, setJoined] = useState(false);

  return (
    <section className="table-screen">
      <div className="toolbar">
        <div>
          <span className="eyebrow">🏆 Competitive Arena</span>
          <h1>Scheduled & Arena Tournaments</h1>
        </div>
      </div>

      <div className="mode-grid mt-4">
        <div className="dash-card">
          <div className="dash-card-header">
            <Trophy size={24} className="icon-accent" />
            <span className="status-pill online">LIVE ARENA</span>
          </div>
          <h2>🔥 Blitz Arena Championship</h2>
          <p className="muted text-sm">3+0 Blitz • 60 Minute Arena • Fast pairings</p>
          <div className="stat-strip compact mt-2">
            <div>
              <span>Players</span>
              <strong>14 Joined</strong>
            </div>
            <div>
              <span>Time Left</span>
              <strong>38:12</strong>
            </div>
          </div>
          <button
            className={joined ? "secondary full mt-3" : "primary full mt-3"}
            onClick={() => {
              setJoined(true);
              onJoinTournament();
            }}
          >
            <Swords size={16} /> {joined ? "In Tournament (Play Match)" : "Join Blitz Arena"}
          </button>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <Clock size={24} />
            <span className="mode-badge">SCHEDULED</span>
          </div>
          <h2>⚡ Bullet Knockout Cup</h2>
          <p className="muted text-sm">1+0 Bullet • Starts in 2 hours</p>
          <div className="stat-strip compact mt-2">
            <div>
              <span>Format</span>
              <strong>Knockout</strong>
            </div>
            <div>
              <span>Requirement</span>
              <strong>Rating 1200+</strong>
            </div>
          </div>
          <button className="secondary full mt-3" disabled>
            Pre-register (Coming Soon)
          </button>
        </div>
      </div>
    </section>
  );
}
