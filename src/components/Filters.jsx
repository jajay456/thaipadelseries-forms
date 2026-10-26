import { STATUS } from "../lib/people.js";

// ปุ่มเลือกแบบ dropdown — "Category: All ▾"
// แสดงข้อความของค่าที่เลือก แล้ววาง <select> โปร่งใสทับ → ปุ่มกว้างพอดีข้อความ และใช้ตัวเลือกของระบบ (สะดวกบนมือถือ)
function FilterSelect({ label, value, onChange, allLabel = "All", options }) {
  const current = options.find(([v]) => String(v) === String(value));
  return (
    <label className={`fsel ${value != null ? "on" : ""}`}>
      <span className="fsel-label">{label}:</span>
      <span className="fsel-value">{current ? current[1] : allLabel}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)} aria-label={label}>
        <option value="">{allLabel}</option>
        {options.map(([v, text, n]) => (
          <option key={v} value={v} disabled={n === 0 && String(value) !== String(v)}>{n == null ? text : `${text} (${n})`}</option>
        ))}
      </select>
    </label>
  );
}

// ตัวกรองทั้งหมดในแถวเดียว · Payment / Categories แสดงเฉพาะหน้า Players
export default function Filters({
  cats, filterCat, onCat, people, view, payStatus, onPayStatus, catCount, onCatCount, maxCats,
  hasTimestamp, regOrder, onRegOrder,
}) {
  const players = view === "people";
  const active = filterCat || (players && (payStatus || catCount || regOrder));
  return (
    <div className="filters">
      {cats.length > 0 && (
        <FilterSelect label="Category" value={filterCat} onChange={onCat}
          options={cats.map(([c, n]) => [c, c, n])} />
      )}
      {players && (
        <FilterSelect label="Payment" value={payStatus} onChange={onPayStatus}
          options={Object.entries(STATUS).map(([s, { label }]) => [s, label, people.filter((p) => p.status === s).length])} />
      )}
      {players && maxCats > 0 && (
        <FilterSelect label="Categories" allLabel="Any" value={catCount} onChange={(v) => onCatCount(v == null ? null : Number(v))}
          options={Array.from({ length: maxCats }, (_, i) => i + 1)
            .map((n) => [n, `${n} ${n === 1 ? "category" : "categories"}`, people.filter((p) => p.cats.length === n).length])} />
      )}
      {players && hasTimestamp && (
        <FilterSelect label="Sort" allLabel="Name" value={regOrder} onChange={onRegOrder}
          options={[["asc", "Earliest registered"], ["desc", "Latest registered"]]} />
      )}
      {active && (
        <button className="link-btn muted" onClick={() => {
          onCat(null); onPayStatus(null); onCatCount(null); onRegOrder(null);
        }}>Clear</button>
      )}
    </div>
  );
}
