import { useState } from "react";
import Dialog from "./Dialog.jsx";
import { sheetUrl } from "../lib/sheet.js";

const EMPTY = { name: "", url: "", tab: "" };

export default function AddSheetDialog({ open, onClose, onAdd }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const s = { name: form.name.trim(), url: form.url.trim(), tab: form.tab.trim() };
    try { sheetUrl(s); } catch (err) { return alert(err.message); }
    setBusy(true);
    try {
      await onAdd(s);
      setForm(EMPTY);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add Google Sheet" as="form" onSubmit={submit}
      actions={<>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Add sheet"}</button>
      </>}>
      <p className="muted" style={{ margin: 0 }}>
        Everyone with the password will see this sheet. It can stay private — just make sure the Google account
        that owns the Apps Script can open it.
      </p>
      <label>Display name</label>
      <input value={form.name} onChange={set("name")} placeholder="e.g. October Tournament" required />
      <label>Google Sheet link</label>
      <input value={form.url} onChange={set("url")} placeholder="https://docs.google.com/spreadsheets/d/…" inputMode="url" required />
      <label>Tab name (leave blank to use the tab in the link, or the first tab)</label>
      <input value={form.tab} onChange={set("tab")} placeholder="Form Responses 1" />
    </Dialog>
  );
}
