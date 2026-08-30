import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { io as clientIo, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createChessArenaServer } from "../server/index.js";

interface AuthPayload {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

let dir = "";
let server: http.Server | null = null;
let baseUrl = "";
const clients: ClientSocket[] = [];

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "chess-arena-"));
  const created = createChessArenaServer({ dataFile: path.join(dir, "db.json"), serveClient: false });
  server = created.httpServer;
  await new Promise<void>((resolve) => server!.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No test server port.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("online sockets", () => {
  it("creates friend rooms, joins them, and rejects illegal moves", async () => {
    const a = await signup("a@example.com", "Alpha");
    const b = await signup("b@example.com", "Bravo");
    const socketA = await connect(a.token);
    const socketB = await connect(b.token);

    const created = await emit(socketA, "friend:create", { preferredColor: "white" });
    expect(created.ok).toBe(true);
    expect(created.roomCode).toHaveLength(5);

    const joined = await emit(socketB, "friend:join", { roomCode: created.roomCode });
    expect(joined.ok).toBe(true);
    expect(joined.playerColor).toBe("black");

    const invalid = await emit(socketB, "game:move", { gameId: created.gameId, from: "e7", to: "e5" });
    expect(invalid.ok).toBe(false);

    const valid = await emit(socketA, "game:move", { gameId: created.gameId, from: "e2", to: "e4" });
    expect(valid.ok).toBe(true);
  });

  it("pairs random players", async () => {
    const a = await signup("c@example.com", "Charlie");
    const b = await signup("d@example.com", "Delta");
    const socketA = await connect(a.token);
    const socketB = await connect(b.token);

    const first = await emit(socketA, "random:join", null);
    expect(first.queued).toBe(true);

    const matchPromise = once(socketA, "random:matched");
    const second = await emit(socketB, "random:join", null);
    const matched = await matchPromise;

    expect(second.ok).toBe(true);
    expect(second.queued).toBe(false);
    expect(matched.snapshot.status).toBe("active");
  });
});

async function signup(email: string, username: string): Promise<AuthPayload> {
  const response = await fetch(`${baseUrl}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "secret1", username })
  });
  return (await response.json()) as AuthPayload;
}

async function connect(token: string): Promise<ClientSocket> {
  const socket = clientIo(baseUrl, {
    auth: { token },
    transports: ["websocket"],
    forceNew: true
  });
  clients.push(socket);
  await once(socket, "connect");
  return socket;
}

function emit(socket: ClientSocket, event: string, payload: unknown) {
  return new Promise<any>((resolve) => {
    socket.emit(event, payload, resolve);
  });
}

function once<T = any>(socket: ClientSocket, event: string) {
  return new Promise<T>((resolve) => {
    socket.once(event, resolve);
  });
}
