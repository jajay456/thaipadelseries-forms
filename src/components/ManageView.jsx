import { useEffect, useRef, useState } from "react";
import { REMARK_STATUS, doublePayments } from "../lib/manage.js";
import { fmt } from "../lib/sheet.js";
import Avatar from "./Avatar.jsx";
import Icon from "./Icon.jsx";
import PayStatus from "./PayStatus.jsx";
import Confirmed from "./Confirmed.jsx";

const clean = (rec) => { const d = { ...rec }; delete d.updated; return d; };

// "Juan Olsina · 2 categories (3,300) + Luc Fenelon · 2 categories (3,300)"
const describeExpected = (c) => c.lines
  .map((l) => `${l.name} · ${l.cats} ${l.cats === 1 ? "category" : "categories"} (${fmt(l.price)})`).join(" + ");

// "own payment 2,000 THB + James Humphries-Stone's payment 4,000 THB"
const describeDouble = (p, all) => doublePayments(p, all)
  .map((d) => (d.self ? "own payment" : `${d.payer}'s payment`) + (d.amount ? ` ${fmt(d.amount)} THB` : ""))
  .join(" + ");

// ช่องข้อความที่บันทึกตอนออกจากช่อง — ระหว่างพิมพ์ไม่ถูกทับด้วยข้อมูลที่รีเฟรชเข้ามา
function Field({ value = "", onCommit, as: El = "input", ...props }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  return (
    <El className="m-input" {...props} value={draft} onChange={(e) => setDraft(e.target.value)}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; if (draft.trim() !== value) onCommit(draft.trim()); }} />
  );
}

