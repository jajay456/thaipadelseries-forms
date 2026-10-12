/**
 * API ของ Thaipadelseries forms — เก็บรายการชีตที่จะแสดงบนเว็บไว้ในชีต Dashboard Config
 *
 * ติดตั้ง (ครั้งเดียว):
 * 1. เปิดชีต Dashboard Config → Extensions → Apps Script → วางโค้ดนี้แทนของเดิม → Save
 * 2. Project Settings (รูปเฟือง) → Script properties → Add property
 *      Property: ADMIN_KEY   Value: รหัสผ่านที่ต้องการ (ใช้ตอนกด Admin บนเว็บ)
 * 3. Deploy → New deployment → Type: Web app
 *      Execute as: Me   ·   Who has access: Anyone   → Deploy → อนุญาตสิทธิ์
 * 4. คัดลอก Web app URL (ลงท้าย /exec) ไปใส่ CONFIG_API_URL ใน src/lib/sheet.js
 *
 * ทุกคนอ่านรายการชีตได้ (GET) — แก้ได้เฉพาะคนที่มี ADMIN_KEY (POST)
 *
 * ข้อมูลหน้า Management เก็บในแท็บ "Management" (สร้างให้อัตโนมัติ)
 *   1 แถว = ผู้เล่น 1 คนของชีต 1 ชีต: Sheet | Player | Data (JSON) | Updated
 *   ชีตใหม่ = sheet key ใหม่ = เริ่มจากว่าง · ไม่มีการแก้ชีตฟอร์ม
 *   ทุกคนอ่านได้เฉพาะช่องสาธารณะ — remark/email/phone อ่านได้เฉพาะแอดมิน
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

function doGet(e) {
  const sheetKey = e && e.parameter && e.parameter.mgmt;
  if (sheetKey) return json_({ ok: true, records: mgmtRecords_(sheetKey, false) });
  return json_({ ok: true, sheets: list_() });
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || "{}"); } catch (err) {}
  const key = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
  if (!key) return json_({ ok: false, error: "ADMIN_KEY is not set in Script properties" });
  if (body.key !== key) return json_({ ok: false, error: "Wrong admin key" });

  if (body.action === "check") return json_({ ok: true });

  if (body.action === "mgmtGet") {
    if (!body.sheet) return json_({ ok: false, error: "Missing sheet" });
    return json_({ ok: true, records: mgmtRecords_(String(body.sheet), true) });
  }

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
