import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AUTO_REFRESH_MS, CATEGORIES, CONFIG_API_URL, PRICES, SHEETS_CACHE_KEY, checkKey, clearSheetCache, downloadCSV, fetchSheetList, filterRows, isAuthError, loadSheet, peekSheet, saveMgmt, saveSheetList, store } from "./lib/sheet.js";
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
import SignIn from "./components/SignIn.jsx";
import ManageView from "./components/ManageView.jsx";
import Charts from "./components/Charts.jsx";
import Compare from "./components/Compare.jsx";
import AddPlayerDialog from "./components/AddPlayerDialog.jsx";
import useTheme from "./lib/useTheme.js";
import { dateTime } from "./lib/dates.js";

const VIEW_KEY = "sheetDashboard.view", AUTH_KEY = "sheetDashboard.auth", OLD_ADMIN_KEY = "sheetDashboard.adminKey";
const VIEWS = [["table", "Table", "table"], ["list", "Teams", "users"], ["people", "Players", "user"], ["charts", "Charts", "chart"], ["compare", "Compare", "compare"]];
const MANAGE_VIEW = ["manage", "Manage", "edit"]; // เฉพาะแอดมิน

export default function App() {
  // รายการชีตมาจาก Apps Script (ดู CONFIG_API_URL ใน lib/sheet.js) — ทุกคนเห็นเหมือนกัน แก้ได้เฉพาะแอดมิน
  // เริ่มจากรายการที่จำไว้ → โหลดข้อมูลชีตได้ทันที ไม่ต้องรอรายการจาก Apps Script ก่อน
  const [sheets, setSheets] = useState(() => store.get(SHEETS_CACHE_KEY));
  const [listError, setListError] = useState(null);
  // รหัสที่ใช้เข้าสู่ระบบ { key, role } — เก็บในเครื่องนี้ · Apps Script ตรวจรหัสทุกคำขอ
  //   role "viewer" = ดูอย่างเดียว · "admin" = ดู + แก้
  const [auth, setAuth] = useState(() => {
    if (!CONFIG_API_URL) return null;
    const a = store.get(AUTH_KEY);
    if (a?.key) return a;
    const old = store.get(OLD_ADMIN_KEY); // รหัสแอดมินจากเวอร์ชันก่อน
    return old ? { key: old, role: "admin" } : null;
  });
  const authKey = auth?.key || "";
  const adminKey = auth?.role === "admin" ? auth.key : "";
  const [adding, setAdding] = useState(false);
  const [editingSheet, setEditingSheet] = useState(null); // index ของชีตที่กำลังแก้
  const [addingPlayer, setAddingPlayer] = useState(false);
  // ค่าที่แอดมินแก้ในหน้า Manage ของชีตที่เลือก { playerKey: data } — วางทับข้อมูลจากฟอร์มทุกครั้งที่โหลด
  const [records, setRecords] = useState({});
  // index ในรายการ (ลำดับตามวันที่ add — อันใหม่อยู่ท้าย) · null = ชีตที่ add ล่าสุด
  const [activePick, setActive] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [updated, setUpdated] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState(null);
  const [sort, setSort] = useState({ col: null, dir: 1 });
  // ตัวกรองหน้า Players: สถานะการจ่ายเงิน จำนวนประเภทที่ลง และการเรียงตามวันที่สมัคร
  const [payStatus, setPayStatus] = useState(null);
  const [catCount, setCatCount] = useState(null);
  const [regOrder, setRegOrder] = useState(null); // null = ตามชื่อ · "asc" สมัครก่อน → ล่าสุด · "desc" ล่าสุด → ก่อน
  // ?view=list หรือ ?view=people ในลิงก์ใช้เปิดมุมมองนั้นตรง ๆ ได้ ไม่งั้นจำค่าล่าสุด
  const [viewPref, setView] = useState(() => {
    const v = new URLSearchParams(location.search).get("view") || store.get(VIEW_KEY);
    return [...VIEWS, MANAGE_VIEW].some(([k]) => k === v) ? v : "table";
  });
  const views = adminKey ? [...VIEWS, MANAGE_VIEW] : VIEWS;
  const view = views.some(([k]) => k === viewPref) ? viewPref : "table";
  const comparing = view === "compare"; // หน้าเทียบทุกชีต: ซ่อนแท็บ/สถิติ/ตัวกรองของชีตเดียว
  // popup: { row } จากตาราง หรือ { person } จากรายชื่อ (รวมคนที่ไม่ได้กรอกฟอร์ม)
  const [openTarget, setOpenTarget] = useState(null);
  const open = (x) => setOpenTarget(Array.isArray(x) ? { row: x } : { person: x });
  const [theme, toggleTheme] = useTheme();

  const active = sheets?.length ? (activePick == null ? sheets.length - 1 : Math.min(activePick, sheets.length - 1)) : 0;
  const sheet = sheets?.[active];
  const { name: sName, url: sUrl, tab: sTab } = sheet || {};

  const role = auth?.role || "";
  const signOut = useCallback(() => {
    setAuth(null); store.set(AUTH_KEY, null); store.set(OLD_ADMIN_KEY, null);
    clearSheetCache();
    setSheets(null); setData(null); setRecords({});
  }, []);

  const loadList = useCallback(async () => {
    if (CONFIG_API_URL && !authKey) return;
    try {
      const list = await fetchSheetList(authKey);
      store.set(SHEETS_CACHE_KEY, list);
      setSheets((old) => (JSON.stringify(old) === JSON.stringify(list) ? old : list));
      setListError(null);
    } catch (e) {
      if (isAuthError(e)) return signOut();
      setListError(e.message);
    }
  }, [authKey, signOut]);

  // นับคำขอ — คำตอบที่มาช้าของชีตเดิม/คำขอเก่า จะไม่ทับข้อมูลของชีตที่เปิดอยู่
  const loadSeq = useRef(0);
  const shown = useRef(false); // มีข้อมูลแสดงอยู่แล้วไหม (รีเฟรชพลาด = เก็บของเดิมไว้)
  shown.current = !!data;
  const lastLoad = useRef(0);
  const load = useCallback(async () => {
    if (!sUrl || (CONFIG_API_URL && !authKey)) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      // ข้อมูลฟอร์ม + ค่าที่แก้ไว้ มาในคำขอเดียว
      const { data: d, records: m } = await loadSheet({ url: sUrl, tab: sTab }, authKey, role);
      if (seq !== loadSeq.current) return;
      setData(d);
      setRecords(m);
      setError(null);
      lastLoad.current = Date.now();
      setUpdated("Updated " + new Date().toLocaleTimeString("en-GB"));
    } catch (e) {
      if (seq !== loadSeq.current) return;
      if (isAuthError(e)) return signOut();
      // มีข้อมูลอยู่แล้ว → ไม่ล้างหน้าจอ แค่บอกว่าอัปเดตไม่สำเร็จ (รอบหน้าจะลองใหม่เอง)
      if (shown.current) setUpdated("⚠️ Couldn't refresh — showing earlier data");
      else { setData(null); setError(e.message); }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [sUrl, sTab, authKey, role, signOut]);

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

  // ชีตเปลี่ยน → แสดงสำเนาล่าสุดในเครื่องทันที (ถ้ามี) ระหว่างรอข้อมูลจริง
  useEffect(() => {
    const c = peekSheet({ url: sUrl, tab: sTab }, role);
    setData(c?.data || null); setRecords(c?.records || {}); setError(null);
    setUpdated(c ? "Saved copy from " + new Date(c.at).toLocaleTimeString("en-GB") + " · updating…" : "");
  }, [sUrl, sTab, role]);

  // กลับมาที่แท็บ/แอป หลังหายไปนาน → โหลดใหม่ทันที ไม่ต้องรอรอบถัดไปหรือกด reload
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastLoad.current < 15_000) return;
      load(); loadList();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("online", onShow);
    return () => { document.removeEventListener("visibilitychange", onShow); window.removeEventListener("online", onShow); };
  }, [load, loadList]);

  const refresh = () => { loadList(); load(); };

  const signIn = async (key) => {
    const role = await checkKey(key);
    const a = { key, role };
    setAuth(a); store.set(AUTH_KEY, a); store.set(OLD_ADMIN_KEY, null);
  };

  // ตรวจรหัสที่จำไว้อีกครั้งตอนเปิดเว็บ (เผื่อรหัสถูกเปลี่ยน หรือสิทธิ์เปลี่ยน)
  useEffect(() => {
    if (!authKey) return;
    checkKey(authKey).then(
      (role) => role !== auth.role && setAuth((a) => { const n = { ...a, role }; store.set(AUTH_KEY, n); return n; }),
      (e) => isAuthError(e) && signOut(),
    );
  }, [authKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // บันทึกรายการชีตใหม่ให้ทุกคน — รหัสผิด (เช่น ถูกเปลี่ยน) จะออกจากโหมดแอดมิน
  const saveList = async (list) => {
    try {
      setSheets(await saveSheetList(adminKey, list));
      return true;
    } catch (e) {
      alert("Couldn't save: " + e.message);
      if (isAuthError(e)) signOut();
      return false;
    }
  };

  const addSheet = async (s) => {
    if (await saveList([...sheets, s])) { setAdding(false); switchTo(sheets.length); }
  };

  const editSheet = async (s) => {
    if (await saveList(sheets.map((x, j) => (j === editingSheet ? s : x)))) setEditingSheet(null);
  };

  // ลากย้ายแท็บ: แสดงลำดับใหม่ทันที แล้วบันทึกให้ทุกคน (ไม่สำเร็จ = โหลดรายการเดิมกลับมา)
  const reorderSheets = async (idx) => {
    const next = idx.map((i) => sheets[i]);
    setSheets(next);
    setActive(idx.indexOf(active));
    if (!(await saveList(next))) loadList();
  };

  const removeSheet = async (i) => {
    const s = sheets[i];
    if (!s || !confirm(`Remove "${s.name}" for everyone?\n(The Google Sheet itself is not deleted.)`)) return;
    if (await saveList(sheets.filter((_, j) => j !== i))) switchTo(null);
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
      if (isAuthError(e)) signOut();
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
    setPayStatus(null); setCatCount(null); setRegOrder(null);
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
  const shownPeople = useMemo(() => {
    const list = people.filter((p) => (!payStatus || p.status === payStatus) && (!catCount || p.cats.length === catCount));
    if (!regOrder) return list;
    // คนที่ยังไม่มีวันที่สมัครอยู่ท้ายเสมอ · partner ใช้วันที่คู่ลงชื่อให้
    const at = (p) => (p.registered ? dateTime(p.registered) : null);
    const dir = regOrder === "desc" ? -1 : 1;
    return list.map((p) => [p, at(p)])
      .sort(([, a], [, b]) => (a == null) - (b == null) || (a == null ? 0 : (a - b) * dir))
      .map(([p]) => p);
  }, [people, payStatus, catCount, regOrder]);
  const cats = useMemo(() => peopleCategoryCounts(allPeople), [allPeople]);

  const exportCSV = () => {
    if (!data) return;
    const out = view === "manage"
      ? [["#", ...playerHeaders(true)], ...people.map((p, i) => [i + 1, ...playerRow(p, true)])]
      : view === "people"
      ? [["#", "Name", "Registration date", "Categories", "Category list", "Payment", "Amount (THB)", "Paid by"],
        ...shownPeople.map((p, i) => [i + 1, p.name, p.registered || "", p.cats.length,
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
    const { rows: out, failed } = await exportAllSheets(sheets, authKey, !!adminKey);
    if (failed.length) alert("Skipped (couldn't load):\n" + failed.join("\n"));
    if (out.length > 1) downloadCSV(out, "all-sheets-" + new Date().toISOString().slice(0, 10) + ".csv");
  };

  let body;
  if (!sheets && listError) body = <div className="state">⚠️ Can't load the sheet list — {listError}</div>;
  else if (!sheets) body = <div className="state"><div className="loader" />Loading…</div>;
  // Compare โหลดทุกชีตเอง ไม่ขึ้นกับชีตที่เลือกอยู่
  else if (view === "compare") body = <Compare sheets={sheets} authKey={authKey} scope={role} />;
  else if (!sheet) body = <div className="state">{adminKey ? 'No sheets yet — click "Add sheet".' : "No sheets configured yet."}</div>;
  else if (error) body = (
    <div className="state">
      <p style={{ margin: "0 0 12px" }}>⚠️ {error}</p>
      <button className="btn" onClick={load} disabled={loading}><Icon name="refresh" size={16} />{loading ? "Loading…" : "Try again"}</button>
    </div>
  );
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

  // ต้องใส่รหัสก่อนเห็นข้อมูล
  if (CONFIG_API_URL && !auth) return <SignIn onSignIn={signIn} />;

  return (
    <div className="shell">
      {/* \u0e40\u0e21\u0e19\u0e39\u0e14\u0e49\u0e32\u0e19\u0e0b\u0e49\u0e32\u0e22 (\u0e08\u0e2d\u0e40\u0e25\u0e47\u0e01\u0e01\u0e25\u0e32\u0e22\u0e40\u0e1b\u0e47\u0e19\u0e41\u0e16\u0e1a\u0e25\u0e48\u0e32\u0e07) */}
      <aside className="sidebar">
        <img className="side-logo" src="./logo.png" alt="Thaipadelseries" />
        {sheet && (
          <nav className="side-nav" aria-label="Views">
            {views.map(([v, label, icon]) => (
              <button key={v} className={view === v ? "on" : ""} onClick={() => changeView(v)}
                aria-label={label} aria-current={view === v ? "page" : undefined}>
                <Icon name={icon} size={20} /><span>{label}</span>
              </button>
            ))}
          </nav>
        )}
      </aside>

      <header>
        <div className="header-in">
          <div className="brand">
            <img className="logo" src="./logo.png" alt="Thaipadelseries" />
            <div>
              <h1>Thaipadelseries forms</h1>
              <span className="muted">{updated || "\u00a0"}</span>
            </div>
          </div>
          <div className="header-actions">
            <div className="header-actions-in">
              <button className="btn icon-only" onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={theme === "dark" ? "Light mode" : "Dark mode"}>
                <Icon name={theme === "dark" ? "sun" : "moon"} />
              </button>
              <button className={`btn label-sm ${loading ? "spin" : ""}`} onClick={refresh} aria-label="Refresh">
                <Icon name="refresh" /><span className="hide-sm">Refresh</span>
              </button>
              {adminKey && <>
                {sheet && (
                  <button className="btn label-sm danger" onClick={() => removeSheet(active)}
                    aria-label="Remove sheet" title={`Remove "${sName}" for everyone`}>
                    <Icon name="trash" /><span className="hide-sm">Remove sheet</span>
                  </button>
                )}
                <button className="btn primary label-sm" onClick={() => setAdding(true)} disabled={!sheets} aria-label="Add sheet">
                  <Icon name="plus" /><span className="hide-sm">Add sheet</span>
                </button>
              </>}
              {CONFIG_API_URL && (
                <button className="btn icon-only" onClick={signOut} aria-label="Sign out"
                  title={`Sign out (${adminKey ? "admin" : "viewer"}) — use another password to switch`}>
                  <Icon name="logout" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="page-head">
          <h2 key={view} className="page-title">{views.find(([v]) => v === view)?.[1] || "Dashboard"}</h2>
        </div>
        {/* แอดมินเห็นแท็บเสมอ (แม้มีชีตเดียว) เพื่อแก้ชื่อได้ */}
        {!comparing && (sheets?.length > 1 || (adminKey && sheets?.length > 0)) && <Tabs sheets={sheets} active={active} onSelect={switchTo}
          onEdit={adminKey ? setEditingSheet : null} onDelete={adminKey ? removeSheet : null} onReorder={adminKey ? reorderSheets : null} />}
        {!comparing && data && <Stats data={data} rows={rows} />}
        {!comparing && sheet && <div className="toolbar">
          <label className="search">
            <Icon name="search" size={14} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
          </label>
          <CsvMenu onThisView={exportCSV} onAllSheets={exportAll} sheetCount={sheets?.length || 0} />
          {data && <span className="muted count">
            {view === "people" ? `Showing ${shownPeople.length} of ${people.length} players`
              : view === "table" ? `Showing ${rows.length} of ${data.rows.length} entries`
              : `${people.length} of ${allPeople.length} players`}
          </span>}
        </div>}
        {!comparing && data && (
          <Filters cats={cats} filterCat={filterCat} onCat={setFilterCat} people={people} view={view}
            payStatus={payStatus} onPayStatus={setPayStatus} catCount={catCount} onCatCount={setCatCount}
            maxCats={Math.max(3, data.meta.cats.length, ...allPeople.map((p) => p.cats.length))}
            hasTimestamp={data.meta.time >= 0} regOrder={regOrder} onRegOrder={setRegOrder} />
        )}
        {/* key เปลี่ยนตอนสลับหน้า/ชีต → เนื้อหาเล่นแอนิเมชันเข้าใหม่ */}
        <div key={`${view}:${active}`} className="view-in">{body}</div>
      </main>

      <RowDialog data={data} people={allPeople} target={openTarget} isAdmin={!!adminKey} checks={checks} onOpen={open} onClose={() => setOpenTarget(null)} />
      {CONFIG_API_URL && <>
        <AddSheetDialog open={adding} onClose={() => setAdding(false)} onAdd={addSheet} />
        {adminKey && <AddSheetDialog open={editingSheet != null} initial={sheets?.[editingSheet]}
          onClose={() => setEditingSheet(null)} onAdd={editSheet} />}
        {adminKey && <AddPlayerDialog open={addingPlayer} onClose={() => setAddingPlayer(false)} onAdd={addPlayer} />}
      </>}
    </div>
  );
}