// แถวของผู้เล่น 1 คน — ติ๊ก/เลือก บันทึกทันที, ช่องข้อความบันทึกตอนออกจากช่อง
function ManageRow({ n, p, all, checks, meta, catOptions, onSave, onOpen }) {
  const base = () => clean({ ...(p.rec || {}), ...(p.manual ? { manual: true, name: p.name } : {}) });
  const save = (patch) => onSave(p.key, { ...base(), ...patch });
  const saveCats = (cats) => save({ cats: cats.map(({ cat, partner, paid }) => ({ cat: cat.trim(), partner: partner.trim(), paid: !!paid })) });
  const setCat = (i, patch) => saveCats(p.cats.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const text = (field) => ({ value: p[field] || "", onCommit: (v) => save({ [field]: v }) });
  const rs = REMARK_STATUS[p.remarkStatus] || REMARK_STATUS[""];

  return (
    <div className="m-row">
      <div className="m-player">
        <span className="n">{n}</span>
        <button className="avatar-btn" onClick={() => onOpen(p)} aria-label={`View ${p.name}`} title="View details & slip">
          <Avatar name={p.name} photo={p.row && meta.photo >= 0 ? p.row[meta.photo] : null} size={36} />
        </button>
        <div className="m-name">
          {p.manual
            ? <div className="m-name-line"><Field className="m-input strong" {...text("name")} aria-label="Player name" /><Confirmed person={p} /></div>
            : <div className="m-name-line">
                <span className="pname link-ish" onClick={() => onOpen(p)} title="View details & slip">{p.name}</span>
                <Confirmed person={p} />
              </div>}
          <div className="m-tags">
            <PayStatus person={p} />
            {p.manual && <span className="pill">Added by admin</span>}
            {!p.manual && !p.row && <span className="tag">Not registered</span>}
            {p.rec && !p.manual && <span className="muted">edited</span>}
            {p.manual && <button className="link-btn" onClick={() => onOpen(p)}>View</button>}
          </div>
          {checks.map((c, i) => c.acknowledged ? (
            <div key={i} className="m-double resolved" title={`Price list: ${fmt(c.expected)} THB — ${describeExpected(c)}`}>
              ✓ {fmt(c.amount)} THB accepted
              <button className="link-btn" onClick={() => { const d = base(); delete d.amountOk; onSave(p.key, d); }}>Undo</button>
            </div>
          ) : c.mismatch && (
            <div key={i} className={`m-double ${c.amount < c.expected ? "" : "warn"}`}
              title={`Entered ${fmt(c.amount)} THB, expected ${fmt(c.expected)} THB — ${describeExpected(c)}`}>
              ⚠ {c.amount < c.expected ? `Underpaid −${fmt(c.expected - c.amount)}` : `Overpaid +${fmt(c.amount - c.expected)}`}
              <button className="link-btn" onClick={() => save({ amountOk: c.amount })}>Mark OK</button>
            </div>
          ))}
          {p.double && (p.doubleResolved ? (
            <div className="m-double resolved" title={describeDouble(p, all)}>
              ✓ Double payment resolved
              <button className="link-btn" onClick={() => save({ doubleResolved: false })}>Undo</button>
            </div>
          ) : (
            <div className="m-double" title={`Possible double payment: ${describeDouble(p, all)}`}>
              ⚠ Double payment?
              <button className="link-btn" onClick={() => save({ doubleResolved: true })}>Mark resolved</button>
            </div>
          ))}
        </div>
      </div>

      <div className="m-cats">
        <div className="m-label">Paid · Categories <span className="muted">({p.cats.length})</span></div>
        {p.cats.map((c, i) => (
          <div key={i} className="m-cat">
            <input type="checkbox" checked={c.paid} onChange={(e) => setCat(i, { paid: e.target.checked })} aria-label={`Paid ${c.cat}`} />
            <select className={`m-input ${c.cat ? "" : "placeholder"}`} value={c.cat} onChange={(e) => setCat(i, { cat: e.target.value })} aria-label="Category">
              {!c.cat && <option value="">Select category…</option>}
              {[...catOptions, ...(c.cat && !catOptions.includes(c.cat) ? [c.cat] : [])].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <Field value={c.partner} onCommit={(v) => setCat(i, { partner: v })} placeholder="Partner" aria-label="Partner" />
            <button className="btn icon-only sm" onClick={() => saveCats(p.cats.filter((_, j) => j !== i))} aria-label="Remove category"><Icon name="x" size={14} /></button>
          </div>
        ))}
        <button className="btn sm" onClick={() => saveCats([...p.cats, { cat: "", partner: "", paid: false }])}>
          <Icon name="plus" size={14} />Category
        </button>
      </div>

      <div className="m-contact">
        <div className="m-label">Contact</div>
        <Field type="email" {...text("email")} placeholder="Email" aria-label="Email" />
        <Field type="tel" {...text("phone")} placeholder="Phone" aria-label="Phone" />
      </div>

      <div className="m-price">
        <div className="m-label">Price</div>
        <Field {...text("price")} placeholder="—" aria-label="Price" />
      </div>

      <div className="m-remark">
        <div className="m-label">Remark</div>
        <select className={`m-input status-select ${rs.cls}`} value={p.remarkStatus} onChange={(e) => save({ remarkStatus: e.target.value })} aria-label="Remark status">
          {Object.entries(REMARK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Field as="textarea" rows={2} {...text("remark")} placeholder="Note…" aria-label="Remark" />
      </div>

      <div className="m-actions">
        <button className={`btn sm ${p.confirmed ? "confirmed-btn" : "primary"}`} onClick={() => save({ confirmed: !p.confirmed })}
          title={p.confirmed ? "Click to undo" : "Mark this player as confirmed"}>
          {p.confirmed ? "✓ Confirmed" : "Confirm"}
        </button>
        {p.manual ? (
          <button className="btn sm danger" onClick={() => confirm(`Delete ${p.name}?`) && onSave(p.key, null)}>Delete</button>
        ) : <>
          {p.rec && (
            <button className="btn sm" title="Discard edits and use the form data again"
              onClick={() => confirm(`Reset ${p.name} to the form data?`) && onSave(p.key, null)}>Reset</button>
          )}
          <button className="btn sm danger" title="Hide from all lists"
            onClick={() => confirm(`Hide ${p.name} from all lists?`) && save({ hidden: true })}>Hide</button>
        </>}
      </div>
    </div>
  );
}

// ตัวกรองปัญหาในหน้า Manage — แสดงเป็นชิปบรรทัดเดียว กดเพื่อดูเฉพาะคนที่มีปัญหานั้น
const ISSUES = [
  ["under", "Underpaid", "bad", "Paid less than the price list"],
  ["over", "Overpaid", "warn", "Paid more than the price list"],
  ["double", "Double payment", "bad", "Covered by more than one payment"],
  ["unconfirmed", "Not confirmed", "", "Not confirmed yet"],
];

export default function ManageView({ data, people, allPeople, checks, hidden, orphans, catOptions, onSave, onAdd, onOpen }) {
  const [issue, setIssue] = useState(null);
  const checksOf = (p) => checks.filter((c) => c.payerP && c.payerP.key === p.key && (c.mismatch || c.acknowledged));
  const nConfirmed = allPeople.filter((p) => p.confirmed).length;
  const has = {
    under: (p) => checks.some((c) => c.mismatch && c.amount < c.expected && c.payerP?.key === p.key),
    over: (p) => checks.some((c) => c.mismatch && c.amount > c.expected && c.payerP?.key === p.key),
    double: (p) => p.double && !p.doubleResolved,
    unconfirmed: (p) => !p.confirmed,
  };
  const count = (k) => people.filter(has[k]).length;
  const shown = issue && has[issue] ? people.filter(has[issue]) : people;

  return (
    <div className="manage">
      <div className="m-bar">
        <div className="m-issues">
          <span className="muted"><b className="confirmed-count">{nConfirmed}/{allPeople.length}</b> confirmed</span>
          {ISSUES.map(([k, label, cls, tip]) => {
            const n = count(k);
            if (!n && issue !== k) return null;
            return (
              <button key={k} className={`issue ${cls} ${issue === k ? "on" : ""}`} title={tip} onClick={() => setIssue(issue === k ? null : k)}>
                {cls && "⚠ "}{label} <b>{n}</b>
              </button>
            );
          })}
          {orphans.length > 0 && (
            <button className={`issue warn ${issue === "orphans" ? "on" : ""}`} title="Saved edits that don't match any player in the form"
              onClick={() => setIssue(issue === "orphans" ? null : "orphans")}>
              ⚠ Unmatched edits <b>{orphans.length}</b>
            </button>
          )}
          {issue && <button className="link-btn muted" onClick={() => setIssue(null)}>Show all</button>}
        </div>
        <button className="btn primary" onClick={onAdd}><Icon name="plus" size={16} />Add player</button>
      </div>

      {issue === "orphans" && (
        <div className="m-note">
          <span className="muted">These saved edits don't match any player in the form — the name may have changed there.</span>
          {orphans.map((o) => (
            <div key={o.key} className="m-note-row">
              <span>{o.key}</span>
              <button className="btn sm danger" onClick={() => confirm(`Delete saved edits for "${o.key}"?`) && onSave(o.key, null)}>Delete edits</button>
            </div>
          ))}
        </div>
      )}

      {issue === "orphans" ? null : !shown.length ? <div className="state">No players found</div> : (
        <div className="m-list">
          {shown.map((p, i) => (
            <ManageRow key={p.key} n={i + 1} p={p} all={allPeople} checks={checksOf(p)} catOptions={catOptions}
              meta={data.meta} onSave={onSave} onOpen={onOpen} />
          ))}
        </div>
      )}

      {hidden.length > 0 && (
        <details className="m-note">
          <summary><b>Hidden players ({hidden.length})</b></summary>
          {hidden.map((p) => (
            <div key={p.key} className="m-note-row">
              <span>{p.name}</span>
              <button className="btn sm" onClick={() => { const d = clean(p.rec); delete d.hidden; onSave(p.key, Object.keys(d).length ? d : null); }}>Show again</button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
