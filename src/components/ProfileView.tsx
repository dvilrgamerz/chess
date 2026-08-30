import { Award, Bot, Crown, Flame, Medal, Shield, Swords, Target, Trophy, Zap } from "lucide-react";
import type { PublicUser } from "../../shared/types.js";

interface ProfileViewProps {
  user: PublicUser;
}

export function ProfileView({ user }: ProfileViewProps) {
  const achievements = [
    { id: "1", title: "First Victory", desc: "Win your first chess game", unlocked: user.wins > 0, icon: Trophy },
    { id: "2", title: "5-Win Streak", desc: "Achieve a 5-win streak", unlocked: (user.streak ?? 1) >= 5, icon: Flame },
    { id: "3", title: "God Mode Slayer", desc: "Defeat Bot Level 10 (God Mode)", unlocked: user.wins >= 5, icon: Crown },
    { id: "4", title: "Tactics Master", desc: "Reach 1400+ Puzzle Rating", unlocked: (user.puzzleRating ?? 1000) >= 1400, icon: Target },
    { id: "5", title: "Speed Demon", desc: "Play 10 Blitz / Bullet games", unlocked: user.wins + user.losses >= 10, icon: Zap }
  ];

  const xpNext = (user.level ?? 1) * 100;
  const xpCurrent = (user.xp ?? 0) % 100;

  return (
    <section className="profile-screen">
      {/* Hero Profile Banner */}
      <div className="profile-hero-card">
        <div className="profile-avatar">
          {user.role === "owner" ? <Crown size={40} className="icon-accent" /> : <Shield size={40} />}
        </div>
        <div className="profile-identity">
          <div className="profile-name-row">
            <h1>{user.username}</h1>
            {user.role === "owner" && <span className="god-badge">👑 OWNER</span>}
          </div>
          <span className="text-muted">{user.email} • Joined {new Date(user.createdAt).toLocaleDateString()}</span>
        </div>

        {/* XP Level Bar */}
        <div className="profile-level-box">
          <div className="level-badge">LEVEL {user.level ?? 1}</div>
          <div className="xp-bar-bg">
            <div className="xp-bar-fill" style={{ width: `${xpCurrent}%` }} />
          </div>
          <span className="text-xs text-muted font-numeric">{xpCurrent} / 100 XP to Level {(user.level ?? 1) + 1}</span>
        </div>
      </div>

      {/* Format Ratings Cards */}
      <div className="mode-grid mt-4">
        <div className="stat-card">
          <Zap size={20} className="icon-accent" />
          <span>Bullet Elo</span>
          <strong className="font-numeric">{user.formatRatings?.bullet ?? user.rating}</strong>
        </div>
        <div className="stat-card">
          <Swords size={20} className="icon-accent" />
          <span>Blitz Elo</span>
          <strong className="font-numeric">{user.formatRatings?.blitz ?? user.rating}</strong>
        </div>
        <div className="stat-card">
          <Shield size={20} className="icon-accent" />
          <span>Rapid Elo</span>
          <strong className="font-numeric">{user.formatRatings?.rapid ?? user.rating}</strong>
        </div>
        <div className="stat-card">
          <Target size={20} className="icon-accent" />
          <span>Puzzle Rating</span>
          <strong className="font-numeric">{user.puzzleRating ?? 1000}</strong>
        </div>
      </div>

      {/* Achievements Section */}
      <div className="dash-card mt-4">
        <div className="dash-card-header">
          <Award size={22} className="icon-accent" />
          <h2>Unlocked Achievements</h2>
        </div>

        <div className="achievements-grid mt-3">
          {achievements.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.id} className={`achievement-card ${a.unlocked ? "unlocked" : "locked"}`}>
                <div className="achievement-icon">
                  <Icon size={24} />
                </div>
                <div>
                  <strong>{a.title}</strong>
                  <p className="text-xs muted">{a.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
