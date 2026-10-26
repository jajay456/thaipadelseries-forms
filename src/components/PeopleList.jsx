import { fmt } from "../lib/sheet.js";
import Avatar from "./Avatar.jsx";
import PayStatus from "./PayStatus.jsx";
import Confirmed from "./Confirmed.jsx";
import { dateDay, formatDateDay } from "../lib/dates.js";

// รายชื่อทุกคนเรียงลงมา — partner แยกเป็นคนของตัวเอง พร้อมจำนวนประเภทและสถานะการจ่ายเงิน
// people = ทุกคนหลังค้นหา/กรองประเภท (ใช้นับตัวเลขบนชิป), shown = หลังกรองสถานะและจำนวนประเภทแล้ว
export default function PeopleList({ data, shown, onOpen }) {
  const { meta } = data;

  return (
    <>
      {!shown.length ? <div className="state">No players found</div> : (
        <ol className="people-list">
          {shown.map((p, i) => {
            const others = p.paidBy.filter((n) => n !== p.name);
            const registeredDay = p.registered ? dateDay(p.registered) : null;
            return (
              <li key={p.key} className="clickable" onClick={() => onOpen(p)}>
                <span className="n">{i + 1}</span>
                <Avatar name={p.name} photo={p.row && meta.photo >= 0 ? p.row[meta.photo] : null} size={40} />
                <div className="pl-main">
                  <div className="person">
                    <span className="pname">{p.name}</span>
                    <Confirmed person={p} />
                    {p.row && meta.nation >= 0 && p.row[meta.nation] && <span className="muted">{p.row[meta.nation]}</span>}
                    {!p.row && !p.manual && <span className="tag">Not registered</span>}
                    {p.manual && <span className="pill">Added by admin</span>}
                  </div>
                  <div className="card-pills">
                    {p.cats.map(({ cat, partner, paid }, k) => (
                      <span key={k} className="pill">
                        {p.status === "partial" && (paid ? "✓ " : "✗ ")}
                        {cat}{partner && <span className="pill-sub"> · with {partner}</span>}
                      </span>
                    ))}
                  </div>
                  {registeredDay && (
                    <span className="muted registered-date">
                      Registered{p.registeredBy && ` by ${p.registeredBy}`} · {formatDateDay(registeredDay)}
                    </span>
                  )}
                </div>
                <div className="pl-side">
                  <span className="cat-count">{p.cats.length} {p.cats.length === 1 ? "category" : "categories"}</span>
                  <PayStatus person={p} />
                  {p.price && <span className="muted">{/^\d[\d,.]*$/.test(p.price) ? `${fmt(Number(p.price.replace(/,/g, "")))} THB` : p.price}</span>}
                  {others.length > 0 && <span className="muted">Paid by {others.join(", ")}</span>}
                  {p.status === "check" && <span className="muted">Slip uploaded, amount 0</span>}
                  {p.double && !p.doubleResolved && <span className="tag">Possible double payment</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
