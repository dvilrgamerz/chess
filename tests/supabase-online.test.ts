import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { mapOnlineRowToSnapshot, previewOnlineMove, shouldApplyOnlineSnapshot } from "../src/lib/supabaseOnline.js";

describe("Supabase online game state", () => {
  it("maps authoritative database state into a playable snapshot", () => {
    const snapshot = mapOnlineRowToSnapshot({
      id: "11111111-1111-4111-8111-111111111111",
      mode: "friend",
      room_code: "ABC234",
      status: "active",
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
      turn: "white",
      moves: ["e4", "e5"],
      last_move: { from: "e7", to: "e5", san: "e5" },
      white_user_id: "22222222-2222-4222-8222-222222222222",
      black_user_id: "33333333-3333-4333-8333-333333333333",
      white_username: "Alpha",
      black_username: "Bravo",
      white_role: "user",
      black_role: "owner",
      white_rating: 1020,
      black_rating: 1100,
      white_ms_remaining: 285000,
      black_ms_remaining: 292000,
      turn_started_at: "2026-09-20T01:00:00.000Z",
      time_control: {
        id: "blitz-5",
        name: "5+0 Blitz",
        category: "blitz",
        initialSec: 300,
        incSec: 0
      },
      created_at: "2026-09-20T00:59:00.000Z",
      started_at: "2026-09-20T00:59:10.000Z"
    });

    expect(snapshot.roomCode).toBe("ABC234");
    expect(snapshot.status).toBe("active");
    expect(snapshot.turn).toBe("white");
    expect(snapshot.moves).toEqual(["e4", "e5"]);
    expect(snapshot.lastMove).toEqual({ from: "e7", to: "e5", san: "e5" });
    expect(snapshot.players.white?.username).toBe("Alpha");
    expect(snapshot.players.black?.role).toBe("owner");
    expect(snapshot.whiteTimeRemainingMs).toBe(285000);
    expect(snapshot.blackTimeRemainingMs).toBe(292000);
    expect(snapshot.turnStartedAt).toBe("2026-09-20T01:00:00.000Z");
    expect(snapshot.isCheck).toBe(false);
  });

  it("derives check state from the authoritative FEN", () => {
    const snapshot = mapOnlineRowToSnapshot({
      id: "44444444-4444-4444-8444-444444444444",
      mode: "random",
      status: "active",
      fen: "4k3/8/8/8/8/8/4R3/4K3 b - - 0 1",
      turn: "black",
      moves: [],
      white_user_id: "55555555-5555-4555-8555-555555555555",
      black_user_id: "66666666-6666-4666-8666-666666666666",
      white_username: "White",
      black_username: "Black",
      white_ms_remaining: 60000,
      black_ms_remaining: 60000,
      turn_started_at: "2026-09-20T01:00:00.000Z",
      created_at: "2026-09-20T01:00:00.000Z"
    });

    expect(snapshot.isCheck).toBe(true);
    expect(snapshot.turn).toBe("black");
  });
  it("preserves the database state revision", () => {
    const state = mapOnlineRowToSnapshot({
      id: "game-1", state_version: 7, status: "active",
      fen: new Chess().fen(), moves: []
    });
    expect(state.stateVersion).toBe(7);
  });

  it("predicts a legal move instantly without changing the authoritative source", () => {
    const base = mapOnlineRowToSnapshot({
      id: "game-1", state_version: 3, status: "active",
      fen: new Chess().fen(), moves: [],
      white_user_id: "player-1", black_user_id: "player-2"
    });
    const predicted = previewOnlineMove(base, "e2", "e4");
    expect(predicted).not.toBeNull();
    expect(predicted?.turn).toBe("black");
    expect(predicted?.moves).toEqual(["e4"]);
    expect(predicted?.lastMove?.san).toBe("e4");
    expect(predicted?.stateVersion).toBe(3);
    expect(base.moves).toEqual([]);
    expect(base.fen).toBe(new Chess().fen());
    expect(previewOnlineMove(base, "e2", "e5")).toBeNull();
    expect(previewOnlineMove({ ...base, status: "complete" }, "e2", "e4")).toBeNull();
  });

  it("ignores stale realtime state, but accepts a newer server revision", () => {
    const base = mapOnlineRowToSnapshot({
      id: "game-1", state_version: 4, status: "active",
      fen: new Chess().fen(), moves: []
    });
    const previous = { ...base, stateVersion: 3, fen: new Chess().fen() };
    const next = { ...base, stateVersion: 5, status: "complete" as const };
    expect(shouldApplyOnlineSnapshot(base, previous)).toBe(false);
    expect(shouldApplyOnlineSnapshot(base, base)).toBe(false);
    expect(shouldApplyOnlineSnapshot(base, next)).toBe(true);
    expect(shouldApplyOnlineSnapshot(base, { ...base, id: "game-2" })).toBe(true);
  });

  it("does not roll back move history if a legacy payload lacks versions", () => {
    const withMove = mapOnlineRowToSnapshot({
      id: "game-1", status: "active",
      fen: new Chess().fen(), moves: ["e4"]
    });
    const withoutMove = { ...withMove, moves: [], fen: "different-fen" };
    expect(shouldApplyOnlineSnapshot(withMove, withoutMove)).toBe(false);
  });

});
