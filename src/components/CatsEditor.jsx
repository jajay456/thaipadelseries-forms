import Icon from "./Icon.jsx";

// แก้รายการประเภทใน popup: ติ๊กจ่ายแล้ว · เลือกประเภท · คู่ · ลบ — กด + เพื่อเพิ่มประเภท
export default function CatsEditor({ cats, options, onChange }) {
  const setCat = (i, patch) => onChange(cats.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="edit-cats">
      {cats.map((c, i) => (
        <div key={i} className="m-cat">
          <input type="checkbox" checked={c.paid} onChange={(e) => setCat(i, { paid: e.target.checked })} aria-label={`Paid ${c.cat}`} />
          <select className="dlg-select" value={c.cat} onChange={(e) => setCat(i, { cat: e.target.value })} aria-label="Category">
            {!c.cat && <option value="">Select category…</option>}
            {[...options, ...(c.cat && !options.includes(c.cat) ? [c.cat] : [])].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input value={c.partner} onChange={(e) => setCat(i, { partner: e.target.value })} placeholder="Partner" aria-label="Partner" />
          <button type="button" className="btn icon-only sm" onClick={() => onChange(cats.filter((_, j) => j !== i))} aria-label="Remove category"><Icon name="x" size={14} /></button>
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => onChange([...cats, { cat: "", partner: "", paid: false }])}>
        <Icon name="plus" size={14} />Category
      </button>
    </div>
  );
}
