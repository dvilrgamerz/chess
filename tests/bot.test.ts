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

  it("reuses the search position without corrupting subsequent searches", () => {
    const fen = new Chess().fen();
    // Identical seeded searches must not share mutated board state.
    const a = selectBotMove(fen, 7, () => 0.25);
    const b = selectBotMove(fen, 7, () => 0.25);
    expect(a && { from: a.from, to: a.to, promotion: a.promotion })
      .toEqual(b && { from: b.from, to: b.to, promotion: b.promotion });
    const board = new Chess(fen);
    expect(a ? board.move(a)?.san : null).toBeTruthy();
    expect(new Chess(fen).fen()).toBe(fen);
  });

  it("keeps legal tactical responses in a near-endgame position", () => {
    const fen = "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1";
    for (const level of [3, 7, 10] as const) {
      const move = selectBotMove(fen, level, () => 0.4);
      const chess = new Chess(fen);
      expect(move ? chess.move(move)?.san : null).toBeTruthy();
    }
  });

  it("returns null when no legal moves exist", () => {
    const mate = "7k/5Q2/7K/8/8/8/8/8 b - - 0 1";
    expect(selectBotMove(mate, 10)).toBeNull();
  });
});
