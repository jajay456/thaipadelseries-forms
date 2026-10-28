import { STATUS, buildPeople } from "./people.js";
import { REMARK_STATUS, applyMgmt } from "./manage.js";
import { loadSheet, peekSheet } from "./sheet.js";

// แถว CSV ของผู้เล่น — ใช้ทั้ง CSV หน้า Manage และ CSV รวมทุกชีต · remark ใส่เฉพาะแอดมิน
export const playerHeaders = (admin) => [
  "Player", "Confirmed", "Added by admin", "Paid", "How many categories", "Categories", "Email", "Phone", "Price",
  ...(admin ? ["Remark status", "Remark"] : []),
];

export const playerRow = (p, admin) => [
  p.name, p.confirmed ? "Yes" : "", p.manual ? "Yes" : "", STATUS[p.status].label, p.cats.length,
  p.cats.map((c) => `${c.paid ? "[x]" : "[ ]"} ${c.cat}${c.partner ? ` (with ${c.partner})` : ""}`).join("; "),
  p.email, p.phone, p.price,
  ...(admin ? [REMARK_STATUS[p.remarkStatus]?.label.replace("—", "") || "", p.remark] : []),
];

// โหลดทุกชีตพร้อมกัน (พร้อมค่าที่แก้ในหน้า Manage ของแต่ละชีต) → [{ s, data, people } | { s, error }]
export const loadAllPeople = (sheets, key, scope) => Promise.all(sheets.map(async (s) => {
  try {
    const { data, records } = await loadSheet(s, key, scope);
    return { s, data, people: applyMgmt(buildPeople(data), records, data.meta).people };
  } catch (e) {
    return { s, error: e.message };
  }
}));

// สำเนาในเครื่องของทุกชีต (ไม่มีครบ = null)
export function peekAllPeople(sheets, scope) {
  const out = sheets.map((s) => { const c = peekSheet(s, scope); return c && { s, data: c.data, people: applyMgmt(buildPeople(c.data), c.records, c.data.meta).people }; });
  return out.every(Boolean) ? out : null;
}

// รวมรายชื่อผู้เล่นทุกชีตเป็นตารางเดียว — ชีตที่โหลดไม่ได้จะถูกข้าม และคืนชื่อกลับไปใน failed
export async function exportAllSheets(sheets, key, admin) {
  const results = await loadAllPeople(sheets, key);
  const rows = [["Sheet", "#", ...playerHeaders(admin)]];
  results.forEach(({ s, people }) => people?.forEach((p, i) => rows.push([s.name, i + 1, ...playerRow(p, admin)])));
  return { rows, failed: results.filter((r) => r.error).map((r) => `${r.s.name} (${r.error})`) };
}
