import { STATUS } from "../lib/people.js";

// ป้ายสถานะการจ่ายเงิน (Paid / Check / Unpaid)
export default function PayStatus({ person }) {
  if (!person) return null;
  const st = STATUS[person.status];
  const by = person.paidBy.filter((n) => n !== person.name);
  return (
    <span className={`status ${st.cls}`} title={by.length ? `Paid by ${by.join(", ")}` : undefined}>
      <i className={`dot ${st.cls}`} />{st.label}
    </span>
  );
}
