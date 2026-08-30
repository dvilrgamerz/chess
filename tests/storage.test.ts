import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonDatabase, hashPassword } from "../server/storage.js";

let dir = "";

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "chess-arena-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function db() {
  return new JsonDatabase(path.join(dir, "db.json"));
}

describe("JsonDatabase auth", () => {
  it("validates email, password, and unique usernames", () => {
    const database = db();
    const result = database.createUser("player@example.com", "secret1", "Knight_1");

    expect(result.user.username).toBe("Knight_1");
    expect(database.getUserByToken(result.token)?.email).toBe("player@example.com");
    expect(() => database.createUser("other@example.com", "secret1", "knight_1")).toThrow("username");
    expect(() => database.createUser("bad-email", "secret1", "Rook")).toThrow("email");
    expect(() => database.createUser("rook@example.com", "123", "Rook")).toThrow("Password");
  });

  it("logs in by email or username without storing raw passwords", () => {
    const database = db();
    database.createUser("queen@example.com", "secret1", "Queen");

    expect(database.login("QUEEN", "secret1").user.username).toBe("Queen");
    expect(database.login("queen@example.com", "secret1").user.email).toBe("queen@example.com");
    expect(hashPassword("secret1", "salt")).not.toBe("secret1");
  });
});
