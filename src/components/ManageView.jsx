import { useState } from "react";
import { REMARK_STATUS, doublePayments } from "../lib/manage.js";
import { fmt } from "../lib/sheet.js";
import Avatar from "./Avatar.jsx";
import Icon from "./Icon.jsx";
import PayStatus from "./PayStatus.jsx";
import Confirmed from "./Confirmed.jsx";
import Dialog from "./Dialog.jsx";
import CatsEditor from "./CatsEditor.jsx";

const clean = (rec) => { const d = { ...rec }; delete d.updated; return d; };
// ข้อมูลที่บันทึกไว้ของผู้เล่น — ใช้เป็นฐานเวลาบันทึกการแก้ไข
const baseRec = (p) => clean({ ...(p.rec || {}), ...(p.manual ? { manual: true, name: p.name } : {}) });

// "Juan Olsina · 2 categories (3,300) + Luc Fenelon · 2 categories (3,300)"
const describeExpected = (c) => c.lines
  .map((l) => `${l.name} · ${l.cats} ${l.cats === 1 ? "category" : "categories"} (${fmt(l.price)})`).join(" + ");

// "own payment 2,000 THB + James Humphries-Stone's payment 4,000 THB"
const describeDouble = (p, all) => doublePayments(p, all)
  .map((d) => (d.self ? "own payment" : `${d.payer}'s payment`) + (d.amount ? ` ${fmt(d.amount)} THB` : ""))
  .join(" + ");

const TEXT_FIELDS = ["email", "phone", "price", "remarkStatus", "remark"];
const draftOf = (p) => ({
  name: p.name || "",
  cats: p.cats.map(({ cat, partner, paid }) => ({ cat: cat || "", partner: partner || "", paid: !!paid })),
  ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, p[k] || ""])),
});
const cleanCats = (cats) => cats.map(({ cat, partner, paid }) => ({ cat: cat.trim(), partner: partner.trim(), paid: !!paid }));

