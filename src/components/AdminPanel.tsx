import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Bell,
  CheckCircle,
  Crown,
  FileText,
  Lock,
  Medal,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  Users
} from "lucide-react";
import {
  banUser,
  createAnnouncement,
  deleteUserAdmin,
  getAdminAnalytics,
  getAdminReports,
  getAdminUsers,
  getAuditLogs,
  setUserRatingAdmin,
  updateReportStatus
} from "../lib/api.js";
import type { Announcement, AuditLog, PublicUser, ReportItem, SystemAnalytics } from "../../shared/types.js";
import { OwnerVerifyModal } from "./OwnerVerifyModal.js";

type AdminTab = "users" | "reports" | "analytics" | "announcements" | "audit";

interface AdminPanelProps {
  currentUser: PublicUser;
}

export function AdminPanel({ currentUser }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>("users");
  const [isVerified, setIsVerified] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(true);
  const [pendingAction, setPendingAction] = useState<{ title: string; fn: () => void } | null>(null);

  const [users, setUsers] = useState<PublicUser[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  // Announcement Form State
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");

  useEffect(() => {
    if (isVerified) {
      loadAdminData();
    }
  }, [isVerified, tab]);

  function loadAdminData() {
    setError("");
    getAdminUsers()
      .then((res) => setUsers(res.users))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));

    getAdminReports()
      .then((res) => setReports(res.reports))
      .catch(() => {});

    getAdminAnalytics()
      .then((res) => setAnalytics(res.analytics))
      .catch(() => {});

    getAuditLogs()
      .then((res) => setAuditLogs(res.auditLogs))
      .catch(() => {});
  }

  function requireVerification(actionTitle: string, fn: () => void) {
    setPendingAction({ title: actionTitle, fn });
    setVerifyModalOpen(true);
  }

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleBanUser(u: PublicUser) {
    const actionName = u.isBanned ? `Unban ${u.username}` : `Ban ${u.username}`;
    requireVerification(actionName, async () => {
      try {
        const res = await banUser(u.id, !u.isBanned, u.isBanned ? undefined : "Banned by Owner");
        setUsers((prev) => prev.map((usr) => (usr.id === u.id ? res.user : usr)));
        setMsg(`Successfully updated ban status for ${u.username}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to change ban status");
      }
    });
  }

  async function handleResetRating(u: PublicUser) {
    const newRatingStr = prompt(`Set new rating for ${u.username}:`, "1000");
    if (!newRatingStr) return;
    const newRating = Number(newRatingStr);

    requireVerification(`Set rating of ${u.username} to ${newRating}`, async () => {
      try {
        const res = await setUserRatingAdmin(u.id, newRating);
        setUsers((prev) => prev.map((usr) => (usr.id === u.id ? res.user : usr)));
        setMsg(`Set rating for ${u.username} to ${newRating}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update rating");
      }
    });
  }

  async function handleDeleteUser(u: PublicUser) {
    requireVerification(`Delete User Account ${u.username}`, async () => {
      try {
        await deleteUserAdmin(u.id);
        setUsers((prev) => prev.filter((usr) => usr.id !== u.id));
        setMsg(`Deleted user ${u.username}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete user");
      }
    });
  }

  async function handleReportStatus(reportId: string, status: "resolved" | "dismissed") {
    try {
      await updateReportStatus(reportId, status);
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update report");
    }
  }

  async function handleCreateAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    requireVerification("Publish Site Announcement", async () => {
      try {
        await createAnnouncement(annTitle, annContent);
        setAnnTitle("");
        setAnnContent("");
        setMsg("Announcement published to all players!");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to post announcement");
      }
    });
  }

  return (
    <section className="admin-panel-container">
      {/* Admin Panel Header */}
      <div className="toolbar">
        <div>
          <span className="eyebrow">👑 Platform Governance</span>
          <h1>Owner Administration Portal</h1>
        </div>
        <div className="toolbar-actions">
          <button className="secondary" onClick={loadAdminData}>
            <RefreshCw size={16} /> Refresh Data
          </button>
        </div>
      </div>

      {/* Admin Sub-Tabs */}
      <div className="admin-tabs">
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          <Users size={16} /> User Management
        </button>
        <button className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>
          <AlertTriangle size={16} /> Player Reports ({reports.filter((r) => r.status === "pending").length})
        </button>
        <button className={tab === "analytics" ? "active" : ""} onClick={() => setTab("analytics")}>
          <BarChart2 size={16} /> System Analytics
        </button>
        <button className={tab === "announcements" ? "active" : ""} onClick={() => setTab("announcements")}>
          <Bell size={16} /> Site Announcements
        </button>
        <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>
          <FileText size={16} /> Security Audit Log
        </button>
      </div>

      {msg && <p className="status-pill online my-2">{msg}</p>}
      {error && <p className="form-error my-2">{error}</p>}

      {/* --- TAB 1: USER MANAGEMENT --- */}
      {tab === "users" && (
        <div className="admin-tab-content">
          <div className="admin-filter-bar">
            <div className="input-shell search-shell">
              <Search size={16} />
              <input
                placeholder="Search users by username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="data-table mt-4">
            <div className="table-row header admin-user-header">
              <span>Role</span>
              <span>Username</span>
              <span>Email</span>
              <span>Rating</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {filteredUsers.map((u) => (
              <div className={`table-row admin-user-row ${u.role === "owner" ? "owner-row" : ""}`} key={u.id}>
                <span>
                  {u.role === "owner" ? (
                    <span className="god-badge">👑 OWNER</span>
                  ) : (
                    <span className="badge-user">USER</span>
                  )}
                </span>
                <strong>{u.username}</strong>
                <span className="text-muted text-sm">{u.email}</span>
                <span className="font-numeric">{u.rating}</span>
                <span>
                  {u.isBanned ? (
                    <span className="status-badge banned">SUSPENDED</span>
                  ) : (
                    <span className="status-badge active">ACTIVE</span>
                  )}
                </span>
                <div className="admin-actions-cell">
                  {u.role !== "owner" && (
                    <>
                      <button
                        className={u.isBanned ? "secondary small-btn" : "danger small-btn"}
                        onClick={() => handleBanUser(u)}
                        title={u.isBanned ? "Unban User" : "Ban User"}
                      >
                        {u.isBanned ? <UserCheck size={14} /> : <UserX size={14} />}
                        {u.isBanned ? "Unban" : "Ban"}
                      </button>
                      <button className="secondary small-btn" onClick={() => handleResetRating(u)}>
                        <Medal size={14} /> Elo
                      </button>
                      <button className="ghost small-btn danger-text" onClick={() => handleDeleteUser(u)}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 2: PLAYER REPORTS --- */}
      {tab === "reports" && (
        <div className="admin-tab-content">
          <div className="reports-list">
            {reports.length === 0 ? (
              <div className="empty-state compact">
                <CheckCircle size={32} className="icon-accent" />
                <strong>No pending player reports</strong>
              </div>
            ) : (
              reports.map((r) => (
                <div key={r.id} className={`report-card ${r.status}`}>
                  <div className="report-header">
                    <div>
                      <span className="eyebrow">{r.reason}</span>
                      <h3>Target: {r.target}</h3>
                      <span className="text-muted text-sm">Reported by {r.reporterUsername} • {new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    <span className={`status-pill ${r.status}`}>{r.status.toUpperCase()}</span>
                  </div>
                  {r.details && <p className="report-details">"{r.details}"</p>}
                  {r.status === "pending" && (
                    <div className="report-actions mt-3">
                      <button className="primary small-btn" onClick={() => handleReportStatus(r.id, "resolved")}>
                        Mark Resolved
                      </button>
                      <button className="secondary small-btn" onClick={() => handleReportStatus(r.id, "dismissed")}>
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: SYSTEM ANALYTICS --- */}
      {tab === "analytics" && analytics && (
        <div className="admin-tab-content">
          <div className="analytics-grid">
            <div className="stat">
              <strong>{analytics.totalUsers}</strong>
              <span>Total Registered Accounts</span>
            </div>
            <div className="stat">
              <strong>{analytics.activeToday}</strong>
              <span>Active Sessions Today</span>
            </div>
            <div className="stat">
              <strong>{analytics.totalGamesPlayed}</strong>
              <span>Total Games Played</span>
            </div>
            <div className="stat">
              <strong>{analytics.bannedUsersCount}</strong>
              <span>Suspended Accounts</span>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: SITE ANNOUNCEMENTS --- */}
      {tab === "announcements" && (
        <div className="admin-tab-content">
          <form onSubmit={handleCreateAnnouncement} className="dash-card">
            <h3>📢 Broadcast Site-Wide Announcement</h3>
            <label className="mt-2">
              Announcement Title
              <input
                className="name-input mt-1"
                placeholder="e.g. ♟️ Chess Arena v2 Release"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                required
              />
            </label>
            <label className="mt-2">
              Announcement Content
              <textarea
                className="report-textarea mt-1"
                rows={3}
                placeholder="Message displayed on all user dashboards..."
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                required
              />
            </label>
            <button className="primary mt-3" type="submit">
              Publish Announcement
            </button>
          </form>
        </div>
      )}

      {/* --- TAB 5: SECURITY AUDIT LOG --- */}
      {tab === "audit" && (
        <div className="admin-tab-content">
          <div className="data-table">
            <div className="table-row header">
              <span>Time</span>
              <span>Admin</span>
              <span>Action</span>
              <span>Target</span>
              <span>Details</span>
            </div>
            {auditLogs.map((log) => (
              <div key={log.id} className="table-row text-sm">
                <span>{new Date(log.timestamp).toLocaleString()}</span>
                <strong>{log.adminUsername}</strong>
                <span className="icon-accent">{log.action}</span>
                <span>{log.target ?? "-"}</span>
                <span className="text-muted">{log.reason ?? "-"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Owner Password Re-Verification Dialog */}
      <OwnerVerifyModal
        isOpen={verifyModalOpen && !isVerified}
        actionTitle={pendingAction?.title ?? "Access Owner Admin Controls"}
        onVerified={() => {
          setIsVerified(true);
          setVerifyModalOpen(false);
          if (pendingAction) {
            pendingAction.fn();
            setPendingAction(null);
          }
        }}
        onCancel={() => {
          setVerifyModalOpen(false);
          setPendingAction(null);
        }}
      />
    </section>
  );
}
