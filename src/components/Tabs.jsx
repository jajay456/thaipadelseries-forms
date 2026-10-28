import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

// แสดงชีตที่ add ล่าสุดก่อน (รายการเก็บตามลำดับ add) — onSelect/onEdit/onDelete ยังได้ index ในรายการเดิม
// onEdit / onDelete / onReorder มีเฉพาะตอนเป็นแอดมิน · onReorder(indexes) = ลำดับใหม่ของรายการ
// จัดลำดับ: กด Reorder → ลากที่จับ ⠿ ได้ทันที → Done บันทึก / Cancel ทิ้ง
export default function Tabs({ sheets, active, onSelect, onEdit, onDelete, onReorder }) {
  const shown = sheets.map((_, i) => i).reverse(); // ลำดับที่แสดง (index ในรายการ)
  const [draft, setDraft] = useState(null); // ลำดับระหว่างอยู่ในโหมดจัดลำดับ · null = ไม่ได้จัด
  const [dragging, setDragging] = useState(null); // index ของแท็บที่กำลังลาก
  const els = useRef({});
  const order = draft || shown;
  // รายการชีตเปลี่ยนจำนวนระหว่างจัด (มีคน add/ลบ) → ลำดับที่ร่างไว้ใช้ไม่ได้แล้ว ออกจากโหมด
  useEffect(() => { setDraft(null); setDragging(null); }, [sheets.length]);

  const startDrag = (e, i) => {
    if (e.button > 0) return;
    e.preventDefault();
    setDragging(i);
  };

  useEffect(() => {
    if (dragging == null) return;
    const move = (e) => {
      // วางตัวที่ลากไว้หน้าแท็บแรกที่จุดกึ่งกลางอยู่ถัดจากนิ้ว
      // มือถือ = รายการแนวตั้ง เทียบแนวตั้งอย่างเดียว · จอใหญ่ = ไล่ตามบรรทัด เผื่อแท็บขึ้นหลายบรรทัด
      const vertical = matchMedia("(max-width: 640px)").matches;
      setDraft((cur) => {
        const others = cur.filter((j) => j !== dragging);
        let pos = others.findIndex((j) => {
          const r = els.current[j]?.getBoundingClientRect();
          if (!r) return false;
          if (vertical) return e.clientY < r.top + r.height / 2;
          return e.clientY < r.top || (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2);
        });
        if (pos < 0) pos = others.length;
        const next = [...others.slice(0, pos), dragging, ...others.slice(pos)];
        return next.join() === cur.join() ? cur : next;
      });
    };
    const stop = () => setDragging(null);
    const noScroll = (e) => e.preventDefault();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("touchmove", noScroll, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("touchmove", noScroll);
    };
  }, [dragging]);

  const done = () => {
    if (draft.join() !== shown.join()) onReorder([...draft].reverse());
    setDraft(null);
  };

  // ปุ่มจัดลำดับอยู่นอกแถบที่เลื่อนได้ — บนมือถือจะไม่หลุดขอบจอ
  return (
    <div className={`tabs-bar ${draft ? "arranging" : ""}`}>
    <div className={`tabs ${draft ? "arranging" : ""}`}>
      {order.map((i) => (
        <div key={i} ref={(el) => { els.current[i] = el; }}
          className={`tab ${!draft && i === active ? "active" : ""} ${dragging === i ? "dragging" : ""}`}
          onClick={() => !draft && onSelect(i)}>
          {draft && (
            <span className="tab-handle" onPointerDown={(e) => startDrag(e, i)} aria-label={`Drag to move ${sheets[i].name}`} title="Drag to move">⠿</span>
          )}
          {sheets[i].name}
          {!draft && onEdit && (
            <span className="x" title="Edit name / link" onClick={(e) => { e.stopPropagation(); onEdit(i); }}><Icon name="edit" /></span>
          )}
          {!draft && onDelete && (
            <span className="x" title="Remove for everyone" onClick={(e) => { e.stopPropagation(); onDelete(i); }}><Icon name="x" /></span>
          )}
        </div>
      ))}
    </div>
      {onReorder && sheets.length > 1 && (
        <div className="tabs-actions">
          {draft ? <>
            <span className="muted tabs-hint">Drag ⠿ to move</span>
            <button className="btn sm" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn sm primary" onClick={done}>Done</button>
          </> : (
            <button className="btn sm tab-reorder" onClick={() => setDraft(shown)} title="Change the order of the sheets" aria-label="Reorder sheets">
              ⠿<span className="hide-sm"> Reorder</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
