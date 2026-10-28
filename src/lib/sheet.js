// ===== รายการชีตที่ทุกคนเห็น =====
// เก็บในชีต Dashboard Config ผ่าน Google Apps Script (โค้ดอยู่ที่ apps-script/Code.gs)
// - ต้องใส่รหัสก่อนดูข้อมูล: VIEW_KEY = ดูอย่างเดียว · ADMIN_KEY = ดู + แก้ (ตั้งใน Script properties)
// - สคริปต์อ่านชีตฟอร์มให้ → ชีตฟอร์มตั้งเป็น Restricted ได้
// - ใส่ Web app URL (ลงท้าย /exec) ที่นี่ · เว้นว่าง = อ่านชีตตรงแบบ CSV (ชีตต้องแชร์แบบ Anyone with the link) และไม่มีรหัส
export const CONFIG_API_URL = "https://script.google.com/macros/s/AKfycbzQaifwdV6XtSM1PhB3tRmfgAIe1gNmBA2ptZZRYjMGsTqY2SZUZiaSmB61fgyrEks/exec";

// ใช้เมื่อยังไม่ได้ตั้ง CONFIG_API_URL
export const DEFAULT_SHEETS = [
  { name: "Registration", url: "https://docs.google.com/spreadsheets/d/1ss9GVk0yGy5NRa5uDDAuaZ47JfbX1mGGOpQoAfH7bEE/edit", tab: "Form Responses 1" },
];
export const AUTO_REFRESH_MS = 60_000;
// ราคาต่อผู้เล่น ตามจำนวนประเภทที่ลง — ใช้เตือนยอดเงินที่กรอกไม่ตรง (หน้า Manage)
export const PRICES = { 1: 2000, 2: 3300, 3: 4600 };
// ประเภททั้งหมดตามลำดับในฟอร์ม — ใช้เรียงตัวกรอง/ทีม และเป็นตัวเลือกในหน้า Manage
export const CATEGORIES = [
  "Male Pro", "Male Semi-Pro", "Male Amateur",
  "Female Pro", "Female Amateur",
  "Mixed Pro", "Mixed Amateur",
  "Senior +40",
];
// ===================================================

