import { Chess } from "chess.js";
import type { Server, Socket } from "socket.io";
import { getGameResult, getLastMove, oppositeSide, sideFromTurn, tryMove } from "../shared/chess.js";
import type {
  GameEndReason,
  GameMode,
  GameRecord,
  GameResult,
  GameSnapshot,
  PlayerSeat,
  PublicUser,
  Side
} from "../shared/types.js";
import type { JsonDatabase } from "./storage.js";

interface OnlinePlayer extends PlayerSeat {
  socketId: string;
  connected: boolean;
}

interface OnlineGame {
  id: string;
  roomCode?: string;
  mode: Extract<GameMode, "friend" | "random">;
  chess: Chess;
  players: {
    white?: OnlinePlayer;
    black?: OnlinePlayer;
  };
  status: "waiting" | "active" | "complete";
  startedAt: string;
  endedAt?: string;
  result?: GameResult;
  reason?: GameEndReason;
  drawOfferFrom?: Side;
}

interface QueuedPlayer {
  socketId: string;
  user: PublicUser;
}

type Ack<T> = (response: T) => void;
type SocketWithUser = Socket & { data: { user: PublicUser } };

const disconnectGraceMs = 15000;
const GAME_CLEANUP_MS = 30 * 60 * 1000;

export function registerOnlineGameHandlers(io: Server, db: JsonDatabase) {
  const games = new Map<string, OnlineGame>();
  const queue: QueuedPlayer[] = [];
  const disconnectTimers = new Map<string, NodeJS.Timeout>();
  const cleanupTimers = new Map<string, NodeJS.Timeout>();

  io.on("connection", (socket: SocketWithUser) => {
    socket.on("friend:create", (payload: { preferredColor?: Side }, ack?: Ack<unknown>) => {
      const preferredColor = payload.preferredColor === "black" ? "black" : "white";
      const game = createGame("friend", socket.data.user);
      const roomCode = createRoomCode(games);
      game.roomCode = roomCode;
      game.players[preferredColor] = playerFromSocket(socket);
      games.set(game.id, game);
      socket.join(game.id);
      ack?.({ ok: true, roomCode, gameId: game.id, playerColor: preferredColor, snapshot: snapshot(game) });
      io.to(game.id).emit("game:update", snapshot(game));
    });

    socket.on("friend:join", (payload: { roomCode?: string }, ack?: Ack<unknown>) => {
      const roomCode = payload.roomCode?.trim().toUpperCase();
      const game = [...games.values()].find((item) => item.roomCode === roomCode && item.status !== "complete");
      if (!game) {
        ack?.({ ok: false, error: "Room code was not found." });
        return;
      }
      if (game.players.white?.id === socket.data.user.id || game.players.black?.id === socket.data.user.id) {
        reconnectPlayer(game, socket);
        socket.join(game.id);
        ack?.({ ok: true, gameId: game.id, playerColor: getPlayerColor(game, socket.data.user.id), snapshot: snapshot(game) });
        io.to(game.id).emit("game:update", snapshot(game));
        return;
      }
      const openColor: Side | null = game.players.white ? (game.players.black ? null : "black") : "white";
      if (!openColor) {
        ack?.({ ok: false, error: "That room is already full." });
        return;
      }
      game.players[openColor] = playerFromSocket(socket);
      game.status = "active";
      socket.join(game.id);
      ack?.({ ok: true, gameId: game.id, playerColor: openColor, snapshot: snapshot(game) });
      io.to(game.id).emit("game:update", snapshot(game));
    });

    socket.on("random:join", (_payload: unknown, ack?: Ack<unknown>) => {
      if (queue.some((item) => item.user.id === socket.data.user.id)) {
        ack?.({ ok: true, queued: true });
        return;
      }
      const opponent = queue.shift();
      if (!opponent) {
        queue.push({ socketId: socket.id, user: socket.data.user });
        ack?.({ ok: true, queued: true });
        return;
      }

      const game = createGame("random", opponent.user);
      const socketIsWhite = Math.random() > 0.5;
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      game.players[socketIsWhite ? "white" : "black"] = playerFromSocket(socket);
      game.players[socketIsWhite ? "black" : "white"] = {
        ...playerFromUser(opponent.user),
        socketId: opponent.socketId,
        connected: true
      };
      game.status = "active";
      games.set(game.id, game);
      socket.join(game.id);
      opponentSocket?.join(game.id);
      const state = snapshot(game);
      ack?.({ ok: true, queued: false, gameId: game.id, playerColor: socketIsWhite ? "white" : "black", snapshot: state });
      opponentSocket?.emit("random:matched", {
        gameId: game.id,
        playerColor: socketIsWhite ? "black" : "white",
        snapshot: state
      });
      io.to(game.id).emit("game:update", state);
    });

    socket.on("random:leave", (_payload: unknown, ack?: Ack<unknown>) => {
      removeFromQueue(queue, socket.id);
      ack?.({ ok: true });
    });

    socket.on("game:sync", (payload: { gameId?: string }, ack?: Ack<unknown>) => {
      const game = games.get(payload.gameId ?? "");
      if (!game) {
        ack?.({ ok: false, error: "Game was not found." });
        return;
      }
      const color = reconnectPlayer(game, socket);
      if (!color) {
        ack?.({ ok: false, error: "You are not in that game." });
        return;
      }
      socket.join(game.id);
      ack?.({ ok: true, playerColor: color, snapshot: snapshot(game) });
      io.to(game.id).emit("game:update", snapshot(game));
    });

    socket.on("game:move", (payload: { gameId?: string; from?: string; to?: string; promotion?: string }, ack?: Ack<unknown>) => {
      const game = games.get(payload.gameId ?? "");
      const color = game ? getPlayerColor(game, socket.data.user.id) : null;
      if (!game || !color) {
        ack?.({ ok: false, error: "Game was not found." });
        return;
      }
      if (game.status !== "active") {
        ack?.({ ok: false, error: "Game is not active." });
        return;
      }
      if (sideFromTurn(game.chess.turn()) !== color) {
        ack?.({ ok: false, error: "It is not your turn." });
        return;
      }
      if (!payload.from || !payload.to) {
        ack?.({ ok: false, error: "Move is missing a square." });
        return;
      }
      const move = tryMove(game.chess, payload.from, payload.to, payload.promotion ?? "q");
      if (!move) {
        ack?.({ ok: false, error: "That move is not legal." });
        return;
      }
      game.drawOfferFrom = undefined;
      finishIfGameOver(game, db, games, disconnectTimers, cleanupTimers);
      ack?.({ ok: true, move });
      io.to(game.id).emit("game:update", snapshot(game));
    });

    socket.on("game:resign", (payload: { gameId?: string }, ack?: Ack<unknown>) => {
      const game = games.get(payload.gameId ?? "");
      const color = game ? getPlayerColor(game, socket.data.user.id) : null;
      if (!game || !color || game.status === "complete") {
        ack?.({ ok: false, error: "Game was not found." });
        return;
      }
      completeGame(game, oppositeSide(color), "resign", db, games, disconnectTimers, cleanupTimers);
      ack?.({ ok: true });
      io.to(game.id).emit("game:update", snapshot(game));
    });

    socket.on("game:draw-offer", (payload: { gameId?: string }, ack?: Ack<unknown>) => {
      const game = games.get(payload.gameId ?? "");
      const color = game ? getPlayerColor(game, socket.data.user.id) : null;
      if (!game || !color || game.status !== "active") {
        ack?.({ ok: false, error: "Game was not found." });
        return;
      }
      game.drawOfferFrom = color;
      ack?.({ ok: true });
      io.to(game.id).emit("game:update", snapshot(game));
    });

    socket.on("game:draw-accept", (payload: { gameId?: string }, ack?: Ack<unknown>) => {
      const game = games.get(payload.gameId ?? "");
      const color = game ? getPlayerColor(game, socket.data.user.id) : null;
      if (!game || !color || game.status !== "active" || !game.drawOfferFrom || game.drawOfferFrom === color) {
        ack?.({ ok: false, error: "No draw offer is waiting for you." });
        return;
      }
      completeGame(game, "draw", "agreement", db, games, disconnectTimers, cleanupTimers);
      ack?.({ ok: true });
      io.to(game.id).emit("game:update", snapshot(game));
    });

    socket.on("game:rematch", (payload: { gameId?: string }, ack?: Ack<unknown>) => {
      const previous = games.get(payload.gameId ?? "");
      if (!previous || previous.status !== "complete") {
        ack?.({ ok: false, error: "A rematch is available after the game ends." });
        return;
      }
      const color = getPlayerColor(previous, socket.data.user.id);
      if (!color || !previous.players.white || !previous.players.black) {
        ack?.({ ok: false, error: "Could not start a rematch." });
        return;
      }
      const rematch = createGame(previous.mode, socket.data.user);
      rematch.roomCode = previous.roomCode;
      rematch.status = "active";
      rematch.players.white = { ...previous.players.black, connected: previous.players.black.connected };
      rematch.players.black = { ...previous.players.white, connected: previous.players.white.connected };
      games.set(rematch.id, rematch);
      io.sockets.sockets.get(rematch.players.white.socketId)?.join(rematch.id);
      io.sockets.sockets.get(rematch.players.black.socketId)?.join(rematch.id);
      ack?.({ ok: true, gameId: rematch.id, playerColor: oppositeSide(color), snapshot: snapshot(rematch) });
      io.to(rematch.id).emit("game:update", snapshot(rematch));
    });

    socket.on("disconnect", () => {
      removeFromQueue(queue, socket.id);
      for (const game of games.values()) {
        const color = game.players.white?.socketId === socket.id ? "white" : game.players.black?.socketId === socket.id ? "black" : null;
        if (!color || game.status !== "active") {
          continue;
        }
        game.players[color]!.connected = false;
        io.to(game.id).emit("game:update", snapshot(game));
        const timerKey = `${game.id}:${color}`;
        disconnectTimers.set(
          timerKey,
          setTimeout(() => {
            if (game.status === "active" && game.players[color]?.connected === false) {
              completeGame(game, oppositeSide(color), "disconnect", db, games, disconnectTimers, cleanupTimers);
              io.to(game.id).emit("game:update", snapshot(game));
            }
            disconnectTimers.delete(timerKey);
          }, disconnectGraceMs)
        );
      }
    });
  });

  return { games, queue };
}

