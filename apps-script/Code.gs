/**
 * API ของ Thaipadelseries forms — เก็บรายการชีตที่จะแสดงบนเว็บไว้ในชีต Dashboard Config
 *
 * ติดตั้ง (ครั้งเดียว):
 * 1. เปิดชีต Dashboard Config → Extensions → Apps Script → วางโค้ดนี้แทนของเดิม → Save
 * 2. Project Settings (รูปเฟือง) → Script properties → Add property
 *      ADMIN_KEY = รหัสแอดมิน (ดู + แก้ไข)
 *      VIEW_KEY  = รหัสคนดู (ดูอย่างเดียว) — ทุกคนต้องใส่รหัสใดรหัสหนึ่งก่อนเห็นข้อมูล
 * 3. Deploy → New deployment → Type: Web app
 *      Execute as: Me   ·   Who has access: Anyone   → Deploy → อนุญาตสิทธิ์
 * 4. คัดลอก Web app URL (ลงท้าย /exec) ไปใส่ CONFIG_API_URL ใน src/lib/sheet.js
 *
 * ทุกคำขอต้องมีรหัส: VIEW_KEY อ่านได้ · ADMIN_KEY อ่าน + แก้ได้
 * สคริปต์อ่านชีตฟอร์มแทนเว็บ (รันในบัญชีเจ้าของ) → ตั้งชีตฟอร์มเป็น Restricted ได้ ข้อมูลไม่หลุดผ่านลิงก์
 *
 * ข้อมูลหน้า Management เก็บในแท็บ "Management" (สร้างให้อัตโนมัติ)
 *   1 แถว = ผู้เล่น 1 คนของชีต 1 ชีต: Sheet | Player | Data (JSON) | Updated
 *   ชีตใหม่ = sheet key ใหม่ = เริ่มจากว่าง · ไม่มีการแก้ชีตฟอร์ม
 *   คนดูได้เฉพาะช่องสาธารณะ — remark/email/phone ที่แก้ไว้ อ่านได้เฉพาะแอดมิน
 */

function sheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function list_() {
  const [head = [], ...rows] = sheet_().getDataRange().getDisplayValues();
  const col = (re) => head.findIndex((h) => re.test(h));
  const n = col(/name/i), u = col(/url|link/i), t = col(/tab/i);
  if (u < 0) return [];
  return rows
    .filter((r) => /\/spreadsheets\/d\//.test(r[u]))
    .map((r, i) => ({ name: (n >= 0 && r[n]) || "Sheet " + (i + 1), url: r[u], tab: t >= 0 ? r[t] : "" }));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

const MGMT_TAB = "Management";
const PRIVATE_FIELDS = ["remark", "remarkStatus", "email", "phone"];

function mgmtSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(MGMT_TAB);
  if (!sh) {
    sh = ss.insertSheet(MGMT_TAB);
    sh.getRange(1, 1, 1, 4).setValues([["Sheet", "Player", "Data", "Updated"]]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// { playerKey: { ...data, updated } } ของชีตนี้
function mgmtRecords_(sheetKey, includePrivate) {
  const out = {};
  mgmtSheet_().getDataRange().getValues().slice(1).forEach((r) => {
    if (String(r[0]) !== sheetKey) return;
    let data = {};
    try { data = JSON.parse(r[2] || "{}"); } catch (err) {}
    if (!includePrivate) PRIVATE_FIELDS.forEach((f) => delete data[f]);
    data.updated = r[3] ? new Date(r[3]).getTime() : 0;
    out[String(r[1])] = data;
  });
  return out;
}

// บันทึกทีละผู้เล่น · data = null → ลบ (กลับไปใช้ค่าจากฟอร์ม)
function mgmtSave_(sheetKey, playerKey, data) {
  const sh = mgmtSheet_();
  const values = sh.getDataRange().getValues();
  const i = values.findIndex((r, j) => j > 0 && String(r[0]) === sheetKey && String(r[1]) === playerKey);
  if (data == null) {
    if (i > 0) sh.deleteRow(i + 1);
    return;
  }
  delete data.updated;
  const row = [[sheetKey, playerKey, JSON.stringify(data), new Date()]];
  const range = i > 0 ? sh.getRange(i + 1, 1, 1, 4) : sh.getRange(sh.getLastRow() + 1, 1, 1, 4);
  range.offset(0, 0, 1, 3).setNumberFormat("@");
  range.setValues(row);
}

// "admin" | "viewer" | null ตามรหัสที่ส่งมา
function role_(key) {
  const p = PropertiesService.getScriptProperties();
  const admin = p.getProperty("ADMIN_KEY"), view = p.getProperty("VIEW_KEY");
  if (key && admin && key === admin) return "admin";
  if (key && view && key === view) return "viewer";
  return null;
}

// อ่านชีตฟอร์ม — เฉพาะชีตที่อยู่ในรายการเท่านั้น (กันขออ่านไฟล์อื่นในบัญชีเจ้าของ)
function readSheet_(s) {
  const allowed = list_().some((x) => x.url === s.url && String(x.tab || "") === String(s.tab || ""));
  if (!allowed) throw new Error("Sheet is not in the list");
  const ss = SpreadsheetApp.openByUrl(s.url);
  let sh = s.tab ? ss.getSheetByName(s.tab) : null;
  if (s.tab && !sh) throw new Error('Tab "' + s.tab + '" not found');
  if (!sh) {
    const gid = (String(s.url).match(/[#&?]gid=(\d+)/) || [])[1];
    if (gid) sh = ss.getSheets().find((x) => String(x.getSheetId()) === gid) || null;
  }
  return (sh || ss.getSheets()[0]).getDataRange().getDisplayValues();
}

function doGet() {
  return json_({ ok: false, error: "Sign in required" });
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || "{}"); } catch (err) {}
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty("ADMIN_KEY")) return json_({ ok: false, error: "ADMIN_KEY is not set in Script properties" });
  const role = role_(body.key);
  if (!role) return json_({ ok: false, error: "Wrong password" });
  const admin = role === "admin";

  if (body.action === "check") return json_({ ok: true, role: role });

  if (body.action === "list") return json_({ ok: true, sheets: list_() });

  // ข้อมูลฟอร์ม + ค่าที่แก้ในหน้า Manage ในครั้งเดียว
  if (body.action === "data") {
    if (!body.sheet || !body.sheet.url) return json_({ ok: false, error: "Missing sheet" });
    try {
      return json_({
        ok: true,
        values: readSheet_(body.sheet),
        records: body.sheetKey ? mgmtRecords_(String(body.sheetKey), admin) : {},
      });
    } catch (err) {
      return json_({ ok: false, error: String(err.message || err) });
    }
  }

  if (body.action === "mgmtGet") {
    if (!body.sheet) return json_({ ok: false, error: "Missing sheet" });
    return json_({ ok: true, records: mgmtRecords_(String(body.sheet), admin) });
  }

  // ต่อจากนี้แก้ข้อมูล — เฉพาะแอดมิน
  if (!admin) return json_({ ok: false, error: "Admin only" });

  if (body.action === "mgmtSave") {
    if (!body.sheet || !body.player) return json_({ ok: false, error: "Missing sheet or player" });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      mgmtSave_(String(body.sheet), String(body.player), body.data == null ? null : body.data);
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true, records: mgmtRecords_(String(body.sheet), true) });
  }

  if (body.action === "save") {
    const sheets = (body.sheets || [])
      .filter((s) => s && /\/spreadsheets\/d\//.test(s.url))
      .map((s) => [String(s.name || ""), String(s.url), String(s.tab || "")]);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sh = sheet_();
      sh.clearContents();
      sh.getRange(1, 1, 1, 3).setValues([["Name", "Sheet URL", "Tab"]]);
      if (sheets.length) {
        const range = sh.getRange(2, 1, sheets.length, 3);
        range.setNumberFormat("@"); // เก็บเป็นข้อความ (กันชื่อแท็บอย่าง "1" กลายเป็นตัวเลข)
        range.setValues(sheets);
      }
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true, sheets: list_() });
  }

  return json_({ ok: false, error: "Unknown action" });
}
