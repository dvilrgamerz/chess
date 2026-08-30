import { useState } from "react";
import { Crown, Lock, Shield, X } from "lucide-react";
import { verifyOwnerPassword } from "../lib/api.js";

interface OwnerVerifyModalProps {
  isOpen: boolean;
  onVerified: () => void;
  onCancel: () => void;
  actionTitle?: string;
}

export function OwnerVerifyModal({ isOpen, onVerified, onCancel, actionTitle }: OwnerVerifyModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      await verifyOwnerPassword(password);
      setPassword("");
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect Owner password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content owner-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onCancel} aria-label="Cancel">
          <X size={20} />
        </button>

        <div className="owner-verify-header">
          <div className="owner-verify-crown">
            <Crown size={32} />
          </div>
          <h2>👑 Owner Verification</h2>
          <p className="muted text-sm">
            {actionTitle ? `Verification required for: ${actionTitle}` : "This area contains sensitive administration controls."}
          </p>
        </div>

        <form onSubmit={handleVerify} className="modal-form mt-4">
          <label>
            Enter Owner Password
            <div className="input-shell">
              <Lock size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (e.g. Jenil000)"
                required
                autoFocus
              />
            </div>
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions mt-4">
            <button className="secondary" type="button" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Verifying..." : "Verify Owner Credentials"}
            </button>
          </div>
        </form>

        <div className="owner-security-notice">
          <Shield size={14} />
          <span>Server-side cryptographic hash verification • Recorded in Audit Log</span>
        </div>
      </div>
    </div>
  );
}