function createGame(mode: Extract<GameMode, "friend" | "random">, _user: PublicUser): OnlineGame {
  return {
    id: cryptoRandomId(),
    mode,
    chess: new Chess(),
    players: {},
    status: "waiting",
    startedAt: new Date().toISOString()
  };
}

function createRoomCode(games: Map<string, OnlineGame>) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while ([...games.values()].some((game) => game.roomCode === code));
  return code;
}

function playerFromSocket(socket: SocketWithUser): OnlinePlayer {
  return { ...playerFromUser(socket.data.user), socketId: socket.id, connected: true };
}

function playerFromUser(user: PublicUser): PlayerSeat {
  return { id: user.id, username: user.username, kind: "human", connected: true, rating: user.rating };
}

function getPlayerColor(game: OnlineGame, userId: string): Side | null {
  if (game.players.white?.id === userId) {
    return "white";
  }
  if (game.players.black?.id === userId) {
    return "black";
  }
  return null;
}

function reconnectPlayer(game: OnlineGame, socket: SocketWithUser): Side | null {
  const color = getPlayerColor(game, socket.data.user.id);
  if (!color) {
    return null;
  }
  game.players[color]!.socketId = socket.id;
  game.players[color]!.connected = true;
  return color;
}

function removeFromQueue(queue: QueuedPlayer[], socketId: string) {
  const index = queue.findIndex((item) => item.socketId === socketId);
  if (index >= 0) {
    queue.splice(index, 1);
  }
}

