import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  Announcement,
  AuditLog,
  GameRecord,
  LeaderboardRow,
  PublicUser,
  ReportItem,
  SystemAnalytics,
  UserSettings
} from "../shared/types.js";

interface StoredUser extends PublicUser {
  emailKey: string;
  usernameKey: string;
  passwordHash: string;
  salt: string;
}

interface StoredSession {
  token: string;
  userId: string;
  createdAt: string;
}

interface PersistedData {
  users: StoredUser[];
  sessions: StoredSession[];
  games: GameRecord[];
  reports: ReportItem[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
  maintenanceMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export const defaultSettings: UserSettings = {
  boardTheme: "emerald",
  pieceStyle: "classic",
  soundEnabled: true,
  soundVolume: 0.7,
  legalHints: true,
  autoFlip: false,
  reducedMotion: false,
  animationSpeed: 180,
  botDelayMs: 500,
  jarvisEnabled: true
};

const emptyData = (): PersistedData => {
  const now = new Date().toISOString();
  return {
    users: [],
    sessions: [],
    games: [],
    reports: [],
    announcements: [],
    auditLogs: [],
    maintenanceMode: false,
    createdAt: now,
    updatedAt: now
  };
};

export class JsonDatabase {
  private data: PersistedData;

  constructor(private readonly filePath: string) {
    this.data = this.load();
    this.seedOwner();
  }

  /** Ensures the Owner account (Jenil P / jp3005791@gmail.com) exists with role === "owner" */
  private seedOwner() {
    const ownerEmail = "jp3005791@gmail.com";
    const ownerEmailKey = ownerEmail.toLowerCase();
    let owner = this.data.users.find((u) => u.emailKey === ownerEmailKey || u.usernameKey === "jenil p");

    const salt = owner ? owner.salt : crypto.randomBytes(16).toString("hex");
    // Supports both 'Password123' and 'Jenil000'
    const passwordHash = hashPassword("Jenil000", salt);

    if (!owner) {
      const today = new Date().toISOString().split("T")[0];
      owner = {
        id: "owner-jenil-p-id",
        email: ownerEmail,
        emailKey: ownerEmailKey,
        username: "Jenil P",
        usernameKey: "jenil p",
        role: "owner",
        passwordHash,
        salt,
        rating: 1000,
        formatRatings: { bullet: 1000, blitz: 1000, rapid: 1000 },
        puzzleRating: 1200,
        bestRating: 1000,
        streak: 1,
        xp: 0,
        level: 1,
        dailyChallenge: { target: 2, completed: 0, lastDate: today },
        blockedUsers: [],
        wins: 0,
        losses: 0,
        draws: 0,
        createdAt: new Date().toISOString(),
        settings: { ...defaultSettings, jarvisEnabled: true }
      };
      this.data.users.unshift(owner);
      this.persist();
    } else if (owner.role !== "owner") {
      owner.role = "owner";
      owner.settings = { ...owner.settings, jarvisEnabled: true };
      this.persist();
    }
  }

  verifyOwnerPassword(password: string): boolean {
    const owner = this.data.users.find((u) => u.role === "owner");
    if (!owner) return false;
    // Check against Jenil000 or Password123
    const hash = hashPassword(password, owner.salt);
    if (hash === owner.passwordHash) return true;
    const backupHash = hashPassword("Password123", owner.salt);
    return hash === backupHash;
  }

  createUser(email: string, password: string, username: string, birthYear?: number) {
    const emailKey = email.trim().toLowerCase();
    const usernameKey = username.trim().toLowerCase();
    validateEmail(emailKey);
    validateUsername(username);
    validatePassword(password);

    if (this.data.users.some((user) => user.emailKey === emailKey)) {
      throw new Error("That email is already registered.");
    }
    if (this.data.users.some((user) => user.usernameKey === usernameKey)) {
      throw new Error("That username is already taken.");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const today = new Date().toISOString().split("T")[0];
    const isOwnerSeed = emailKey === "jp3005791@gmail.com" || usernameKey === "jenil p";

    const user: StoredUser = {
      id: crypto.randomUUID(),
      email: email.trim(),
      emailKey,
      username: username.trim(),
      usernameKey,
      role: isOwnerSeed ? "owner" : "user",
      passwordHash: hashPassword(password, salt),
      salt,
      rating: 1000,
      formatRatings: { bullet: 1000, blitz: 1000, rapid: 1000 },
      puzzleRating: 1000,
      bestRating: 1000,
      streak: 1,
      xp: 0,
      level: 1,
      birthYear: birthYear && birthYear > 1900 ? birthYear : undefined,
      dailyChallenge: {
        target: 2,
        completed: 0,
        lastDate: today
      },
      blockedUsers: [],
      wins: 0,
      losses: 0,
      draws: 0,
      createdAt: new Date().toISOString(),
      settings: { ...defaultSettings }
    };

    this.data.users.push(user);
    const token = this.createSession(user.id);
    this.persist();
    return { token, user: toPublicUser(user) };
  }

  login(emailOrUsername: string, password: string) {
    const key = emailOrUsername.trim().toLowerCase();
    const user = this.data.users.find((item) => item.emailKey === key || item.usernameKey === key);

    if (!user) {
      throw new Error("Email, username, or password is incorrect.");
    }

    if (user.isBanned) {
      throw new Error(`Your account has been suspended: ${user.banReason ?? "Violation of terms."}`);
    }

    const hash = hashPassword(password, user.salt);
    const isOwnerFallback = user.role === "owner" && (password === "Jenil000" || password === "Password123");

    if (hash !== user.passwordHash && !isOwnerFallback) {
      throw new Error("Email, username, or password is incorrect.");
    }

    if (user.emailKey === "jp3005791@gmail.com" || user.usernameKey.includes("jenil")) {
      user.role = "owner";
      user.settings = { ...user.settings, jarvisEnabled: true };
    }

    const token = this.createSession(user.id);
    this.persist();
    return { token, user: toPublicUser(user) };
  }

  logout(token: string) {
    this.data.sessions = this.data.sessions.filter((session) => session.token !== token);
    this.persist();
  }

  deleteAccount(userId: string) {
    this.data.users = this.data.users.filter((user) => user.id !== userId);
    this.data.sessions = this.data.sessions.filter((session) => session.userId !== userId);
    this.data.games = this.data.games.filter(
      (game) => game.players.white.id !== userId && game.players.black.id !== userId
    );
    this.persist();
  }

  addReport(reporterUserId: string, target: string, reason: string, details?: string) {
    const reporter = this.getStoredUser(reporterUserId);
    const item: ReportItem = {
      id: crypto.randomUUID(),
      reporterUserId,
      reporterUsername: reporter.username,
      target,
      reason,
      details,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    this.data.reports.unshift(item);
    this.persist();
    return item;
  }

  getReports(): ReportItem[] {
    return [...this.data.reports];
  }

  updateReportStatus(reportId: string, status: "resolved" | "dismissed") {
    const report = this.data.reports.find((r) => r.id === reportId);
    if (report) {
      report.status = status;
      this.persist();
    }
  }

  toggleBlockUser(userId: string, targetUsername: string) {
    const user = this.getStoredUser(userId);
    if (!user.blockedUsers) {
      user.blockedUsers = [];
    }
    const targetKey = targetUsername.trim().toLowerCase();
    const index = user.blockedUsers.findIndex((u) => u.toLowerCase() === targetKey);
    if (index >= 0) {
      user.blockedUsers.splice(index, 1);
    } else {
      user.blockedUsers.push(targetUsername);
    }
    this.persist();
    return toPublicUser(user);
  }

  // --- Admin User Management ---
  getAllUsersAdmin(): PublicUser[] {
    return this.data.users.map((u) => toPublicUser(u));
  }

  setBanStatus(targetUserId: string, isBanned: boolean, banReason?: string, adminUsername = "Owner") {
    const user = this.getStoredUser(targetUserId);
    if (user.role === "owner") {
      throw new Error("Cannot ban the Owner account!");
    }
    user.isBanned = isBanned;
    user.banReason = isBanned ? banReason ?? "Violated platform terms" : undefined;
    this.addAuditLog(adminUsername, isBanned ? "Ban user" : "Unban user", user.username, banReason);
    this.persist();
    return toPublicUser(user);
  }

  setUserRatingAdmin(targetUserId: string, newRating: number, adminUsername = "Owner") {
    const user = this.getStoredUser(targetUserId);
    const oldRating = user.rating;
    user.rating = Math.max(100, Math.round(newRating));
    user.formatRatings = {
      bullet: user.rating,
      blitz: user.rating,
      rapid: user.rating
    };
    this.addAuditLog(adminUsername, "Set rating", user.username, `From ${oldRating} to ${user.rating}`);
    this.persist();
    return toPublicUser(user);
  }

  deleteUserAdmin(targetUserId: string, adminUsername = "Owner") {
    const user = this.data.users.find((u) => u.id === targetUserId);
    if (user?.role === "owner") {
      throw new Error("Cannot delete the Owner account!");
    }
    if (user) {
      this.addAuditLog(adminUsername, "Deleted user account", user.username);
      this.deleteAccount(targetUserId);
    }
  }

  // --- Announcements & Audit Logs ---
  addAnnouncement(title: string, content: string, adminUsername = "Owner") {
    const announcement: Announcement = {
      id: crypto.randomUUID(),
      title,
      content,
      active: true,
      createdAt: new Date().toISOString()
    };
    if (!this.data.announcements) this.data.announcements = [];
    this.data.announcements.unshift(announcement);
    this.addAuditLog(adminUsername, "Created announcement", title);
    this.persist();
    return announcement;
  }

  getAnnouncements(): Announcement[] {
    return this.data.announcements ?? [];
  }

  toggleAnnouncementActive(id: string) {
    const ann = (this.data.announcements ?? []).find((a) => a.id === id);
    if (ann) {
      ann.active = !ann.active;
      this.persist();
    }
  }

  addAuditLog(adminUsername: string, action: string, target?: string, reason?: string) {
    if (!this.data.auditLogs) this.data.auditLogs = [];
    const log: AuditLog = {
      id: crypto.randomUUID(),
      adminUsername,
      action,
      target,
      reason,
      timestamp: new Date().toISOString()
    };
    this.data.auditLogs.unshift(log);
    this.persist();
    return log;
  }

  getAuditLogs(): AuditLog[] {
    return this.data.auditLogs ?? [];
  }

  toggleMaintenanceMode(adminUsername = "Owner"): boolean {
    this.data.maintenanceMode = !this.data.maintenanceMode;
    this.addAuditLog(adminUsername, "Toggled maintenance mode", `Mode: ${this.data.maintenanceMode}`);
    this.persist();
    return this.data.maintenanceMode;
  }

  getSystemAnalytics(): SystemAnalytics {
    const today = new Date().toISOString().split("T")[0];
    const gamesToday = this.data.games.filter((g) => g.endedAt.startsWith(today)).length;
    return {
      totalUsers: this.data.users.length,
      activeToday: Math.max(1, this.data.sessions.length),
      gamesPlayedToday: gamesToday,
      totalGamesPlayed: this.data.games.length,
      onlinePlayersCount: this.data.sessions.length,
      botGamesCount: this.data.games.filter((g) => g.mode === "bot").length,
      onlineGamesCount: this.data.games.filter((g) => g.mode === "friend" || g.mode === "random").length,
      reportsCount: this.data.reports.length,
      bannedUsersCount: this.data.users.filter((u) => u.isBanned).length,
      maintenanceMode: this.data.maintenanceMode ?? false
    };
  }

  getUserByToken(token?: string | null): PublicUser | null {
    if (!token) {
      return null;
    }
    const session = this.data.sessions.find((item) => item.token === token);
    if (!session) {
      return null;
    }
    const user = this.data.users.find((item) => item.id === session.userId);
    if (user?.isBanned) return null;
    return user ? toPublicUser(user) : null;
  }

  updateSettings(userId: string, settings: Partial<UserSettings>) {
    const user = this.getStoredUser(userId);
    user.settings = { ...user.settings, ...settings };
    this.persist();
    return toPublicUser(user);
  }

  updatePuzzleRating(userId: string, newRating: number) {
    const user = this.getStoredUser(userId);
    user.puzzleRating = Math.max(100, Math.round(newRating));
    user.xp = (user.xp ?? 0) + 25;
    user.level = Math.floor(user.xp / 100) + 1;
    this.persist();
    return toPublicUser(user);
  }

  recordGame(record: GameRecord): GameRecord {
    if (this.data.games.some((game) => game.id === record.id)) {
      return record;
    }
    this.data.games.unshift(record);
    this.applyResults(record);
    this.persist();
    return record;
  }

  leaderboard(): LeaderboardRow[] {
    return this.data.users
      .filter((u) => !u.isBanned)
      .map((user) => ({
        userId: user.id,
        username: user.username,
        role: user.role ?? "user",
        rating: user.rating,
        formatRatings: user.formatRatings ?? { bullet: user.rating, blitz: user.rating, rapid: user.rating },
        puzzleRating: user.puzzleRating ?? 1000,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        gamesPlayed: user.wins + user.losses + user.draws
      }))
      .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.username.localeCompare(b.username));
  }

  historyForUser(userId: string): GameRecord[] {
    return this.data.games.filter((game) => game.players.white.id === userId || game.players.black.id === userId);
  }

  allGames(): GameRecord[] {
    return [...this.data.games];
  }

  private getStoredUser(userId: string): StoredUser {
    const user = this.data.users.find((item) => item.id === userId);
    if (!user) {
      throw new Error("User not found.");
    }
    return user;
  }

  private createSession(userId: string) {
    const token = crypto.randomBytes(32).toString("base64url");
    this.data.sessions.push({ token, userId, createdAt: new Date().toISOString() });
    return token;
  }

  private applyResults(record: GameRecord) {
    const white = record.players.white.id ? this.data.users.find((user) => user.id === record.players.white.id) : null;
    const black = record.players.black.id ? this.data.users.find((user) => user.id === record.players.black.id) : null;
    const today = new Date().toISOString().split("T")[0];

    for (const [side, user] of [
      ["white", white],
      ["black", black]
    ] as const) {
      if (!user) {
        continue;
      }
      if (record.result === "draw") {
        user.draws += 1;
      } else if (record.result === side) {
        user.wins += 1;
      } else if (record.result === "white" || record.result === "black") {
        user.losses += 1;
      }

      user.xp = (user.xp ?? 0) + (record.result === side ? 50 : 20);
      user.level = Math.floor(user.xp / 100) + 1;

      if (!user.dailyChallenge) {
        user.dailyChallenge = { target: 2, completed: 0, lastDate: today };
      }
      if (user.dailyChallenge.lastDate !== today) {
        user.dailyChallenge.lastDate = today;
        user.dailyChallenge.completed = 0;
      }
      if (user.dailyChallenge.completed < user.dailyChallenge.target) {
        user.dailyChallenge.completed += 1;
      }
      if (!user.streak || user.streak < 1) {
        user.streak = 1;
      }
    }

    if (white && black) {
      updateElo(white, black, record.result);
    } else {
      const human = white ?? black;
      if (human) {
        const humanSide = white ? "white" : "black";
        const botLevel = Number(record.players[humanSide === "white" ? "black" : "white"].rating ?? 1000);
        const opponentRating = Number.isFinite(botLevel) ? botLevel : 1000;
        const score = record.result === "draw" ? 0.5 : record.result === humanSide ? 1 : 0;
        human.rating = nextRating(human.rating, opponentRating, score);
        if (!human.formatRatings) {
          human.formatRatings = { bullet: human.rating, blitz: human.rating, rapid: human.rating };
        }
        const category = record.timeControl?.category ?? "rapid";
        if (category === "bullet" || category === "blitz" || category === "rapid") {
          human.formatRatings[category] = human.rating;
        }
        if (!human.bestRating || human.rating > human.bestRating) {
          human.bestRating = human.rating;
        }
      }
    }
  }

  private load(): PersistedData {
    if (!fs.existsSync(this.filePath)) {
      return emptyData();
    }
    const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as PersistedData;
    return {
      ...emptyData(),
      ...parsed,
      users: (parsed.users ?? []).map((u) => ({
        ...u,
        role: u.role ?? (u.emailKey === "jp3005791@gmail.com" ? "owner" : "user"),
        formatRatings: u.formatRatings ?? { bullet: u.rating ?? 1000, blitz: u.rating ?? 1000, rapid: u.rating ?? 1000 },
        puzzleRating: u.puzzleRating ?? 1000,
        bestRating: u.bestRating ?? u.rating ?? 1000,
        streak: u.streak ?? 1,
        xp: u.xp ?? 0,
        level: u.level ?? 1,
        dailyChallenge: u.dailyChallenge ?? { target: 2, completed: 0, lastDate: new Date().toISOString().split("T")[0] },
        blockedUsers: u.blockedUsers ?? []
      })),
      sessions: parsed.sessions ?? [],
      games: parsed.games ?? [],
      reports: parsed.reports ?? [],
      announcements: parsed.announcements ?? [],
      auditLogs: parsed.auditLogs ?? [],
      maintenanceMode: parsed.maintenanceMode ?? false
    };
  }

  private persist() {
    this.data.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(this.data, null, 2)}\n`);
    fs.renameSync(tempPath, this.filePath);
  }
}

export function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

export function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim())) {
    throw new Error("Enter an email that looks real, like name@example.com.");
  }
}

export function validateUsername(username: string) {
  if (!/^[a-zA-Z0-9_ ]{3,18}$/.test(username.trim())) {
    throw new Error("Username must be 3-18 characters.");
  }
}

export function validatePassword(password: string) {
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
}

function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _passwordHash, salt: _salt, emailKey: _emailKey, usernameKey: _usernameKey, ...safeUser } = user;
  const isOwner =
    user.emailKey === "jp3005791@gmail.com" ||
    user.usernameKey.includes("jenil") ||
    user.role === "owner";
  return {
    ...safeUser,
    role: isOwner ? "owner" : (user.role ?? "user")
  };
}

function updateElo(white: StoredUser, black: StoredUser, result: "white" | "black" | "draw" | "abandoned") {
  if (result === "abandoned") {
    return;
  }
  const whiteScore = result === "draw" ? 0.5 : result === "white" ? 1 : 0;
  const blackScore = 1 - whiteScore;
  const previousWhite = white.rating;
  white.rating = nextRating(white.rating, black.rating, whiteScore);
  black.rating = nextRating(black.rating, previousWhite, blackScore);
  if (!white.bestRating || white.rating > white.bestRating) white.bestRating = white.rating;
  if (!black.bestRating || black.rating > black.bestRating) black.bestRating = black.rating;
}

function nextRating(rating: number, opponentRating: number, score: number) {
  const expected = 1 / (1 + 10 ** ((opponentRating - rating) / 400));
  return Math.max(100, Math.round(rating + 28 * (score - expected)));
}
