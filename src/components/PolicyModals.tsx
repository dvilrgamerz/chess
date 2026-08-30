import { useState } from "react";
import { AlertTriangle, CheckCircle, Shield, Trash2, X } from "lucide-react";
import { deleteAccount, reportPlayer } from "../lib/api.js";

export type PolicyModalType = "privacy" | "terms" | "guidelines" | "report" | "delete" | null;

interface PolicyModalsProps {
  type: PolicyModalType;
  onClose: () => void;
  targetUsername?: string;
  onAccountDeleted?: () => void;
}

export function PolicyModals({ type, onClose, targetUsername, onAccountDeleted }: PolicyModalsProps) {
  const [reportTarget, setReportTarget] = useState(targetUsername ?? "");
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!type) return null;

  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await reportPlayer(reportTarget, reportReason, reportDetails);
      setReportSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit report.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAccount() {
    setError("");
    setBusy(true);
    try {
      await deleteAccount();
      onClose();
      onAccountDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete account.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <X size={20} />
        </button>

        {type === "guidelines" && (
          <article className="policy-doc">
            <div className="policy-header">
              <Shield size={28} className="icon-accent" />
              <h2>Community Guidelines</h2>
            </div>
            <p className="policy-subtitle">
              Chess Arena is built for clean, fair, and friendly competition. By using our platform, you agree to uphold our community standards.
            </p>

            <div className="policy-section">
              <h3>1. Fair Play & Anti-Cheating</h3>
              <p>
                Engine assistance, bot automation during human online games, or multi-accounting to inflate rating is strictly prohibited. Play with your own mind!
              </p>

            </div>

            <div className="policy-section">
              <h3>2. Respect & Communication</h3>
              <p>
                Harassment, threats, hate speech, discrimination, or abusive behavior toward opponent players will result in immediate account termination.
              </p>
            </div>

            <div className="policy-section">
              <h3>3. Privacy & Safety</h3>
              <p>
                Never share personal identification, full names, addresses, phone numbers, or private details in room codes or chats.
              </p>
            </div>

            <button className="primary full mt-4" onClick={onClose}>
              I Understand & Agree
            </button>
          </article>
        )}

        {type === "privacy" && (
          <article className="policy-doc">
            <div className="policy-header">
              <Shield size={28} className="icon-accent" />
              <h2>Privacy Policy & U.S. Safety Controls</h2>
            </div>
            <p className="policy-subtitle">
              We collect only the minimum information needed to run your Chess Arena account, ratings, and multiplayer games.
            </p>

            <div className="policy-section">
              <h3>🔒 Data We Collect</h3>
              <ul>
                <li><strong>Account details:</strong> Username, email, password hash, optional birth year.</li>
                <li><strong>Game data:</strong> Chess moves, Elo rating history, game results, timestamp logs.</li>
                <li><strong>Technical data:</strong> Local authentication tokens, connection state.</li>
              </ul>
            </div>

            <div className="policy-section">
              <h3>🛡️ U.S. Children's Privacy (COPPA Compliance)</h3>
              <p>
                Chess Arena features neutral age-screening. Accounts for players under 13 require parental knowledge and operate under strict data minimization. We do not sell player data or track users across third-party websites.
              </p>
            </div>

            <div className="policy-section">
              <h3>🗑️ Your Rights</h3>
              <p>
                You can delete your account and all associated game history at any time from your Settings menu.
              </p>
            </div>

            <button className="primary full mt-4" onClick={onClose}>
              Close Privacy Notice
            </button>
          </article>
        )}

        {type === "terms" && (
          <article className="policy-doc">
            <div className="policy-header">
              <Shield size={28} className="icon-accent" />
              <h2>Terms of Service</h2>
            </div>
            <p className="policy-subtitle">
              Welcome to Chess Arena. By accessing or using our services, you agree to be bound by these terms.
            </p>

            <div className="policy-section">
              <h3>1. Account Responsibility</h3>
              <p>You are responsible for maintaining the security of your account credentials and for all activity under your username.</p>
            </div>

            <div className="policy-section">
              <h3>2. Service Availability</h3>
              <p>Chess Arena provides local and online multiplayer chess functionality on an as-is basis.</p>
            </div>

            <button className="primary full mt-4" onClick={onClose}>
              Accept Terms
            </button>
          </article>
        )}

        {type === "report" && (
          <article className="policy-doc">
            <div className="policy-header">
              <AlertTriangle size={28} className="icon-danger" />
              <h2>Report a Player / Problem</h2>
            </div>

            {reportSuccess ? (
              <div className="policy-success">
                <CheckCircle size={40} className="icon-accent" />
                <h3>Report Submitted</h3>
                <p>Thank you for helping keep Chess Arena safe and friendly. Our team will review this report.</p>
                <button className="primary full mt-4" onClick={onClose}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="modal-form">
                <label>
                  Report Target / Player
                  <input
                    className="name-input"
                    value={reportTarget}
                    onChange={(e) => setReportTarget(e.target.value)}
                    placeholder="Username or Game ID"
                    required
                  />
                </label>

                <label>
                  Reason
                  <select
                    className="setting-item select"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                  >
                    <option value="harassment">Harassment or Abusive Behavior</option>
                    <option value="cheating">Cheating / Engine Assistance</option>
                    <option value="spam">Spam or Unwanted Messaging</option>
                    <option value="personal_info">Sharing Personal Information</option>
                    <option value="other">Other Violation</option>
                  </select>
                </label>

                <label>
                  Details (Optional)
                  <textarea
                    className="report-textarea"
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide context or description of the issue..."
                  />
                </label>

                {error && <p className="form-error">{error}</p>}

                <div className="modal-actions">
                  <button className="secondary" type="button" onClick={onClose}>
                    Cancel
                  </button>
                  <button className="danger" type="submit" disabled={busy}>
                    {busy ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            )}
          </article>
        )}

        {type === "delete" && (
          <article className="policy-doc">
            <div className="policy-header">
              <Trash2 size={28} className="icon-danger" />
              <h2>Delete Account & Data</h2>
            </div>
            <p className="policy-subtitle danger-text">
              Warning: This action is permanent and cannot be undone.
            </p>
            <p>
              Deleting your account will remove your username, ratings, completed game records, stats, and saved preferences from Chess Arena servers immediately.
            </p>

            {error && <p className="form-error">{error}</p>}

            <div className="modal-actions mt-4">
              <button className="secondary" type="button" onClick={onClose} disabled={busy}>
                Keep My Account
              </button>
              <button className="danger" type="button" onClick={handleDeleteAccount} disabled={busy}>
                {busy ? "Deleting..." : "Permanently Delete Account"}
              </button>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
