import { useCallback, useEffect, useMemo, useState } from "react";
import { AUTO_REFRESH_MS, CATEGORIES, CONFIG_API_URL, PRICES, checkAdminKey, downloadCSV, fetchMgmt, fetchSheet, fetchSheetList, filterRows, saveMgmt, saveSheetList, store } from "./lib/sheet.js";
import { applyMgmt, newManualKey, peopleCategoryCounts, priceChecks, teamsFromPeople } from "./lib/manage.js";
import Tabs from "./components/Tabs.jsx";
import Stats from "./components/Stats.jsx";
import Filters from "./components/Filters.jsx";
import CsvMenu from "./components/CsvMenu.jsx";
import { exportAllSheets, playerHeaders, playerRow } from "./lib/export.js";
import DataTable from "./components/DataTable.jsx";
import TeamList from "./components/TeamList.jsx";
import PeopleList from "./components/PeopleList.jsx";
import { STATUS, buildPayments, buildPeople } from "./lib/people.js";
import RowDialog from "./components/RowDialog.jsx";
import Icon from "./components/Icon.jsx";
import AddSheetDialog from "./components/AddSheetDialog.jsx";
import AdminDialog from "./components/AdminDialog.jsx";
import ManageView from "./components/ManageView.jsx";
import Charts from "./components/Charts.jsx";
import AddPlayerDialog from "./components/AddPlayerDialog.jsx";
import useTheme from "./lib/useTheme.js";

const VIEW_KEY = "sheetDashboard.view", ADMIN_KEY = "sheetDashboard.adminKey";
const VIEWS = [["table", "Table", "table"], ["list", "Teams", "users"], ["people", "Players", "user"], ["charts", "Charts", "chart"]];
const MANAGE_VIEW = ["manage", "Manage", "edit"]; // เฉพาะแอดมิน

