import { same } from "./teams.js";
import { CATEGORIES } from "./sheet.js";

// ชื่อประเภทมาตรฐาน — สะกดต่างเล็กน้อยถือเป็นอันเดียวกัน ("Male Semipro" = "Male Semi-Pro")
const catNorm = (s) => String(s).toLowerCase().replace(/[^a-z0-9+]/g, "");
export const canonCat = (s) => (s && CATEGORIES.find((c) => catNorm(c) === catNorm(s))) || String(s || "").trim();
const catOrder = (c) => { const i = CATEGORIES.indexOf(c); return i < 0 ? CATEGORIES.length : i; };

// คีย์ของผู้เล่นในข้อมูล management (จับคู่ด้วยชื่อ)
export const playerKey = (name) => String(name).toLowerCase().replace(/\s+/g, " ").trim();
export const newManualKey = () => "manual:" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const statusFromCats = (cats, fallback) => {
  if (!cats.length) return fallback;
  const paid = cats.filter((c) => c.paid).length;
  return paid === cats.length ? "paid" : paid ? "partial" : fallback === "check" ? "check" : "unpaid";
};

// รวมรายชื่อจากฟอร์ม (auto) กับค่าที่แอดมินแก้ไว้ (records)
// - ค่าที่แก้ผูกกับชื่อผู้เล่น ไม่ใช่เลขแถว → โหลดข้อมูลใหม่กี่ครั้งก็ยังอยู่
// - records.manual = ผู้เล่นที่แอดมินเพิ่มเอง (ไม่มีในฟอร์ม)
// คืนค่า { people, hidden, orphans }
export function applyMgmt(auto, records, meta) {
  const keys = Object.keys(records);
  const used = new Set();
  const people = [], hidden = [];
  const field = (row, i) => (row && i >= 0 ? row[i] : "");

  auto.forEach((p) => {
    const free = keys.filter((k) => !records[k].manual && !used.has(k));
    const key = free.find((k) => k === playerKey(p.name)) || free.find((k) => same(k, p.name));
    const rec = key ? records[key] : null;
    if (key) used.add(key);
    const autoPaid = p.status === "paid";
    const cats = (rec?.cats ?? p.cats).map((c) => ({ cat: canonCat(c.cat), partner: c.partner || "", paid: c.paid ?? autoPaid }));
    const person = {
      ...p,
      key: key || playerKey(p.name),
      rec,
      cats,
      status: rec?.cats ? statusFromCats(cats, p.status) : p.status,
      email: rec?.email ?? field(p.row, meta.email),
      phone: rec?.phone ?? field(p.row, meta.phone),
      price: rec?.price ?? (p.amount ? String(p.amount) : ""),
      remark: rec?.remark || "",
      remarkStatus: rec?.remarkStatus || "",
      doubleResolved: !!rec?.doubleResolved, // แอดมินจัดการเรื่องจ่ายซ้ำแล้ว (เช่น คืนเงิน)
      confirmed: !!rec?.confirmed, // แอดมินยืนยันผู้เล่นแล้ว → แสดง ✓ ข้างชื่อ
    };
    (rec?.hidden ? hidden : people).push(person);
  });

  keys.filter((k) => records[k].manual).forEach((k) => {
    const rec = records[k];
    const cats = (rec.cats || []).map((c) => ({ cat: canonCat(c.cat), partner: c.partner || "", paid: !!c.paid }));
    people.push({
      name: rec.name || "Unnamed", key: k, rec, manual: true, row: null, cats, paidBy: [], amount: 0,
      status: statusFromCats(cats, "unpaid"), email: rec.email || "", phone: rec.phone || "",
      price: rec.price || "", remark: rec.remark || "", remarkStatus: rec.remarkStatus || "",
      confirmed: !!rec.confirmed,
    });
  });

  // ให้ partner มีประเภทนั้นด้วย (เช่น แอดมินเพิ่มผู้เล่นที่คู่กับคนในฟอร์ม)
  // ข้ามคนที่แอดมินแก้รายการประเภทเองแล้ว — ค่าที่แอดมินตั้งถือเป็นค่าที่ถูก
  people.forEach((p) => p.cats.forEach((c) => {
    if (!c.cat || !c.partner) return;
    const q = people.find((x) => x !== p && same(x.name, c.partner));
    if (!q || q.rec?.cats || q.manual || q.cats.some((x) => x.cat === c.cat)) return;
    q.cats = [...q.cats, { cat: c.cat, partner: p.name, paid: q.status === "paid" }];
  }));

  // มีค่าที่แก้ไว้แต่หาผู้เล่นในฟอร์มไม่เจอแล้ว (เช่น เปลี่ยนชื่อในฟอร์ม/ลบแถว)
  const orphans = keys.filter((k) => !records[k].manual && !used.has(k)).map((k) => ({ key: k, rec: records[k] }));

  people.sort((a, b) => a.name.localeCompare(b.name));
  return { people, hidden, orphans };
}

