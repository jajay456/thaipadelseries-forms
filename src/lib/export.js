import { STATUS, buildPeople } from "./people.js";
import { REMARK_STATUS, applyMgmt } from "./manage.js";
import { loadSheet } from "./sheet.js";

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

// โหลดทุกชีต (พร้อมค่าที่แก้ในหน้า Manage ของแต่ละชีต) แล้วรวมรายชื่อผู้เล่นเป็นตารางเดียว
// ชีตที่โหลดไม่ได้จะถูกข้าม และคืนชื่อกลับไปใน failed
export async function exportAllSheets(sheets, key, admin) {
  const results = await Promise.all(sheets.map(async (s) => {
    try {
      const { data, records } = await loadSheet(s, key);
      return { s, people: applyMgmt(buildPeople(data), records, data.meta).people };
    } catch (e) {
      return { s, error: e.message };
    }
  }));
  const rows = [["Sheet", "#", ...playerHeaders(admin)]];
  results.forEach(({ s, people }) => people?.forEach((p, i) => rows.push([s.name, i + 1, ...playerRow(p, admin)])));
  return { rows, failed: results.filter((r) => r.error).map((r) => `${r.s.name} (${r.error})`) };
}
