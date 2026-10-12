import { useState } from "react";
import Dialog from "./Dialog.jsx";

// ใส่รหัสแอดมิน (ADMIN_KEY ใน Apps Script) เพื่อเปิดปุ่มเพิ่ม/ลบชีต
export default function AdminDialog({ open, onClose, onSignIn }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await onSignIn(key);
      setKey("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Admin sign-in" as="form" onSubmit={submit}
      actions={<>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || !key}>{busy ? "Checking…" : "Sign in"}</button>
      </>}>
      <p className="muted" style={{ margin: 0 }}>Admins can add and remove the sheets everyone sees. You stay signed in on this device.</p>
      <label>Admin key</label>
      <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" autoFocus required />
      {error && <p className="tag" style={{ display: "inline-block", marginTop: 10 }}>{error}</p>}
    </Dialog>
  );
}
