import { useEffect, useState } from "react";
import { loadAllPeople, peekAllPeople } from "../lib/export.js";
import { playerKey } from "../lib/manage.js";
import { CATEGORIES, fmt, sheetKey, store } from "../lib/sheet.js";
import { Card, Swatch, dayLabel, niceMax, summarize, useTip } from "./Charts.jsx";

// สีประจำชีตตามลำดับในรายการ (k1…k8) — ชีตเดิมได้สีเดิมเสมอ แม้เลือก/ไม่เลือกชีตอื่น · เลือกเทียบได้ทีละไม่เกิน 8 ชีต
const MAX_SHEETS = 8;
const PICK_KEY = "sheetDashboard.compare";
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// แท่งแนวนอนแบบกลุ่ม: 1 กลุ่ม = 1 ป้าย, ในกลุ่มมีแท่งของแต่ละชีต
function GroupBars({ groups, series, bind }) {
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  return (
    <div className="hbars cmp-groups">
      {groups.map(({ label, values }) => (
        <div key={label} className="cmp-group" {...bind([[label, ""], ...values.map((n, i) => [n, series[i].name, series[i].k])])}
          aria-label={`${label}: ${values.map((n, i) => `${series[i].name} ${n}`).join(", ")}`}>
          <span className="hbar-label">{label}</span>
          <span className="cmp-bars">
            {values.map((n, i) => (
              <span key={i} className="hbar-track">
                {n > 0 && <span className={`hbar-seg ${series[i].k}`} style={{ width: `${(n / max) * 100}%` }} />}
                <span className="hbar-value">{n}</span>
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

// ยอดสมัครสะสม เทียบตาม "วันที่ N นับจากคนแรกสมัคร" — ทัวร์นาเมนต์ต่างช่วงเวลากันจึงวางทับกันได้
function CumulativeLines({ series, bind }) {
  const runs = series.map((x) => { let t = 0; return x.sum.timeline.map(([, n]) => (t += n)); });
  const len = Math.max(1, ...runs.map((r) => r.length));
  const yMax = niceMax(Math.max(0, ...runs.map((r) => r.at(-1) || 0)));
  const xy = (i, n) => `${((i + 0.5) / len) * 100},${100 - (n / yMax) * 100}`;
  return (
    <div className="cols line cmp">
      <div className="cols-plot">
        {[yMax, Math.round(yMax / 2), 0].map((t) => (
          <span key={t} className="cols-grid" style={{ bottom: `${(t / yMax) * 100}%` }}><span>{t}</span></span>
        ))}
        <svg className="line-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {runs.map((r, s) => r.length > 0 && (
            <path key={s} className={`line-path ${series[s].k}`} d={"M" + r.map((n, i) => xy(i, n)).join(" L")} />
          ))}
        </svg>
        <div className="cols-bars">
          {Array.from({ length: len }, (_, i) => {
            const at = runs.map((r, s) => [r[i], s]).filter(([n]) => n != null);
            return (
              <div key={i} className="col" {...bind([[`Day ${i + 1}`, ""], ...at.map(([n, s]) => [n, series[s].name, series[s].k])])}
                aria-label={`Day ${i + 1}: ${at.map(([n, s]) => `${series[s].name} ${n}`).join(", ")}`}>
                {at.map(([n, s]) => (
                  <span key={s} className={`line-dot ${series[s].k}${i === runs[s].length - 1 ? " end" : ""}`} style={{ bottom: `${(n / yMax) * 100}%` }} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="cols-x">
        {Array.from({ length: len }, (_, i) => <span key={i}>{i === 0 || i === len - 1 ? `Day ${i + 1}` : ""}</span>)}
      </div>
    </div>
  );
}

export default function Compare({ sheets, authKey, scope }) {
  const [results, setResults] = useState(null);
  const [bind, tipEl] = useTip();
  // ชีตที่เลือกเทียบ (เก็บเป็น sheetKey ในเครื่องนี้) · null = ค่าเริ่มต้น 8 ชีตที่ add ล่าสุด
  const [picked, setPicked] = useState(() => store.get(PICK_KEY));
  const keys = sheets.map(sheetKey);
  const on = (i) => (picked ? picked.includes(keys[i]) : i >= keys.length - MAX_SHEETS);
  const toggle = (i) => {
    const cur = keys.filter((_, j) => on(j));
    const next = on(i) ? cur.filter((k) => k !== keys[i]) : cur.length < MAX_SHEETS ? [...cur, keys[i]] : cur;
    setPicked(next); store.set(PICK_KEY, next);
  };
  const pickAll = () => { const next = keys.slice(-MAX_SHEETS); setPicked(next); store.set(PICK_KEY, next); };

  // โหลดทุกชีตครั้งเดียว — การเลือก/ไม่เลือกแค่กรองผลที่มีอยู่ ไม่ต้องโหลดใหม่
  // แสดงสำเนาในเครื่องก่อน (ถ้ามีครบทุกชีต) แล้วค่อยแทนด้วยข้อมูลล่าสุด
  useEffect(() => {
    let live = true;
    setResults(peekAllPeople(sheets, scope));
    loadAllPeople(sheets, authKey, scope).then((r) => live && setResults(r));
    return () => { live = false; };
  }, [sheets, authKey, scope]);

  if (sheets.length < 2) return <div className="state">Add at least two sheets to compare them.</div>;
  if (!results) return <div className="state"><div className="loader" />Loading all sheets…</div>;

  const failed = results.filter((r) => r.error);
  const nPicked = keys.filter((_, i) => on(i)).length;
  const picker = (
    <div className="chips cmp-picker">
      <span className="muted">Compare {nPicked} of {sheets.length}:</span>
      {sheets.map((sh, i) => [sh, i]).reverse().map(([sh, i]) => (
        <button key={keys[i]} className={`chip ${on(i) ? "on" : ""}`} onClick={() => toggle(i)} aria-pressed={on(i)}
          disabled={!on(i) && nPicked >= MAX_SHEETS} title={!on(i) && nPicked >= MAX_SHEETS ? `Up to ${MAX_SHEETS} sheets at a time` : ""}>
          <i className={`viz-swatch k${(i % MAX_SHEETS) + 1}`} />{sh.name}{results[i].error && " ⚠"}
        </button>
      ))}
      {nPicked < Math.min(sheets.length, MAX_SHEETS) && <button className="link-btn muted" onClick={pickAll}>Select all</button>}
    </div>
  );
  const series = results.map((r, i) => ({ ...r, k: `k${(i % MAX_SHEETS) + 1}`, name: r.s.name })).filter((r, i) => on(i) && !r.error)
    .map((r) => ({ ...r, sum: summarize(r.people, r.data.meta) })).reverse(); // ล่าสุดก่อน เหมือนแท็บ
  if (series.length < 2) return (
    <div className="viz">
      {picker}
      <div className="state">
        {nPicked < 2 ? "Pick at least two sheets to compare." : "⚠️ Couldn't load enough of the picked sheets."}
        {failed.length > 0 && <p className="muted">{failed.map((f) => `${f.s.name}: ${f.error}`).join(" · ")}</p>}
      </div>
    </div>
  );

  const legend = series.map((x) => <Swatch key={sheetKey(x.s)} series={x.k} label={x.name} />);

  // ตารางตัวเลขหลัก + คอลัมน์ Total ของชีตที่เลือกทั้งหมด
  const span = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5) + 1;
  const period = (t) => (t.length ? `${dayLabel(t[0][0])} – ${dayLabel(t.at(-1)[0])} (${t.length} days)` : "—");
  const allDays = series.flatMap((x) => x.sum.timeline.map(([d]) => d)).sort();
  const add = (k) => series.reduce((t, x) => t + x.sum[k], 0);
  const total = {
    players: add("players"), catEntries: add("catEntries"), paidPlayers: add("paidPlayers"),
    expected: add("expected"), collected: add("collected"), outstanding: add("outstanding"),
    nationCount: new Set(series.flatMap((x) => Object.keys(x.sum.natAll))).size,
  };
  const totalPeriod = allDays.length ? `${dayLabel(allDays[0])} – ${dayLabel(allDays.at(-1))} (${span(allDays[0], allDays.at(-1))} days)` : "—";
  // [ป้าย, ค่าตัวเลขสำหรับความยาวแถบ (null = ไม่มีแถบ), ข้อความที่แสดง]
  const metrics = [
    ["Players", (d) => d.players, (d) => fmt(d.players)],
    ["Category entries", (d) => d.catEntries, (d) => fmt(d.catEntries)],
    ["Paid players", (d) => pct(d.paidPlayers, d.players), (d) => `${fmt(d.paidPlayers)} · ${pct(d.paidPlayers, d.players)}%`],
    ["Expected (THB)", (d) => d.expected, (d) => fmt(d.expected)],
    ["Collected (THB)", (d) => d.collected, (d) => fmt(d.collected)],
    ["Outstanding (THB)", (d) => d.outstanding, (d) => fmt(d.outstanding)],
    ["Nationalities", (d) => d.nationCount, (d) => fmt(d.nationCount)],
    ["Registration period", (d) => d.timeline.length, (d) => (d === total ? totalPeriod : period(d.timeline))],
  ];

  // ประเภท: ตามลำดับในฟอร์ม + ประเภทอื่นที่เจอ
  const catNames = [...new Set([...CATEGORIES, ...series.flatMap((x) => x.sum.cats.map(([c]) => c))])];
  const catGroups = catNames.map((c) => ({
    label: c,
    values: series.map((x) => { const v = Object.fromEntries(x.sum.cats)[c]; return v ? v.paid + v.unpaid : 0; }),
  })).filter((g) => g.values.some((n) => n));

  // สัญชาติ: 6 อันดับแรกรวมทุกชีต ที่เหลือรวมเป็น Other
  const natTotal = {};
  series.forEach((x) => Object.entries(x.sum.natAll).forEach(([k, n]) => (natTotal[k] = (natTotal[k] || 0) + n)));
  const topNat = Object.entries(natTotal).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
  const natGroups = [
    ...topNat.slice(0, 6).map((k) => ({ label: k, values: series.map((x) => x.sum.natAll[k] || 0) })),
    ...(topNat.length > 6 ? [{ label: "Other", values: series.map((x) => topNat.slice(6).reduce((t, k) => t + (x.sum.natAll[k] || 0), 0)) }] : []),
  ];

  // ผู้เล่นที่ลงมากกว่า 1 ชีต (เทียบจากชื่อ)
  const seen = {};
  series.forEach((x, s) => x.people.forEach((p) => {
    const key = playerKey(p.name);
    if (!key) return;
    (seen[key] ||= { name: p.name, in: new Set() }).in.add(s);
  }));
  const returning = Object.values(seen).filter((v) => v.in.size > 1).sort((a, b) => b.in.size - a.in.size || a.name.localeCompare(b.name));

  return (
    <div className="viz">
      {picker}
      {failed.length > 0 && <div className="m-note warn">Skipped (couldn't load): {failed.map((f) => `${f.s.name} — ${f.error}`).join(" · ")}</div>}

      <Card title="Side by side" sub="Key numbers for each sheet — bars compare the sheets"
        table={[["Metric", ...series.map((x) => x.name), "Total"], ...metrics.map(([label, , text]) => [label, ...series.map((x) => text(x.sum)), text(total)])]}>
        <div className="cmp-metrics">
          {metrics.map(([label, val, text]) => {
            const max = Math.max(1, ...series.map((x) => val(x.sum)));
            return (
              <div key={label} className="cmp-metric">
                <div className="cmp-metric-head">
                  <span>{label}</span>
                  <span className="cmp-metric-total" title="All picked sheets">{text(total)}</span>
                </div>
                {series.map((x) => (
                  <div key={sheetKey(x.s)} className={`cmp-metric-row ${x.k}`} {...bind([[text(x.sum), x.name, x.k]])} aria-label={`${x.name}: ${text(x.sum)}`}>
                    <span className="cmp-metric-name"><i className={`viz-swatch ${x.k}`} />{x.name}</span>
                    <b>{text(x.sum)}</b>
                    <span className="cmp-metric-bar"><i style={{ width: `${(val(x.sum) / max) * 100}%` }} /></span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="viz-grid">
        <Card title="Registrations over time" sub="Running total, from each sheet's first sign-up" legend={legend}
          table={[["Sheet", "Days", "Total"], ...series.map((x) => [x.name, x.sum.timeline.length, x.sum.timeline.reduce((t, [, n]) => t + n, 0)])]}>
          {series.some((x) => x.sum.timeline.length) ? <CumulativeLines series={series} bind={bind} /> : <p className="muted">No timestamp column found.</p>}
        </Card>

        <Card title="Players per category" sub="Each player counted once per category" legend={legend}
          table={[["Category", ...series.map((x) => x.name)], ...catGroups.map((g) => [g.label, ...g.values])]}>
          <GroupBars groups={catGroups} series={series} bind={bind} />
        </Card>

        <Card title="Nationalities" sub="Top 6 across all sheets" legend={legend}
          table={[["Nationality", ...series.map((x) => x.name)], ...natGroups.map((g) => [g.label, ...g.values])]}>
          {natGroups.length ? <GroupBars groups={natGroups} series={series} bind={bind} /> : <p className="muted">No nationality column found.</p>}
        </Card>

        <Card title={`Returning players (${returning.length})`} sub="Same name in more than one sheet"
          table={[["Player", "Sheets"], ...returning.map((r) => [r.name, [...r.in].map((s) => series[s].name).join(", ")])]}>
          {returning.length ? (
            <ul className="cmp-returning">
              {returning.map((r) => (
                <li key={r.name}>
                  <span>{r.name}</span>
                  <span className="cmp-in">{[...r.in].map((s) => <Swatch key={s} series={series[s].k} label={series[s].name} />)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No player appears in more than one sheet.</p>}
        </Card>
      </div>
      {tipEl}
    </div>
  );
}