export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export function sheetUrl({ url, tab }) {
  const id = (url.match(/\/d\/([a-zA-Z0-9-_]+)/) || [])[1];
  if (!id) throw new Error("Invalid Google Sheet link");
  const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
  const q = tab ? `&sheet=${encodeURIComponent(tab)}` : gid ? `&gid=${gid}` : "";
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${q}&_=${Date.now()}`;
}

export function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// เดาความหมายของคอลัมน์จากหัวตาราง เพื่อให้ใช้กับชีตแบบอื่นได้ด้วย
export function detect(headers) {
  const find = (re, not) => headers.findIndex((h) => re.test(h) && !(not && not.test(h)));
  const cats = headers.map((h, i) => (/category|ประเภท|รุ่น/i.test(h) && !/partner|are you/i.test(h) ? i : -1)).filter((i) => i >= 0);
  return {
    name: find(/full name|^name$|ชื่อ/i, /partner|player\(s\)/i),
    amount: find(/amount|thb|baht|price|ยอด|ราคา|จำนวนเงิน/i),
    cats,
    // คอลัมน์ partner ที่อยู่ถัดจากแต่ละคอลัมน์ประเภท (ก่อนถึงประเภทถัดไป)
    partners: cats.map((ci, k) => headers.findIndex((h, j) => j > ci && j < (cats[k + 1] ?? Infinity) && /partner|คู่/i.test(h))),
    nation: find(/nationality|country|สัญชาติ|ประเทศ/i),
    payFor: find(/paying for|จ่ายให้/i),
    payNames: find(/included in this payment|player\(s\) included/i),
    slip: find(/slip|สลิป/i),
    time: find(/timestamp|ประทับเวลา|submitted/i),
    email: find(/e-?mail|อีเมล/i),
    phone: find(/phone|whatsapp|mobile|tel\b|เบอร์|โทร/i),
    photo: find(/photo|รูป/i),
  };
}

// แถวดิบของชีต (แถวแรก = หัวคอลัมน์) → { headers, rows, meta }
function toData(all) {
  const rows = all.map((r) => r.map((c) => String(c ?? ""))).filter((r) => r.some((c) => c.trim()));
  const headers = rows.shift() || [];
  // ซ่อนคอลัมน์ที่ว่างทั้งคอลัมน์
  const keep = headers.map((_, i) => i).filter((i) => headers[i].trim() && rows.some((r) => (r[i] || "").trim()));
  const data = {
    headers: keep.map((i) => headers[i].trim()),
    rows: rows.map((r) => keep.map((i) => (r[i] || "").trim())),
  };
  data.meta = detect(data.headers);
  return data;
}

// อ่านชีตตรงแบบ CSV (ใช้เมื่อไม่ได้ตั้ง CONFIG_API_URL)
async function fetchSheetCSV(sheet) {
  const res = await fetch(sheetUrl(sheet));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.trim().startsWith("<")) throw new Error("Can't read the sheet — make sure it's shared as 'Anyone with the link'");
  return toData(parseCSV(text));
}

// ข้อมูลฟอร์ม + ค่าที่แก้ในหน้า Manage ของชีตนี้ → { data, records }
// มี CONFIG_API_URL: ขอผ่าน Apps Script พร้อมรหัส (ชีตเป็นส่วนตัวได้) · ไม่มี: อ่าน CSV ตรง
export async function loadSheet(sheet, key) {
  if (!CONFIG_API_URL) return { data: await fetchSheetCSV(sheet), records: {} };
  const out = await post({ action: "data", key, sheet: { url: sheet.url, tab: sheet.tab || "" }, sheetKey: sheetKey(sheet) });
  return { data: toData(out.values || []), records: out.records || {} };
}

// ใช้ในเทสต์/สคริปต์เดิม
export const fetchSheet = async (sheet, key) => (await loadSheet(sheet, key)).data;

// Apps Script ช้าได้ (เปิดชีตใหญ่ครั้งแรก) แต่ถ้าเกินนี้ถือว่าค้าง → แจ้ง error แทนการหมุนไปเรื่อย ๆ
const API_TIMEOUT_MS = 45_000;

async function callApi(init) {
  let res;
  try {
    res = await fetch(CONFIG_API_URL, { ...init, signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  } catch (e) {
    if (e.name === "TimeoutError") throw new Error("The server took too long to respond — try again");
    throw e;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const out = await res.json().catch(() => { throw new Error("Unexpected response from the config API"); });
  if (!out.ok) throw new Error(out.error || "Config API error");
  return out;
}

// POST แบบ text/plain = simple request (ไม่มี CORS preflight ซึ่ง Apps Script ไม่รองรับ)
const post = (body) => callApi({ method: "POST", body: JSON.stringify(body) });

export async function fetchSheetList(key) {
  if (!CONFIG_API_URL) return DEFAULT_SHEETS;
  return (await post({ action: "list", key })).sheets;
}

// ตรวจรหัส → "admin" | "viewer" (รหัสผิด = throw "Wrong password")
export const checkKey = async (key) => (await post({ action: "check", key })).role;
// รหัสผิด/หมดสิทธิ์ (เช่น ถูกเปลี่ยนรหัส) → ต้องเข้าสู่ระบบใหม่
export const isAuthError = (e) => /wrong password|sign in required|admin only|admin key/i.test(e?.message || "");

// แต่ละชีต (ไฟล์ + แท็บ) มีข้อมูล management ของตัวเอง — ใส่ชีตใหม่ = เริ่มจากว่าง
export const sheetKey = ({ url, tab }) => {
  const id = (url.match(/\/d\/([a-zA-Z0-9-_]+)/) || [])[1] || url;
  const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
  return `${id}|${tab || (gid ? "gid:" + gid : "")}`;
};

// บันทึกผู้เล่น 1 คน · data = null → ลบ (กลับไปใช้ค่าจากฟอร์ม) · คืนค่า records ทั้งหมดล่าสุด
export const saveMgmt = async (adminKey, sheet, player, data) =>
  (await post({ action: "mgmtSave", key: adminKey, sheet: sheetKey(sheet), player, data })).records || {};
export const saveSheetList = async (key, sheets) => (await post({ action: "save", key, sheets })).sheets;

export const num = (v) => parseFloat(String(v).replace(/[^\d.-]/g, "")) || 0;
export const fmt = (n) => n.toLocaleString("en-US");
export const driveId = (v) => (v.match(/drive\.google\.com\/(?:open\?id=|file\/d\/)([\w-]+)/) || [])[1];

export function filterRows(data, { q, filterCat, sortCol, sortDir }) {
  q = q.toLowerCase().trim();
  let rows = data.rows.filter((r) =>
    (!q || r.some((c) => c.toLowerCase().includes(q))) &&
    (!filterCat || data.meta.cats.some((i) => r[i] === filterCat)));
  if (sortCol !== null) {
    const numeric = rows.every((r) => !r[sortCol] || !isNaN(num(r[sortCol])) && /^[\d,.\s-]+$/.test(r[sortCol]));
    rows = [...rows].sort((a, b) => (numeric ? num(a[sortCol]) - num(b[sortCol]) : a[sortCol].localeCompare(b[sortCol])) * sortDir);
  }
  return rows;
}

export function downloadCSV(rows, filename) {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(q).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}
