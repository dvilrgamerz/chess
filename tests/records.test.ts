import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonDatabase } from "../server/storage.js";
import type { GameRecord } from "../shared/types.js";

let dir = "";

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "chess-arena-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("game records", () => {
  it("updates leaderboard and history from completed games", () => {
    const database = new JsonDatabase(path.join(dir, "db.json"));
    const white = database.createUser("white@example.com", "secret1", "WhiteKing").user;
    const black = database.createUser("black@example.com", "secret1", "BlackKing").user;
    const startedAt = new Date(Date.now() - 1000).toISOString();
    const endedAt = new Date().toISOString();
    const record: GameRecord = {
      id: "game-1",
      mode: "friend",
      players: {
        white: { id: white.id, username: white.username, kind: "human", rating: white.rating },
        black: { id: black.id, username: black.username, kind: "human", rating: black.rating }
      },
      result: "white",
      reason: "checkmate",
      moves: ["e4", "e5", "Qh5"],
      finalFen: "test",
      startedAt,
      endedAt,
      durationMs: 1000
    };

    database.recordGame(record);
    const leaderboard = database.leaderboard();

    expect(database.historyForUser(white.id)).toHaveLength(1);
    expect(leaderboard.find((row) => row.userId === white.id)?.wins).toBe(1);
    expect(leaderboard.find((row) => row.userId === black.id)?.losses).toBe(1);
    expect(leaderboard[0].username).toBe("WhiteKing");
  });
});