// popup แก้ข้อมูลผู้เล่น — แก้ใน draft ก่อน กด Save ถึงจะบันทึกเฉพาะช่องที่เปลี่ยน
function EditPlayerDialog({ p, catOptions, onClose, onSave }) {
  const [f, setF] = useState(() => draftOf(p));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const rs = REMARK_STATUS[f.remarkStatus] || REMARK_STATUS[""];

  const submit = async (e) => {
    e.preventDefault();
    const init = draftOf(p), patch = {};
    TEXT_FIELDS.forEach((k) => { if (f[k].trim() !== init[k]) patch[k] = f[k].trim(); });
    if (p.manual && f.name.trim() !== init.name) patch.name = f.name.trim();
    const cats = cleanCats(f.cats);
    if (JSON.stringify(cats) !== JSON.stringify(cleanCats(init.cats))) patch.cats = cats;
    if (!Object.keys(patch).length) return onClose();
    setBusy(true);
    const ok = await onSave(patch);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onClose={onClose} title={`Edit ${p.name}`} as="form" onSubmit={submit}
      actions={<>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || (p.manual && !f.name.trim())}>{busy ? "Saving…" : "Save"}</button>
      </>}>
      {p.manual && <><label>Name</label><input value={f.name} onChange={set("name")} required /></>}

      <label>Categories · tick when paid</label>
      <CatsEditor cats={f.cats} options={catOptions} onChange={(cats) => setF({ ...f, cats })} />

      <div className="dlg-grid">
        <div><label>Email</label><input type="email" value={f.email} onChange={set("email")} /></div>
        <div><label>Phone</label><input type="tel" value={f.phone} onChange={set("phone")} /></div>
        <div><label>Price</label><input value={f.price} onChange={set("price")} placeholder="e.g. 3300" /></div>
        <div>
          <label>Remark</label>
          <select className={`dlg-select status-select ${rs.cls}`} value={f.remarkStatus} onChange={set("remarkStatus")}>
            {Object.entries(REMARK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <label>Note</label>
      <textarea rows={3} value={f.remark} onChange={set("remark")} placeholder="Note…" />
    </Dialog>
  );
}

const dash = (v) => (v ? <span className="m-text">{v}</span> : <span className="muted m-dash">—</span>);
// ช่องที่ไม่มีข้อมูลเลย — บนมือถือซ่อนทิ้งเพื่อให้แถวสั้นลง
const emptyCls = (empty) => (empty ? " m-empty" : "");

// แถวของผู้เล่น 1 คน — แสดงอย่างเดียว ต้องกด Edit เพื่อแก้ข้อมูลในหน้าต่าง popup
function ManageRow({ n, p, all, checks, meta, onSave, onOpen, onEdit }) {
  const save = (patch) => onSave(p.key, { ...baseRec(p), ...patch });
  const rs = REMARK_STATUS[p.remarkStatus] || REMARK_STATUS[""];

  return (
    <div className="m-row">
      <div className="m-player">
        <span className="n">{n}</span>
        <button className="avatar-btn" onClick={() => onOpen(p)} aria-label={`View ${p.name}`} title="View details & slip">
          <Avatar name={p.name} photo={p.row && meta.photo >= 0 ? p.row[meta.photo] : null} size={36} />
        </button>
        <div className="m-name">
          <div className="m-name-line">
            <span className="pname link-ish" onClick={() => onOpen(p)} title="View details & slip">{p.name}</span>
            <Confirmed person={p} />
          </div>
          <div className="m-tags">
            <PayStatus person={p} />
            {p.manual && <span className="pill">Added by admin</span>}
            {!p.manual && !p.row && <span className="tag">Not registered</span>}
            {p.rec && !p.manual && <span className="muted">edited</span>}
          </div>
          {checks.map((c, i) => c.acknowledged ? (
            <div key={i} className="m-double resolved" title={`Price list: ${fmt(c.expected)} THB — ${describeExpected(c)}`}>
              ✓ {fmt(c.amount)} THB accepted
              <button className="link-btn" onClick={() => { const d = baseRec(p); delete d.amountOk; onSave(p.key, d); }}>Undo</button>
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
        <div className="m-label">Categories <span className="muted">({p.cats.length})</span></div>
        {p.cats.length ? p.cats.map((c, i) => (
          <div key={i} className="m-cat-view">
            <span className={`status ${c.paid ? "ok" : "bad"}`}>{c.paid ? "Paid" : "Unpaid"}</span>
            <span className="m-cat-name">{c.cat || <span className="muted">No category</span>}</span>
            {c.partner && <span className="muted">with {c.partner}</span>}
          </div>
        )) : <span className="muted">—</span>}
      </div>

      <div className={"m-contact" + emptyCls(!p.email && !p.phone)}>
        <div className="m-label">Contact</div>
        <div className="m-vals">{dash(p.email)}{dash(p.phone)}</div>
      </div>

      <div className={"m-price" + emptyCls(!p.price)}>
        <div className="m-label">Price</div>
        <div className="m-vals">{dash(p.price)}</div>
      </div>

      <div className={"m-remark" + emptyCls(!p.remarkStatus && !p.remark)}>
        <div className="m-label">Remark</div>
        <div className="m-vals">
          {p.remarkStatus && <span className={`status ${rs.cls}`}>{rs.label}</span>}
          {p.remark ? <span className="m-text m-note-text">{p.remark}</span> : !p.remarkStatus && <span className="muted m-dash">—</span>}
        </div>
      </div>

      <div className="m-actions">
        <button className="btn sm" onClick={() => onEdit(p)}><Icon name="edit" size={14} />Edit</button>
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
  const [editKey, setEditKey] = useState(null);
  const editing = editKey && allPeople.find((p) => p.key === editKey);
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
            <ManageRow key={p.key} n={i + 1} p={p} all={allPeople} checks={checksOf(p)}
              meta={data.meta} onSave={onSave} onOpen={onOpen} onEdit={(x) => setEditKey(x.key)} />
          ))}
        </div>
      )}

      {editing && (
        <EditPlayerDialog key={editing.key} p={editing} catOptions={catOptions} onClose={() => setEditKey(null)}
          onSave={(patch) => onSave(editing.key, { ...baseRec(editing), ...patch })} />
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
