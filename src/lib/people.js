import { noName, same } from "./teams.js";
import { num } from "./sheet.js";
import { dateTime } from "./dates.js";

// รายชื่อทุกคน (ทั้งคนที่กรอกฟอร์มและ partner ที่ถูกระบุชื่อ) พร้อมประเภทที่ลงและสถานะการจ่ายเงิน
// status (อัตโนมัติจากฟอร์ม — แอดมินแก้ทับได้ในหน้า Manage ดู lib/manage.js): "paid" = มียอดเงินของตัวเองหรือมีคนจ่ายให้, "check" = มีสลิปแต่ยอดเป็น 0 (และไม่มีใครจ่ายให้), "unpaid" = ยังไม่จ่าย
// ใครบ้างที่อยู่ในยอดจ่ายของแถวนี้ — ตามคำตอบ "Who are you paying for?":
//   Myself only          → คนกรอกเท่านั้น
//   Myself + partner(s)  → คนกรอก + partner ทุกคนในแถว + ชื่อในช่อง "players included in this payment"
//   Other player(s)      → เฉพาะชื่อในช่องนั้น (คนกรอกไม่ได้จ่ายให้ตัวเอง)
//   ไม่มีคอลัมน์/ไม่ตอบ   → คนกรอก + ชื่อในช่องนั้น
export function coveredBy(r, meta, payer) {
  const payFor = meta.payFor >= 0 ? r[meta.payFor] : "";
  const listed = meta.payNames >= 0 && !noName(r[meta.payNames])
    ? r[meta.payNames].split(/\s*(?:&|,|\+|\/|\band\b|และ)\s*/i).filter((n) => !noName(n))
    : [];
  const partners = meta.partners.map((pi) => (pi >= 0 ? r[pi] : "")).filter((n) => n && !noName(n));
  const names = /other/i.test(payFor) ? listed
    : /partner/i.test(payFor) ? [payer, ...partners, ...listed]
    : /only/i.test(payFor) ? [payer]
    : [payer, ...listed];
  // ตัดชื่อซ้ำ (เช่น ชื่อตัวเองอยู่ในช่องรายชื่อด้วย)
  return names.map((n) => n.trim()).filter((n, i, a) => n && a.findIndex((x) => same(x, n)) === i);
}

// ยอดจ่ายทุกแถวในฟอร์ม พร้อมรายชื่อคนที่อยู่ในยอดนั้น
export function buildPayments(data) {
  const { meta } = data;
  if (meta.name < 0) return [];
  return data.rows.filter((r) => r[meta.name]).map((r) => ({
    row: r,
    payer: r[meta.name].trim(),
    amount: meta.amount >= 0 ? num(r[meta.amount]) : 0,
    payFor: meta.payFor >= 0 ? r[meta.payFor] : "",
    covered: coveredBy(r, meta, r[meta.name].trim()),
  }));
}

export function buildPeople(data) {
  const { meta } = data;
  const people = [];
  const add = (name) => {
    name = name.trim();
    let p = people.find((x) => same(x.name, name));
    if (!p) people.push(p = { name, row: null, cats: new Map(), paidBy: new Set(), amount: 0, slip: false });
    return p;
  };

  // คนที่กรอกฟอร์มก่อน เพื่อให้ใช้ชื่อเต็มที่เจ้าตัวพิมพ์เอง
  const regs = data.rows.filter((r) => meta.name >= 0 && r[meta.name]).map((r) => {
    const p = add(r[meta.name]);
    p.row = r;
    return [r, p];
  });

  regs.forEach(([r, p]) => {
    meta.cats.forEach((ci, k) => {
      if (!r[ci]) return;
      const pi = meta.partners[k];
      const partner = pi >= 0 && !noName(r[pi]) ? r[pi].trim() : "";
      if (!p.cats.has(r[ci]) || partner) p.cats.set(r[ci], partner);
      if (partner) {
        const q = add(partner);
        if (!q.cats.get(r[ci])) q.cats.set(r[ci], p.name);
        // partner ที่ไม่ได้กรอกฟอร์มเอง → ใช้วันที่คู่ของตัวเองลงชื่อให้ (ครั้งแรกสุด)
        if (!q.row && meta.time >= 0 && r[meta.time] &&
          (!q.registered || dateTime(r[meta.time]) < dateTime(q.registered))) {
          q.registered = r[meta.time];
          q.registeredBy = p.name;
        }
      }
    });

    const amount = meta.amount >= 0 ? num(r[meta.amount]) : 0;
    p.amount += amount;
    if (amount <= 0) {
      if (meta.slip >= 0 && r[meta.slip]) p.slip = true; // มีสลิปแต่ยอดเป็น 0 → ต้องตรวจสอบ
      return;
    }
    coveredBy(r, meta, p.name).forEach((n) => add(n).paidBy.add(p.name));
  });

  // ใช้ชื่อเต็มของ partner ตามที่อยู่ในรายชื่อ (เช่น "James Humphries" → "James Humphries-Stone")
  const canon = (n) => (n && people.find((x) => same(x.name, n))?.name) || n;
  return people.map((p) => ({
    ...p,
    // วันที่ลงทะเบียน: ของแถวตัวเอง หรือของ partner ที่ลงชื่อให้
    registered: p.row ? (meta.time >= 0 ? p.row[meta.time] || null : null) : p.registered || null,
    registeredBy: p.row ? null : canon(p.registeredBy) || null,
    cats: [...p.cats].map(([cat, partner]) => ({ cat, partner: canon(partner) })),
    // อยู่ในยอดจ่ายมากกว่า 1 ยอด (จ่ายเอง + มีคนจ่ายให้ หรือหลายคนจ่ายให้) → อาจจ่ายซ้ำ
    double: p.paidBy.size > 1,
    paidBy: [...p.paidBy],
    status: p.paidBy.size ? "paid" : p.slip ? "check" : "unpaid",
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export const findPerson = (people, name) => (name ? people.find((p) => same(p.name, name)) : undefined);

export const STATUS = {
  paid: { label: "Paid", cls: "ok" },
  partial: { label: "Partly paid", cls: "warn" },
  check: { label: "Check", cls: "warn" },
  unpaid: { label: "Unpaid", cls: "bad" },
};