export default function App() {
  // รายการชีตมาจาก Apps Script (ดู CONFIG_API_URL ใน lib/sheet.js) — ทุกคนเห็นเหมือนกัน แก้ได้เฉพาะแอดมิน
  const [sheets, setSheets] = useState(null);
  const [listError, setListError] = useState(null);
  // รหัสแอดมินเก็บในเครื่องนี้เท่านั้น — Apps Script ตรวจซ้ำทุกครั้งที่บันทึก
  const [adminKey, setAdminKey] = useState(() => (CONFIG_API_URL && store.get(ADMIN_KEY)) || "");
  const [adding, setAdding] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  // ค่าที่แอดมินแก้ในหน้า Manage ของชีตที่เลือก { playerKey: data } — วางทับข้อมูลจากฟอร์มทุกครั้งที่โหลด
  const [records, setRecords] = useState({});
  const [active, setActive] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [updated, setUpdated] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState(null);
  const [sort, setSort] = useState({ col: null, dir: 1 });
  // ตัวกรองหน้า Players: สถานะการจ่ายเงิน และจำนวนประเภทที่ลง (1, 2, 3 …)
  const [payStatus, setPayStatus] = useState(null);
  const [catCount, setCatCount] = useState(null);
  // ?view=list หรือ ?view=people ในลิงก์ใช้เปิดมุมมองนั้นตรง ๆ ได้ ไม่งั้นจำค่าล่าสุด
  const [viewPref, setView] = useState(() => {
    const v = new URLSearchParams(location.search).get("view") || store.get(VIEW_KEY);
    return [...VIEWS, MANAGE_VIEW].some(([k]) => k === v) ? v : "table";
  });
  const views = adminKey ? [...VIEWS, MANAGE_VIEW] : VIEWS;
  const view = views.some(([k]) => k === viewPref) ? viewPref : "table";
  // popup: { row } จากตาราง หรือ { person } จากรายชื่อ (รวมคนที่ไม่ได้กรอกฟอร์ม)
  const [openTarget, setOpenTarget] = useState(null);
  const open = (x) => setOpenTarget(Array.isArray(x) ? { row: x } : { person: x });
  const [theme, toggleTheme] = useTheme();

  const sheet = sheets?.[Math.min(active, sheets.length - 1)];
  const { name: sName, url: sUrl, tab: sTab } = sheet || {};

  const loadList = useCallback(async () => {
    try {
      const list = await fetchSheetList();
      setSheets((old) => (JSON.stringify(old) === JSON.stringify(list) ? old : list));
      setListError(null);
    } catch (e) {
      setListError(e.message);
    }
  }, []);

  const load = useCallback(async () => {
    if (!sUrl) return;
    setLoading(true);
    try {
      // ข้อมูลฟอร์ม + ค่าที่แก้ไว้ โหลดพร้อมกัน · โหลดค่าที่แก้ไม่ได้ → ใช้ค่าเดิมที่มี
      const [d, m] = await Promise.all([
        fetchSheet({ url: sUrl, tab: sTab }),
        fetchMgmt({ url: sUrl, tab: sTab }, adminKey).catch((e) => {
          if (/admin key/i.test(e.message)) { setAdminKey(""); store.set(ADMIN_KEY, null); }
          return null;
        }),
      ]);
      setData(d);
      if (m) setRecords(m);
      setError(null);
      setUpdated("Updated " + new Date().toLocaleTimeString("en-GB"));
    } catch (e) {
      setData(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sUrl, sTab, adminKey]);

  // ข้อมูลชีตที่เลือก: โหลดตอนเปิด/เปลี่ยนชีต และทุก AUTO_REFRESH_MS
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // รายการชีตจากชีตควบคุม: เช็กทุก AUTO_REFRESH_MS เช่นกัน (เปลี่ยนชีตแล้วทุกคนเห็นภายใน ~1 นาที)
  useEffect(() => {
    loadList();
    const t = setInterval(() => document.visibilityState === "visible" && loadList(), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [loadList]);

  // ชีตเปลี่ยน (เช่น แก้ลิงก์ในชีตควบคุม) → ล้างข้อมูลเก่า
  useEffect(() => { setData(null); setError(null); setRecords({}); }, [sUrl, sTab]);

  const refresh = () => { loadList(); load(); };

  const signIn = async (key) => {
    await checkAdminKey(key);
    setAdminKey(key); store.set(ADMIN_KEY, key); setSigningIn(false);
  };
  const signOut = () => { setAdminKey(""); store.set(ADMIN_KEY, null); };

  // บันทึกรายการชีตใหม่ให้ทุกคน — รหัสผิด (เช่น ถูกเปลี่ยน) จะออกจากโหมดแอดมิน
  const saveList = async (list) => {
    try {
      setSheets(await saveSheetList(adminKey, list));
      return true;
    } catch (e) {
      alert("Couldn't save: " + e.message);
      if (/admin key/i.test(e.message)) signOut();
      return false;
    }
  };

  const addSheet = async (s) => {
    if (await saveList([...sheets, s])) { setAdding(false); switchTo(sheets.length); }
  };

  const removeSheet = async (i) => {
    const s = sheets[i];
    if (!s || !confirm(`Remove "${s.name}" for everyone?\n(The Google Sheet itself is not deleted.)`)) return;
    if (await saveList(sheets.filter((_, j) => j !== i))) switchTo(Math.max(0, Math.min(active, sheets.length - 2)));
  };

  // บันทึกค่าที่แก้ของผู้เล่น 1 คน (data = null → ลบ) — แสดงผลทันที แล้วค่อยยืนยันกับเซิร์ฟเวอร์
  const saveRecord = async (key, rec) => {
    setRecords((r) => {
      const next = { ...r };
      if (rec == null) delete next[key];
      else next[key] = { ...rec, updated: r[key]?.updated };
      return next;
    });
    try {
      setRecords(await saveMgmt(adminKey, { url: sUrl, tab: sTab }, key, rec));
      return true;
    } catch (e) {
      alert("Couldn't save: " + e.message);
      if (/admin key/i.test(e.message)) signOut();
      load();
      return false;
    }
  };

  const addPlayer = async (rec) => {
    const ok = await saveRecord(newManualKey(), rec);
    if (ok) setAddingPlayer(false);
    return ok;
  };

  const switchTo = (i) => {
    setActive(i); setData(null); setError(null); setFilterCat(null); setSort({ col: null, dir: 1 }); setQ("");
    setPayStatus(null); setCatCount(null);
  };

  const changeView = (v) => { setView(v); store.set(VIEW_KEY, v); };

  const rows = useMemo(
    () => (data ? filterRows(data, { q, filterCat, sortCol: sort.col, sortDir: sort.dir }) : []),
    [data, q, filterCat, sort],
  );
  // ทุกคน = รายชื่อจากฟอร์ม + ค่าที่แอดมินแก้ (ใช้ทั้งหน้า Players, Teams, Manage และ popup)
  const merged = useMemo(
    () => (data ? applyMgmt(buildPeople(data), records, data.meta) : { people: [], hidden: [], orphans: [] }),
    [data, records],
  );
  const allPeople = merged.people;
  // ยอดเงินแต่ละแถวเทียบกับราคา (เตือนเฉพาะแอดมิน)
  const checks = useMemo(
    () => (data && adminKey ? priceChecks(buildPayments(data), [...merged.people, ...merged.hidden], PRICES) : []),
    [data, merged, adminKey],
  );
  const people = useMemo(() => {
    const s = q.toLowerCase().trim();
    return allPeople.filter((p) =>
      (!filterCat || p.cats.some((c) => c.cat === filterCat)) &&
      (!s || [p.name, p.row?.join(" "), p.email, p.phone, p.remark, ...p.cats.map((c) => c.partner)]
        .some((v) => v && v.toLowerCase().includes(s))));
  }, [allPeople, q, filterCat]);
  const groups = useMemo(() => (view === "list" ? teamsFromPeople(people, filterCat) : []), [people, filterCat, view]);
  const shownPeople = useMemo(() => people.filter((p) =>
    (!payStatus || p.status === payStatus) && (!catCount || p.cats.length === catCount)), [people, payStatus, catCount]);
  const cats = useMemo(() => peopleCategoryCounts(allPeople), [allPeople]);

  const exportCSV = () => {
    if (!data) return;
    const out = view === "manage"
      ? [["#", ...playerHeaders(true)], ...people.map((p, i) => [i + 1, ...playerRow(p, true)])]
      : view === "people"
      ? [["#", "Name", "Registered", "Categories", "Category list", "Payment", "Amount (THB)", "Paid by"],
        ...shownPeople.map((p, i) => [i + 1, p.name, p.row ? "Yes" : "No", p.cats.length,
          p.cats.map((c) => c.cat + (c.partner ? ` (with ${c.partner})` : "")).join("; "),
          STATUS[p.status].label, p.amount || "", p.paidBy.filter((n) => n !== p.name).join(", ")])]
      : view === "charts"
      ? [["Category", "Paid", "Unpaid", "Total"], ...cats.map(([c]) => {
          const ps = people.flatMap((p) => p.cats.filter((x) => x.cat === c));
          const paid = ps.filter((x) => x.paid).length;
          return [c, paid, ps.length - paid, ps.length];
        })]
      : view === "list"
      ? [["Category", "#", "Player", "Partner"], ...groups.flatMap(([c, list]) => list.map((t, i) => [c, i + 1, t.player, t.partner]))]
      : [data.headers, ...rows];
    downloadCSV(out, (sName || "sheet") + ".csv");
  };

  // CSV รวมรายชื่อผู้เล่นจากทุกชีต
  const exportAll = async () => {
    const { rows: out, failed } = await exportAllSheets(sheets, adminKey);
    if (failed.length) alert("Skipped (couldn't load):\n" + failed.join("\n"));
    if (out.length > 1) downloadCSV(out, "all-sheets-" + new Date().toISOString().slice(0, 10) + ".csv");
  };

  let body;
  if (!sheets && listError) body = <div className="state">⚠️ Can't load the sheet list — {listError}</div>;
  else if (!sheets) body = <div className="state"><div className="loader" />Loading…</div>;
  else if (!sheet) body = <div className="state">{adminKey ? 'No sheets yet — click "Add sheet".' : "No sheets configured yet."}</div>;
  else if (error) body = <div className="state">⚠️ {error}</div>;
  else if (!data) body = <div className="state"><div className="loader" />Loading…</div>;
  else if (view === "charts") body = <Charts people={people} meta={data.meta} />;
  else if (view === "manage") body = (
    <ManageView data={data} people={people} allPeople={allPeople} checks={checks} hidden={merged.hidden} orphans={merged.orphans}
      catOptions={CATEGORIES} onSave={saveRecord} onAdd={() => setAddingPlayer(true)} onOpen={open} />
  );
  else if (view === "table" ? !rows.length : !people.length) body = <div className="state">No results</div>;
  else if (view === "people") body = (
    <PeopleList data={data} people={people} shown={shownPeople} onOpen={open}
      />
  );
  else if (view === "list") body = <TeamList data={data} people={allPeople} groups={groups} onOpen={open} />;
  else body = (
    <DataTable data={data} rows={rows} sortCol={sort.col} sortDir={sort.dir} onOpen={open}
      onSort={(i) => setSort((s) => ({ col: i, dir: s.col === i ? -s.dir : 1 }))} />
  );

  return (
    <>
      <header>
        <div className="header-in">
          <div className="brand">
            <img className="logo" src="./logo.png" alt="Thaipadelseries" />
            <div>
              <h1>Thaipadelseries forms</h1>
              <span className="muted">{updated || "\u00a0"}</span>
            </div>
          </div>
          <button className="btn icon-only" onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}>
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <button className={`btn label-sm ${loading ? "spin" : ""}`} onClick={refresh} aria-label="Refresh">
            <Icon name="refresh" /><span className="hide-sm">Refresh</span>
          </button>
          {CONFIG_API_URL && (adminKey ? <>
            {sheet && (
              <button className="btn label-sm danger" onClick={() => removeSheet(Math.min(active, sheets.length - 1))}
                aria-label="Remove sheet" title={`Remove "${sName}" for everyone`}>
                <Icon name="trash" /><span className="hide-sm">Remove sheet</span>
              </button>
            )}
            <button className="btn primary label-sm" onClick={() => setAdding(true)} disabled={!sheets} aria-label="Add sheet">
              <Icon name="plus" /><span className="hide-sm">Add sheet</span>
            </button>
            <button className="btn icon-only" onClick={signOut} aria-label="Sign out of admin" title="Sign out of admin">
              <Icon name="unlock" />
            </button>
          </> : (
            <button className="btn icon-only" onClick={() => setSigningIn(true)} aria-label="Admin sign-in" title="Admin">
              <Icon name="lock" />
            </button>
          ))}
        </div>
      </header>

      <main className="wrap">
        {sheets?.length > 1 && <Tabs sheets={sheets} active={Math.min(active, sheets.length - 1)} onSelect={switchTo}
          onDelete={adminKey ? removeSheet : null} />}
        {data && <Stats data={data} rows={rows} />}
        {sheet && <div className="toolbar">
          <div className="seg">
            {views.map(([v, label, icon]) => (
              <button key={v} className={view === v ? "on" : ""} onClick={() => changeView(v)}>
                <Icon name={icon} size={16} />{label}
              </button>
            ))}
          </div>
          <label className="search">
            <Icon name="search" size={16} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, anything…" />
          </label>
          <CsvMenu onThisView={exportCSV} onAllSheets={exportAll} sheetCount={sheets?.length || 0} />
          {data && <span className="muted count">
            {view === "people" ? `Showing ${shownPeople.length} of ${people.length} players`
              : view === "table" ? `Showing ${rows.length} of ${data.rows.length} entries`
              : `${people.length} of ${allPeople.length} players`}
          </span>}
        </div>}
        {data && (
          <Filters cats={cats} filterCat={filterCat} onCat={setFilterCat} people={people} view={view}
            payStatus={payStatus} onPayStatus={setPayStatus} catCount={catCount} onCatCount={setCatCount}
            maxCats={Math.max(3, data.meta.cats.length, ...allPeople.map((p) => p.cats.length))} />
        )}
        {body}
      </main>

      <RowDialog data={data} people={allPeople} target={openTarget} isAdmin={!!adminKey} checks={checks} onOpen={open} onClose={() => setOpenTarget(null)} />
      {CONFIG_API_URL && <>
        <AddSheetDialog open={adding} onClose={() => setAdding(false)} onAdd={addSheet} />
        <AdminDialog open={signingIn} onClose={() => setSigningIn(false)} onSignIn={signIn} />
        {adminKey && <AddPlayerDialog open={addingPlayer} onClose={() => setAddingPlayer(false)} onAdd={addPlayer} />}
      </>}
    </>
  );
}
