import { useState } from "react";
import Dialog from "./Dialog.jsx";
import { CATEGORIES } from "../lib/sheet.js";

const EMPTY = { name: "", cat: "", partner: "", paid: false, email: "", phone: "", price: "" };

// เพิ่มผู้เล่นที่ไม่ได้กรอกฟอร์ม
export default function AddPlayerDialog({ open, onClose, onAdd }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await onAdd({
        manual: true, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), price: f.price.trim(),
        cats: f.cat.trim() ? [{ cat: f.cat.trim(), partner: f.partner.trim(), paid: f.paid }] : [],
      });
      if (ok) setF(EMPTY);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add player" as="form" onSubmit={submit}
      actions={<>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || !f.name.trim()}>{busy ? "Saving…" : "Add player"}</button>
      </>}>
      <p className="muted" style={{ margin: 0 }}>For players who didn't fill in the form. You can add more categories after saving.</p>
      <label>Name</label>
      <input value={f.name} onChange={set("name")} required autoFocus />
      <label>Category</label>
      <select className="dlg-select" value={f.cat} onChange={set("cat")}>
        <option value="">— None yet —</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <label>Partner</label>
      <input value={f.partner} onChange={set("partner")} />
      <label className="check"><input type="checkbox" checked={f.paid} onChange={set("paid")} /> Paid</label>
      <label>Email</label>
      <input type="email" value={f.email} onChange={set("email")} />
      <label>Phone</label>
      <input type="tel" value={f.phone} onChange={set("phone")} />
      <label>Price</label>
      <input value={f.price} onChange={set("price")} placeholder="e.g. 3300" />
    </Dialog>
  );
}
