import { useState } from "react";
import Dialog from "./Dialog.jsx";
import CatsEditor from "./CatsEditor.jsx";
import { CATEGORIES } from "../lib/sheet.js";

const EMPTY = { name: "", cats: [{ cat: "", partner: "", paid: false }], email: "", phone: "", price: "" };

// เพิ่มผู้เล่นที่ไม่ได้กรอกฟอร์ม
export default function AddPlayerDialog({ open, onClose, onAdd }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await onAdd({
        manual: true, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), price: f.price.trim(),
        // แถวที่ยังไม่ได้เลือกประเภทจะไม่ถูกบันทึก
        cats: f.cats.filter((c) => c.cat.trim()).map((c) => ({ cat: c.cat.trim(), partner: c.partner.trim(), paid: c.paid })),
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
      <p className="muted" style={{ margin: 0 }}>For players who didn't fill in the form.</p>
      <label>Name</label>
      <input value={f.name} onChange={set("name")} required autoFocus />
      <label>Categories · tick when paid</label>
      <CatsEditor cats={f.cats} options={CATEGORIES} onChange={(cats) => setF({ ...f, cats })} />
      <div className="dlg-grid">
        <div><label>Email</label><input type="email" value={f.email} onChange={set("email")} /></div>
        <div><label>Phone</label><input type="tel" value={f.phone} onChange={set("phone")} /></div>
      </div>
      <label>Price</label>
      <input value={f.price} onChange={set("price")} placeholder="e.g. 3300" />
    </Dialog>
  );
}
