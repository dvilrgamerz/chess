import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { Side, TimeControl } from "../../shared/types.js";

interface GameClockProps {
  timeControl?: TimeControl;
  activeSide: Side | null;
  onTimeout?: (flaggedSide: Side) => void;
  disabled?: boolean;
}

export const GameClock = React.memo(function GameClock({ timeControl, activeSide, onTimeout, disabled }: GameClockProps) {
  if (!timeControl || timeControl.category === "unlimited") {
    return null;
  }

  const [whiteMs, setWhiteMs] = useState(timeControl.initialSec * 1000);
  const [blackMs, setBlackMs] = useState(timeControl.initialSec * 1000);

  useEffect(() => {
    if (disabled || !activeSide) return;

    const interval = setInterval(() => {
      if (activeSide === "white") {
        setWhiteMs((prev) => {
          if (prev <= 100) {
            onTimeout?.("white");
            return 0;
          }
          return prev - 100;
        });
      } else {
        setBlackMs((prev) => {
          if (prev <= 100) {
            onTimeout?.("black");
            return 0;
          }
          return prev - 100;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [activeSide, disabled, onTimeout]);

  function formatTime(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (ms <= 10000 && ms > 0) {
      const tenths = Math.floor((ms % 1000) / 100);
      return `${sec}.${tenths}s`;
    }
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  }

  return (
    <div className="game-clock-container">
      <div className={`clock-box ${activeSide === "black" ? "active" : ""} ${blackMs <= 10000 ? "low-time" : ""}`}>
        <Clock size={14} />
        <span>Black: {formatTime(blackMs)}</span>
      </div>
      <div className={`clock-box ${activeSide === "white" ? "active" : ""} ${whiteMs <= 10000 ? "low-time" : ""}`}>
        <Clock size={14} />
        <span>White: {formatTime(whiteMs)}</span>
      </div>
    </div>
  );
});
