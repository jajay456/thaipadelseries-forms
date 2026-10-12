import Dialog from "./Dialog.jsx";
import Avatar from "./Avatar.jsx";
import DriveImage from "./DriveImage.jsx";
import PayStatus from "./PayStatus.jsx";
import Confirmed from "./Confirmed.jsx";
import { findPerson } from "../lib/people.js";
import { REMARK_STATUS, doublePayments } from "../lib/manage.js";
import { same } from "../lib/teams.js";
import { driveId, fmt, num } from "../lib/sheet.js";

function Value({ v }) {
  const id = driveId(v);
  if (id) return (
    <a className="link" href={v} target="_blank" rel="noreferrer">
      <DriveImage key={id} id={id} width={600} fallback="Open file ↗" />
    </a>
  );
  if (/^https?:\/\//.test(v)) return <a className="link" href={v} target="_blank" rel="noreferrer">Open ↗</a>;
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(v)) return <a className="link" href={`mailto:${v}`}>{v}</a>;
  return v;
}

// สลิปที่เกี่ยวกับผู้เล่นคนนี้: ของตัวเอง + ของคนที่จ่ายให้
function slipsFor(person, people, meta) {
  if (meta.slip < 0) return [];
  const rows = [];
  const add = (row, payer, self) => {
    if (row?.[meta.slip] && !rows.some((x) => x.row === row)) rows.push({ row, payer, self });
  };
  if (person.row) add(person.row, person.name, true);
  (person.paidBy || []).forEach((n) => add(findPerson(people, n)?.row, n, n === person.name));
  return rows.map(({ row, payer, self }) => ({
    row, payer, self, url: row[meta.slip], id: driveId(row[meta.slip]),
    amount: meta.amount >= 0 ? num(row[meta.amount]) : 0,
    payFor: meta.payFor >= 0 ? row[meta.payFor] : "",
  }));
}

