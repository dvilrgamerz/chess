import type { Announcement, AuditLog, AuthResponse, GameRecord, LeaderboardRow, PublicUser, ReportItem, SystemAnalytics, UserSettings } from "../../shared/types.js";
import { supabase } from "./supabase.js";

const tokenKey = "chess-arena-token";
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const defaultSettings: UserSettings = { boardTheme: "emerald", pieceStyle: "classic", soundEnabled: true, soundVolume: 0.7, legalHints: true, autoFlip: false, reducedMotion: false, animationSpeed: 180, botDelayMs: 500, jarvisEnabled: true };

export function getApiBaseUrl() { return apiBase; }
export function getToken() { return sessionStorage.getItem(tokenKey); }
export function setToken(token: string | null) { if (token) sessionStorage.setItem(tokenKey, token); else sessionStorage.removeItem(tokenKey); }

function toPublicUser(p: any, email: string): PublicUser {
  const rating = p.rating ?? 1000;
  return { id: p.id, email, username: p.username, role: p.role === "owner" ? "owner" : "user", rating, formatRatings: { bullet: rating, blitz: rating, rapid: rating }, puzzleRating: p.puzzle_rating ?? 1000, bestRating: p.best_rating ?? rating, streak: 1, xp: p.xp ?? 0, level: p.level ?? 1, isBanned: p.is_banned ?? false, banReason: p.ban_reason ?? undefined, birthYear: p.birth_year ?? undefined, dailyChallenge: { target: 2, completed: 0, lastDate: new Date().toISOString().slice(0, 10) }, blockedUsers: [], wins: p.wins ?? 0, losses: p.losses ?? 0, draws: p.draws ?? 0, createdAt: p.created_at ?? new Date().toISOString(), settings: { ...defaultSettings, ...(p.settings ?? {}) } };
}

async function getProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function signup(email: string, password: string, username: string, birthYear?: number): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { username: username.trim(), birthYear } } });
  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error("Account created. Check your email to confirm your account, then log in.");
  const profile = await getProfile(data.user.id);
  setToken(data.session.access_token);
  return { token: data.session.access_token, user: toPublicUser(profile, data.user.email ?? email) };
}

export async function login(loginName: string, password: string): Promise<AuthResponse> {
  let email = loginName.trim();
  if (!email.includes("@")) {
    const { data, error } = await supabase.from("profiles").select("email").eq("username", email).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.email) throw new Error("Email, username, or password is incorrect.");
    email = data.email;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) throw new Error(error?.message ?? "Login failed.");
  const profile = await getProfile(data.user.id);
  if (profile.is_banned) { await supabase.auth.signOut(); setToken(null); throw new Error(`Your account has been suspended: ${profile.ban_reason ?? "Violation of terms."}`); }
  setToken(data.session.access_token);
  return { token: data.session.access_token, user: toPublicUser(profile, data.user.email ?? email) };
}

export async function currentSession() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not signed in.");
  const profile = await getProfile(user.id);
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) setToken(session.access_token);
  return { user: toPublicUser(profile, user.email ?? "") };
}

export async function logout() { await supabase.auth.signOut(); setToken(null); window.dispatchEvent(new CustomEvent("chess-arena:logout")); return { ok: true as const }; }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers); headers.set("Content-Type", "application/json");
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  const response = await fetch(`${apiBase}${path}`, { ...init, headers, credentials: "omit" });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  // A backend/API failure must not sign the user out of the Supabase session.
  // Supabase is the source of truth for authentication; the API can be temporarily unavailable.
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status}).`);
  return payload;
}

export async function deleteAccount() { return request<{ ok: true }>("/api/account/delete", { method: "POST" }); }
export async function reportPlayer(target: string, reason: string, details?: string) { return request<{ ok: true }>("/api/report", { method: "POST", body: JSON.stringify({ target, reason, details }) }); }
export async function blockPlayer(targetUsername: string) { return request<{ user: PublicUser }>("/api/block", { method: "POST", body: JSON.stringify({ targetUsername }) }); }
export async function getLeaderboard() { return request<{ rows: LeaderboardRow[] }>("/api/leaderboard"); }
export async function getHistory() { return request<{ games: GameRecord[] }>("/api/history"); }
export async function updateSettings(settings: Partial<UserSettings>) { return request<{ user: PublicUser }>("/api/settings", { method: "PATCH", body: JSON.stringify({ settings }) }); }
export async function saveGame(game: GameRecord) { return request<{ game: GameRecord }>("/api/games", { method: "POST", body: JSON.stringify({ game }) }); }
export async function getAnnouncements() { return request<{ announcements: Announcement[] }>("/api/announcements"); }
export async function submitPuzzleSolve(success = true) { return request<{ user: PublicUser }>("/api/puzzle/solve", { method: "POST", body: JSON.stringify({ success }) }); }
export async function verifyOwnerPassword(password: string) { return request<{ ok: true }>("/api/admin/verify-owner", { method: "POST", body: JSON.stringify({ password }) }); }
export async function getAdminUsers() { return request<{ users: PublicUser[] }>("/api/admin/users"); }
export async function banUser(userId: string, isBanned: boolean, banReason?: string) { return request<{ user: PublicUser }>("/api/admin/users/ban", { method: "POST", body: JSON.stringify({ userId, isBanned, banReason }) }); }
export async function setUserRatingAdmin(userId: string, rating: number) { return request<{ user: PublicUser }>("/api/admin/users/rating", { method: "POST", body: JSON.stringify({ userId, rating }) }); }
export async function deleteUserAdmin(userId: string) { return request<{ ok: true }>(`/api/admin/users/${userId}`, { method: "DELETE" }); }
export async function getAdminReports() { return request<{ reports: ReportItem[] }>("/api/admin/reports"); }
export async function updateReportStatus(reportId: string, status: "resolved" | "dismissed") { return request<{ ok: true }>("/api/admin/reports/status", { method: "POST", body: JSON.stringify({ reportId, status }) }); }
export async function getAdminAnalytics() { return request<{ analytics: SystemAnalytics }>("/api/admin/analytics"); }
export async function getAuditLogs() { return request<{ auditLogs: AuditLog[] }>("/api/admin/audit-logs"); }
export async function createAnnouncement(title: string, content: string) { return request<{ announcement: Announcement }>("/api/admin/announcements", { method: "POST", body: JSON.stringify({ title, content }) }); }