// ทีมแยกตามประเภท จากรายชื่อที่รวมค่าที่แก้แล้ว — คู่ที่ระบุกันและกันรวมเป็นทีมเดียว
export function teamsFromPeople(people, filterCat) {
  const groups = {};
  people.forEach((p) => p.cats.forEach((c) => {
    if (!c.cat || (filterCat && c.cat !== filterCat)) return;
    const list = (groups[c.cat] ||= []);
    if (list.some((t) => same(t.partner, p.name) && (!c.partner || same(t.player, c.partner)))) return;
    list.push({ player: p.name, partner: c.partner });
  }));
  return Object.keys(groups)
    .sort((a, b) => catOrder(a) - catOrder(b) || a.localeCompare(b))
    .map((c) => [c, groups[c]]);
}

// จำนวนผู้เล่นในแต่ละประเภท สำหรับชิปตัวกรอง
// ครบทุกประเภทตามลำดับในฟอร์ม (รวมที่ยังไม่มีคนลง) + ประเภทอื่นที่ไม่อยู่ในรายการต่อท้าย
export function peopleCategoryCounts(people) {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  people.forEach((p) => p.cats.forEach((c) => c.cat && (counts[c.cat] = (counts[c.cat] || 0) + 1)));
  return Object.entries(counts).sort((a, b) => catOrder(a[0]) - catOrder(b[0]) || a[0].localeCompare(b[0]));
}

// ยอดที่ครอบคลุมผู้เล่นคนนี้ — ใช้อธิบายกรณีอาจจ่ายซ้ำ เช่น "own 2,000 THB · James Humphries-Stone 4,000 THB"
export function doublePayments(p, people) {
  return p.paidBy.map((payer) => {
    const who = payer === p.name ? p : people.find((x) => same(x.name, payer));
    return { payer, self: payer === p.name, amount: who?.amount || 0 };
  });
}

// ตรวจยอดเงินแต่ละแถวกับราคา (prices: { จำนวนประเภท: ราคา }) — ยอดที่ควรจ่าย = ราคาของทุกคนที่อยู่ในยอดนั้นรวมกัน
// แอดมินกด Mark OK ได้ (เก็บยอดที่ยอมรับไว้ใน record ของคนจ่าย: amountOk) — ถ้ายอดในฟอร์มเปลี่ยนจะเตือนใหม่
export function priceChecks(payments, people, prices) {
  return payments.map((pay) => {
    const payerP = people.find((p) => p.row === pay.row) || people.find((p) => same(p.name, pay.payer));
    const lines = pay.covered.map((n) => {
      const p = people.find((x) => same(x.name, n));
      const cats = p ? p.cats.filter((c) => c.cat).length : null;
      return { name: p?.name || n, cats, price: cats ? prices[cats] ?? null : null };
    });
    const known = lines.every((l) => l.price != null);
    const expected = known ? lines.reduce((t, l) => t + l.price, 0) : null;
    const mismatch = known && lines.length > 0 && pay.amount !== expected;
    return {
      ...pay, payerP, lines, expected, known,
      mismatch: mismatch && payerP?.rec?.amountOk !== pay.amount,
      acknowledged: mismatch && payerP?.rec?.amountOk === pay.amount,
    };
  });
}

export const REMARK_STATUS = {
  "": { label: "—", cls: "" },
  ok: { label: "Receipt OK", cls: "ok" },
  wait: { label: "Waiting", cls: "warn" },
  follow: { label: "Follow up", cls: "bad" },
  free: { label: "Free", cls: "info" },
};
