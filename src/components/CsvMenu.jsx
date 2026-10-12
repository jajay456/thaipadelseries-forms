import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

// ปุ่ม CSV ▾ — ดาวน์โหลดหน้าที่เปิดอยู่ หรือรวมทุกชีต
export default function CsvMenu({ onThisView, onAllSheets, sheetCount }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const run = async (fn) => {
    setOpen(false);
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div className="menu" ref={ref}>
      <button className={`btn ${busy ? "spin" : ""}`} onClick={() => setOpen(!open)} disabled={busy} aria-haspopup="menu" aria-expanded={open}>
        <Icon name={busy ? "refresh" : "download"} size={16} />{busy ? "Exporting…" : "CSV"}
        <span className="caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <button role="menuitem" onClick={() => run(onThisView)}>
            <b>This view</b><span className="muted">What you see on this page</span>
          </button>
          <button role="menuitem" onClick={() => run(onAllSheets)}>
            <b>All sheets · players</b><span className="muted">{sheetCount} {sheetCount === 1 ? "sheet" : "sheets"} combined, with a Sheet column</span>
          </button>
        </div>
      )}
    </div>
  );
}