function finishIfGameOver(
  game: OnlineGame,
  db: JsonDatabase,
  games: Map<string, OnlineGame>,
  disconnectTimers: Map<string, NodeJS.Timeout>,
  cleanupTimers: Map<string, NodeJS.Timeout>
) {
  const result = getGameResult(game.chess);
  if (result) {
    completeGame(game, result.result, result.reason, db, games, disconnectTimers, cleanupTimers);
  }
}

function completeGame(
  game: OnlineGame,
  result: GameResult,
  reason: GameEndReason,
  db: JsonDatabase,
  games: Map<string, OnlineGame>,
  disconnectTimers: Map<string, NodeJS.Timeout>,
  cleanupTimers: Map<string, NodeJS.Timeout>
) {
  if (game.status === "complete") {
    return;
  }
  game.status = "complete";
  game.endedAt = new Date().toISOString();
  game.result = result;
  game.reason = reason;
  if (game.players.white && game.players.black) {
    db.recordGame(toRecord(game));
  }

  if (!cleanupTimers.has(game.id)) {
    cleanupTimers.set(
      game.id,
      setTimeout(() => {
        games.delete(game.id);
        const timerW = disconnectTimers.get(`${game.id}:white`);
        if (timerW) clearTimeout(timerW);
        const timerB = disconnectTimers.get(`${game.id}:black`);
        if (timerB) clearTimeout(timerB);
        disconnectTimers.delete(`${game.id}:white`);
        disconnectTimers.delete(`${game.id}:black`);
        cleanupTimers.delete(game.id);
      }, GAME_CLEANUP_MS)
    );
  }
}

function snapshot(game: OnlineGame): GameSnapshot {
  return {
    id: game.id,
    mode: game.mode,
    roomCode: game.roomCode,
    status: game.status,
    fen: game.chess.fen(),
    turn: sideFromTurn(game.chess.turn()),
    players: {
      white: game.players.white ? publicSeat(game.players.white) : undefined,
      black: game.players.black ? publicSeat(game.players.black) : undefined
    },
    moves: game.chess.history(),
    lastMove: getLastMove(game.chess),
    isCheck: game.chess.inCheck(),
    result: game.result,
    reason: game.reason,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    drawOfferFrom: game.drawOfferFrom
  };
}

function publicSeat(player: OnlinePlayer): PlayerSeat {
  const { socketId: _socketId, ...seat } = player;
  return seat;
}

function toRecord(game: OnlineGame): GameRecord {
  const endedAt = game.endedAt ?? new Date().toISOString();
  return {
    id: game.id,
    mode: game.mode,
    players: {
      white: publicSeat(game.players.white!),
      black: publicSeat(game.players.black!)
    },
    result: game.result ?? "abandoned",
    reason: game.reason ?? "disconnect",
    moves: game.chess.history(),
    finalFen: game.chess.fen(),
    startedAt: game.startedAt,
    endedAt,
    durationMs: new Date(endedAt).getTime() - new Date(game.startedAt).getTime()
  };
}

function cryptoRandomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
