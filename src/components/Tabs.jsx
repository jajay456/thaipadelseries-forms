import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

const HOLD_MS = 350; // กดค้างนานเท่านี้ถึงเริ่มลาก (สั้นกว่านี้ = คลิกเลือกชีตตามปกติ)

// แสดงชีตที่ add ล่าสุดก่อน (รายการเก็บตามลำดับ add) — onSelect/onEdit/onDelete ยังได้ index ในรายการเดิม
// onEdit / onDelete / onReorder มีเฉพาะตอนเป็นแอดมิน · onReorder(indexes) = ลำดับใหม่ของรายการ
export default function Tabs({ sheets, active, onSelect, onEdit, onDelete, onReorder }) {
  const shown = sheets.map((_, i) => i).reverse(); // ลำดับที่แสดง (index ในรายการ)
  const [drag, setDrag] = useState(null); // { from, order } ระหว่างลาก
  const order = drag?.order || shown;
  const els = useRef({});
  const press = useRef(null);
  const dragged = useRef(false); // กันคลิกที่ตามมาหลังปล่อยนิ้ว ไม่ให้นับเป็นการเลือกชีต

  const cancelPress = () => { clearTimeout(press.current?.timer); press.current = null; };

  const down = (e, i) => {
    if (!onReorder || e.button > 0 || e.target.closest(".x")) return;
    cancelPress();
    press.current = {
      x: e.clientX, y: e.clientY,
      timer: setTimeout(() => { press.current = null; setDrag({ from: i, order: shown }); navigator.vibrate?.(12); }, HOLD_MS),
    };
  };
  // ขยับเกินนิดเดียวก่อนครบเวลา = ผู้ใช้กำลังเลื่อนแถบ ไม่ใช่กดค้าง
  const moveBeforeHold = (e) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancelPress();
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      // วางตัวที่ลากไว้หน้าแท็บแรกที่จุดกึ่งกลางอยู่ทางขวาของนิ้ว
      const others = drag.order.filter((j) => j !== drag.from);
      let pos = others.findIndex((j) => { const r = els.current[j]?.getBoundingClientRect(); return r && e.clientX < r.left + r.width / 2; });
      if (pos < 0) pos = others.length;
      const next = [...others.slice(0, pos), drag.from, ...others.slice(pos)];
      if (next.join() !== drag.order.join()) setDrag({ ...drag, order: next });
    };
    const up = () => {
      dragged.current = true;
      setTimeout(() => { dragged.current = false; }, 80);
      if (drag.order.join() !== shown.join()) onReorder([...drag.order].reverse());
      setDrag(null);
    };
    const cancel = () => setDrag(null);
    // ระหว่างลากด้วยนิ้ว ห้ามหน้า/แถบเลื่อนตาม
    const noScroll = (e) => e.preventDefault();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchmove", noScroll, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchmove", noScroll);
    };
  }, [drag]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => cancelPress, []);

  return (
    <div className={`tabs ${onReorder ? "sortable" : ""} ${drag ? "reordering" : ""}`}>
      {order.map((i) => {
        const s = sheets[i];
        return (
          <div key={i} ref={(el) => { els.current[i] = el; }}
            className={`tab ${i === active ? "active" : ""} ${drag?.from === i ? "dragging" : ""}`}
            title={onReorder ? "Press and hold to move" : undefined}
            onPointerDown={(e) => down(e, i)} onPointerMove={moveBeforeHold} onPointerUp={cancelPress} onPointerLeave={cancelPress}
            onContextMenu={(e) => onReorder && e.preventDefault()}
            onClick={() => !dragged.current && onSelect(i)}>
            {s.name}
            {onEdit && (
              <span className="x" title="Edit name / link" onClick={(e) => { e.stopPropagation(); onEdit(i); }}><Icon name="edit" /></span>
            )}
            {onDelete && (
              <span className="x" title="Remove for everyone" onClick={(e) => { e.stopPropagation(); onDelete(i); }}><Icon name="x" /></span>
            )}
          </div>
        );
      })}
    </div>
  );
}
