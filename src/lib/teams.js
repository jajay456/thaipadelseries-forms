const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
export const noName = (s) => /^[-–.\s]*$|^(none|n\/?a|no|ไม่มี)$/i.test(s);
// ชื่อตรงกัน ถ้าเหมือนกัน หรืออันหนึ่งขึ้นต้นด้วยอีกอัน (เช่น "James Humphries" กับ "James Humphries-Stone")
export const same = (a, b) => {
  a = norm(a); b = norm(b);
  return !!a && !!b && (a === b || Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)));
};

// จัดกลุ่มตามประเภท และรวมคู่ที่สมัครแยกกัน (A ใส่ B เป็น partner, B ใส่ A) ให้เป็นทีมเดียว
// คืนค่า [[category, teams[]], ...] เรียงตามจำนวนทีมมากไปน้อย
export function groupTeams(data, rows, filterCat) {
  const { meta } = data;
  const groups = {};
  rows.forEach((r) => meta.cats.forEach((ci, k) => {
    const cat = r[ci];
    if (!cat || (filterCat && cat !== filterCat)) return;
    const player = meta.name >= 0 ? r[meta.name] : "";
    const pi = meta.partners[k];
    const partner = pi >= 0 && !noName(r[pi]) ? r[pi] : "";
    const list = (groups[cat] ||= []);
    const dup = partner && list.find((t) => same(t.partner, player) && same(t.player, partner));
    if (dup) { dup.partner = player; dup.partnerRow = r; }
    else list.push({ player, partner, row: r, partnerRow: null });
  }));
  return Object.keys(groups)
    .sort((a, b) => groups[b].length - groups[a].length || a.localeCompare(b))
    .map((c) => [c, groups[c]]);
}

// จำนวนแถวที่ลงแต่ละประเภท สำหรับชิปตัวกรอง
export function categoryCounts(data) {
  const counts = {};
  data.rows.forEach((r) => data.meta.cats.forEach((i) => r[i] && (counts[r[i]] = (counts[r[i]] || 0) + 1)));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}
