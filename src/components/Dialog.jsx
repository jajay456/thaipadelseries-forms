import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";

// ห่อ <dialog> ให้เปิด/ปิดตาม prop open — คลิกพื้นหลังเพื่อปิดได้
export default function Dialog({ open, onClose, title, avatar, children, actions, as: As = "div", ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <As style={{ display: "contents" }} {...rest}>
        <div className="dlg-head">
          {avatar}
          <h2>{title}</h2>
          <button type="button" className="btn icon-only" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="dlg-body">{children}</div>
        {actions && <div className="actions">{actions}</div>}
      </As>
    </dialog>
  );
}
