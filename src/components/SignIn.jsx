import { useState } from "react";

// หน้าเข้าสู่ระบบ — ต้องใส่รหัสก่อนเห็นข้อมูล (รหัสคนดู หรือรหัสแอดมิน)
export default function SignIn({ onSignIn }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await onSignIn(key);
    } catch (err) {
      setError(/wrong password/i.test(err.message) ? "Wrong password. Please try again." : err.message);
      setBusy(false);
    }
  };

  return (
    <main className="signin">
      <form className="signin-card" onSubmit={submit}>
        <img className="signin-logo" src="./logo.png" alt="" />
        <h1>Thaipadelseries forms</h1>
        <p className="muted">Enter the password to view registrations.</p>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Password"
          autoComplete="current-password" autoFocus required aria-label="Password" />
        {error && <p className="signin-error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy || !key}>{busy ? "Checking…" : "View"}</button>
      </form>
    </main>
  );
}
