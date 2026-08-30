import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { selectBotMove } from "../shared/bot.js";

describe("selectBotMove", () => {
  it("returns legal moves for every bot level", () => {
    const fen = new Chess().fen();
    for (let level = 1; level <= 10; level += 1) {
      const move = selectBotMove(fen, level as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10, () => 0.25);
      const chess = new Chess(fen);
      const made = move ? chess.move(move) : null;
      expect(made?.san).toBeTruthy();
    }
  });

  it("returns null when no legal moves exist", () => {
    const mate = "7k/5Q2/7K/8/8/8/8/8 b - - 0 1";
    expect(selectBotMove(mate, 10)).toBeNull();
  });
});
