import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import type { GameRecord, PublicUser, UserSettings } from "../shared/types.js";
import { registerOnlineGameHandlers } from "./onlineGames.js";
import { JsonDatabase } from "./storage.js";

interface ServerOptions {
  dataFile?: string;
  serveClient?: boolean;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

export function createChessArenaServer(options: ServerOptions = {}) {
  const app = express();
  const httpServer = http.createServer(app);
  const db = new JsonDatabase(options.dataFile ?? path.join(process.cwd(), "data", "chess-arena.json"));
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "Chess Arena" });
  });

  app.get("/api/announcements", (_req, res) => {
    res.json({ announcements: db.getAnnouncements() });
  });

  app.post("/api/signup", (req, res) => {
    try {
      const birthYear = req.body.birthYear ? Number(req.body.birthYear) : undefined;
      const result = db.createUser(
        String(req.body.email ?? ""),
        String(req.body.password ?? ""),
        String(req.body.username ?? ""),
        birthYear
      );
      res.status(201).json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/login", (req, res) => {
    try {
      res.json(db.login(String(req.body.login ?? ""), String(req.body.password ?? "")));
    } catch (error) {
      sendError(res, error, 401);
    }
  });

  app.post("/api/logout", (req, res) => {
    db.logout(readToken(req) ?? "");
    res.json({ ok: true });
  });

  app.post("/api/account/delete", (req, res) => {
    const user = requireUser(req, res, db);
    if (!user) return;
    db.deleteAccount(user.id);
    res.json({ ok: true });
  });

  app.post("/api/report", (req, res) => {
    const user = requireUser(req, res, db);
    if (!user) return;
    try {
      db.addReport(user.id, String(req.body.target ?? ""), String(req.body.reason ?? ""), req.body.details ? String(req.body.details) : undefined);
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/block", (req, res) => {
    const user = requireUser(req, res, db);
    if (!user) return;
    try {
      const updatedUser = db.toggleBlockUser(user.id, String(req.body.targetUsername ?? ""));
      res.json({ user: updatedUser });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/session", (req, res) => {
    const user = db.getUserByToken(readToken(req));
    if (!user) {
      res.status(401).json({ error: "Not signed in." });
      return;
    }
    res.json({ user });
  });

  app.get("/api/leaderboard", (_req, res) => {
    res.json({ rows: db.leaderboard() });
  });

  app.get("/api/history", (req, res) => {
    const user = requireUser(req, res, db);
    if (!user) {
      return;
    }
    res.json({ games: db.historyForUser(user.id) });
  });

  app.patch("/api/settings", (req, res) => {
    const user = requireUser(req, res, db);
    if (!user) {
      return;
    }
    try {
      res.json({ user: db.updateSettings(user.id, req.body.settings as Partial<UserSettings>) });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/puzzle/solve", (req, res) => {
    const user = requireUser(req, res, db);
    if (!user) return;
    const success = Boolean(req.body.success);
    res.json({ user: db.updatePuzzleRating(user.id, success) });
  });

  app.post("/api/games", (req, res) => {
    const user = requireUser(req, res, db);
    if (!user) {
      return;
    }
    try {
      const record = req.body.game as GameRecord;
      if (!record?.id || !record.players?.white || !record.players?.black) {
        throw new Error("Game record is incomplete.");
      }
      if (record.players.white.id !== user.id && record.players.black.id !== user.id) {
        throw new Error("You can only save games you played.");
      }
      res.status(201).json({ game: db.recordGame(record) });
    } catch (error) {
      sendError(res, error);
    }
  });

  // --- Admin API Endpoints (Owner Only) ---
  app.post("/api/admin/verify-owner", (req, res) => {
    const user = requireUser(req, res, db);
    if (!user || user.role !== "owner") {
      res.status(403).json({ error: "Access denied. Owner account required." });
      return;
    }
    const password = String(req.body.password ?? "");
    const verified = db.verifyOwnerPassword(password);
    if (verified) {
      db.addAuditLog(user.username, "Owner password verified", "Admin Panel access unlocked");
      res.json({ ok: true });
    } else {
      res.status(401).json({ error: "Owner verification password incorrect." });
    }
  });

  app.get("/api/admin/users", (req, res) => {
    const user = requireOwner(req, res, db);
    if (!user) return;
    res.json({ users: db.getAllUsersAdmin() });
  });

  app.post("/api/admin/users/ban", (req, res) => {
    const user = requireOwner(req, res, db);
    if (!user) return;
    try {
      const updatedUser = db.setBanStatus(
        String(req.body.userId ?? ""),
        Boolean(req.body.isBanned),
        req.body.banReason ? String(req.body.banReason) : undefined,
        user.username
      );
      res.json({ user: updatedUser });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/admin/users/rating", (req, res) => {
    const user = requireOwner(req, res, db);
    if (!user) return;
    try {
      const updatedUser = db.setUserRatingAdmin(
        String(req.body.userId ?? ""),
        Number(req.body.rating ?? 1000),
        user.username
      );
      res.json({ user: updatedUser });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.delete("/api/admin/users/:userId", (req, res) => {
    const user = requireOwner(req, res, db);
    if (!user) return;
    try {
      db.deleteUserAdmin(req.params.userId, user.username);
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/admin/reports", (req, res) => {
    const user = requireOwner(req, res, db);
    if (!user) return;
    res.json({ reports: db.getReports() });
  });

  app.post("/api/admin/reports/status", (req, res) => {
    const user = requireOwner(req, res, db);
    if (!user) return;
    db.updateReportStatus(String(req.body.reportId ?? ""), req.body.status as "resolved" | "dismissed");
    res.json({ ok: true });
  });

  app.get("/api/admin/analytics", (req, res) => {
    const user = requireOwner(req, res, db);
    if (!user) return;
    res.json({ analytics: db.getSystemAnalytics() });
  });

  app.get("/api/admin/audit-logs", (req, res) => {
    const user = requireOwner(req, res, db);
    if (!user) return;
    res.json({ auditLogs: db.getAuditLogs() });
  });

  app.post("/api/admin/announcements", (req, res) => {
    const user = requireOwner(req, res, db);
    if (!user) return;
    try {
      const announcement = db.addAnnouncement(
        String(req.body.title ?? ""),
        String(req.body.content ?? ""),
        user.username
      );
      res.json({ announcement });
    } catch (error) {
      sendError(res, error);
    }
  });

  io.use((socket, next) => {
    const token = typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : "";
    const user = db.getUserByToken(token);
    if (!user) {
      next(new Error("Sign in before playing online."));
      return;
    }
    socket.data.user = user;
    next();
  });

  registerOnlineGameHandlers(io, db);

  if (options.serveClient ?? process.env.NODE_ENV === "production") {
    const clientDir = path.join(rootDir, "dist", "client");
    app.use(express.static(clientDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }

  return { app, httpServer, io, db };
}

function readToken(req: express.Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length);
}

function requireUser(req: express.Request, res: express.Response, db: JsonDatabase): PublicUser | null {
  const user = db.getUserByToken(readToken(req));
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return null;
  }
  return user;
}

function requireOwner(req: express.Request, res: express.Response, db: JsonDatabase): PublicUser | null {
  const user = requireUser(req, res, db);
  if (!user || user.role !== "owner") {
    res.status(403).json({ error: "Access denied. Owner privileges required." });
    return null;
  }
  return user;
}

function sendError(res: express.Response, error: unknown, status = 400) {
  res.status(status).json({ error: error instanceof Error ? error.message : "Something went wrong." });
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 4000);
  const { httpServer } = createChessArenaServer();
  httpServer.listen(port, () => {
    console.log(`Chess Arena server listening on http://localhost:${port}`);
  });
}