// popup ข้อมูลผู้เล่น — เปิดได้จากแถวฟอร์ม ({ row }) หรือจากผู้เล่น ({ person }) รวมถึงคนที่ไม่ได้กรอกฟอร์ม
export default function RowDialog({ data, people = [], target, isAdmin, checks = [], onOpen, onClose }) {
  const { headers, meta } = data || { headers: [], meta: {} };
  // หาข้อมูลล่าสุดของผู้เล่น (ค่าที่แก้อาจเปลี่ยนหลังเปิด popup)
  const person = target?.person
    ? people.find((p) => p.key === target.person.key) || target.person
    : target?.row ? people.find((p) => p.row === target.row) || findPerson(people, target.row[meta.name]) : null;
  const row = person?.row || target?.row || null;
  const name = person?.name || (row && meta.name >= 0 ? row[meta.name] : "") || "Details";
  const slips = person ? slipsFor(person, people, meta) : [];
  const others = (person?.paidBy || []).filter((n) => n !== person.name);
  // คนที่กรอกฟอร์มแล้วลงชื่อผู้เล่นคนนี้เป็น partner
  const listedBy = person && !person.row
    ? people.filter((p) => p.row && p !== person && p.cats.some((c) => same(c.partner, person.name)))
    : [];
  const rs = REMARK_STATUS[person?.remarkStatus];

  return (
    <Dialog open={!!target} onClose={onClose} title={<>{name} <Confirmed person={person} /></>}
      avatar={<Avatar name={name} photo={row && meta.photo >= 0 ? row[meta.photo] : null} size={44} />}
      actions={<button className="btn" onClick={onClose}>Close</button>}>
      {person && <>
        <div className="pay-summary">
          <PayStatus person={person} />
          <span className="muted">{person.cats.length} {person.cats.length === 1 ? "category" : "categories"}</span>
          {person.price && <span className="muted">· {/^\d[\d,.]*$/.test(person.price) ? `${fmt(num(person.price))} THB` : person.price}</span>}
          {others.length > 0 && <span className="muted">· Paid by {others.join(", ")}</span>}
          {person.manual && <span className="pill">Added by admin</span>}
          {!person.row && !person.manual && <span className="tag">Not registered</span>}
        </div>

        {person.double && !person.doubleResolved && (
          <div className="m-double" style={{ marginBottom: 10 }}>
            ⚠ Possible double payment: {doublePayments(person, people)
              .map((d) => (d.self ? "own payment" : `${d.payer}'s payment`) + (d.amount ? ` ${fmt(d.amount)} THB` : "")).join(" + ")}
          </div>
        )}

        {person.cats.length > 0 && (
          <div className="card-pills" style={{ marginBottom: 12 }}>
            {person.cats.map((c, i) => (
              <span key={i} className={`pill ${c.paid ? "paid" : "unpaid"}`}>
                {c.paid ? "✓" : "✗"} {c.cat}{c.partner && <span className="pill-sub"> · with {c.partner}</span>}
              </span>
            ))}
          </div>
        )}

        {isAdmin && (person.remark || person.remarkStatus || person.email || person.phone) && (
          <div className="detail" style={{ marginBottom: 12 }}>
            {(person.remark || person.remarkStatus) && [
              <div key="rk" className="k">Remark</div>,
              <div key="rv" className="v">
                {rs?.cls && <span className={`status ${rs.cls}`} style={{ marginRight: 6 }}>{rs.label}</span>}
                {person.remark}
              </div>,
            ]}
            {person.email && [<div key="ek" className="k">Email</div>, <div key="ev" className="v"><Value v={person.email} /></div>]}
            {person.phone && [<div key="pk" className="k">Phone</div>, <div key="pv" className="v">{person.phone}</div>]}
          </div>
        )}

        <h3 className="dlg-section">Payment {slips.length === 1 ? "slip" : "slips"}</h3>
        {slips.length ? (
          <div className="slips">
            {slips.map((s, i) => (
              <figure key={i} className="slip">
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.id ? <DriveImage key={s.id} id={s.id} width={800} fallback={<span className="link">Open slip ↗</span>} />
                    : <span className="link">Open slip ↗</span>}
                </a>
                <figcaption>
                  <b>{s.self ? "Own payment" : `Paid by ${s.payer}`}</b>
                  {s.amount > 0 && <> · {fmt(s.amount)} THB</>}
                  {s.payFor && <span className="muted"> · {s.payFor}</span>}
                  {isAdmin && (() => {
                    const c = checks.find((x) => x.row === s.row);
                    if (!c?.known) return null;
                    return c.mismatch
                      ? <div className="slip-check bad">
                          ⚠ {c.amount < c.expected ? `Underpaid −${fmt(c.expected - c.amount)}` : `Overpaid +${fmt(c.amount - c.expected)}`} THB
                          <span className="muted"> · expected {fmt(c.expected)} ({c.lines.map((l) => `${l.name.split(" ")[0]} ${l.cats} cat`).join(" + ")})</span>
                        </div>
                      : <div className="slip-check ok">✓ {c.acknowledged ? `Accepted (price list ${fmt(c.expected)})` : "Matches price list"}</div>;
                  })()}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : <p className="muted" style={{ margin: "0 0 12px" }}>No payment slip.</p>}

        {listedBy.length > 0 && <>
          <h3 className="dlg-section">Listed as partner by</h3>
          <div className="card-pills" style={{ marginBottom: 12 }}>
            {listedBy.map((p) => <button key={p.key} className="btn sm" onClick={() => onOpen(p)}>{p.name}</button>)}
          </div>
        </>}
      </>}

      {row && <>
        <h3 className="dlg-section">Form response</h3>
        <div className="detail">
          {headers.map((h, i) => row[i] && i !== meta.slip && [
            <div key={`k${i}`} className="k">{h}</div>,
            <div key={`v${i}`} className="v"><Value v={row[i]} /></div>,
          ])}
        </div>
      </>}
      {!row && person && <p className="muted" style={{ margin: 0 }}>This player didn't fill in the form.</p>}
    </Dialog>
  );
}
