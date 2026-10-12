import { useState } from "react";
import { CATEGORIES, PRICES, fmt } from "../lib/sheet.js";

// ---------- data ----------

// Google Forms timestamp: "10/8/2026 10:36:05" (M/D/YYYY) → "2026-10-08"
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayOf = (v) => {
  const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(v);
  return isNaN(d) ? null : isoLocal(d);
};
const dayLabel = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// ยอดที่ควรจ่ายตามราคา (ตามจำนวนประเภท)
const expectedOf = (p) => PRICES[p.cats.length] ?? 0;
// ยอดที่ยังขาดตามราคา: ราคาตามจำนวนประเภท − ราคาของประเภทที่จ่ายแล้ว
const owed = (p) => {
  const n = p.cats.length, paid = p.cats.filter((c) => c.paid).length;
  if (!n || p.status === "paid") return 0;
  return (PRICES[n] ?? 0) - (paid ? PRICES[paid] ?? 0 : 0);
};

function useChartData(people, meta) {
  const byCat = {};
  CATEGORIES.forEach((c) => (byCat[c] = { paid: 0, unpaid: 0 }));
  people.forEach((p) => p.cats.forEach((c) => {
    if (!c.cat) return;
    byCat[c.cat] ||= { paid: 0, unpaid: 0 };
    byCat[c.cat][c.paid ? "paid" : "unpaid"]++;
  }));

  const days = {};
  people.forEach((p) => {
    const d = p.row && meta.time >= 0 ? dayOf(p.row[meta.time]) : null;
    if (d) days[d] = (days[d] || 0) + 1;
  });
  // เติมวันที่ไม่มีคนสมัครให้เป็น 0 เพื่อให้แกนเวลาต่อเนื่อง
  const dayList = Object.keys(days).sort();
  const timeline = [];
  if (dayList.length) {
    for (let d = new Date(dayList[0] + "T00:00:00"), end = new Date(dayList.at(-1) + "T00:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = isoLocal(d);
      timeline.push([iso, days[iso] || 0]);
    }
  }

  const nat = {};
  people.forEach((p) => {
    const v = p.row && meta.nation >= 0 ? p.row[meta.nation].trim() : "";
    if (v) { const k = v[0].toUpperCase() + v.slice(1).toLowerCase(); nat[k] = (nat[k] || 0) + 1; }
  });
  let nations = Object.entries(nat).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (nations.length > 8) nations = [...nations.slice(0, 7), ["Other", nations.slice(7).reduce((t, [, n]) => t + n, 0)]];

  return {
    cats: Object.entries(byCat),
    timeline,
    nations,
    players: people.length,
    paidPlayers: people.filter((p) => p.status === "paid").length,
    outstanding: people.reduce((t, p) => t + owed(p), 0),
    expected: people.reduce((t, p) => t + expectedOf(p), 0),
    collected: people.reduce((t, p) => t + (p.amount || 0), 0), // ยอดที่กรอกในฟอร์ม
  };
}

// ---------- pieces ----------

// tooltip ตัวเดียวทั้งหน้า — ค่านำ ชื่อตาม · แสดงทั้งตอน hover และ focus (คีย์บอร์ด)
function useTip() {
  const [tip, setTip] = useState(null);
  const bind = (lines) => ({
    tabIndex: 0,
    onPointerMove: (e) => setTip({ x: e.clientX, y: e.clientY, lines }),
    onPointerLeave: () => setTip(null),
    onFocus: (e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ x: r.left + r.width / 2, y: r.top, lines }); },
    onBlur: () => setTip(null),
  });
  const el = tip && (
    <div className="viz-tip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.lines.map(([value, label, series], i) => (
        <div key={i} className="viz-tip-row">
          {series && <i className={`viz-key ${series}`} />}<b>{value}</b><span>{label}</span>
        </div>
      ))}
    </div>
  );
  return [bind, el];
}

function Card({ title, sub, legend, table, children }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="viz-card">
      <div className="viz-head">
        <div>
          <h3>{title}</h3>
          {sub && <p className="muted">{sub}</p>}
        </div>
        <button className="link-btn muted" onClick={() => setShowTable(!showTable)}>{showTable ? "Chart" : "Table"}</button>
      </div>
      {legend && !showTable && <div className="viz-legend">{legend}</div>}
      {showTable ? (
        <table className="viz-table">
          <thead><tr>{table[0].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{table.slice(1).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={j ? "num" : ""}>{v}</td>)}</tr>)}</tbody>
        </table>
      ) : children}
    </section>
  );
}

const Swatch = ({ series, label }) => <span className="viz-legend-item"><i className={`viz-swatch ${series}`} />{label}</span>;

// แท่งแนวนอน: ป้ายซ้าย · แท่ง (เริ่มจากเส้นฐานเดียว) · ค่าที่ปลายแท่ง
function HBars({ rows, max, bind }) {
  return (
    <div className="hbars">
      {rows.map(({ label, segs, value, tip }) => (
        <div key={label} className="hbar-row" {...bind(tip)} aria-label={`${label}: ${value}`}>
          <span className="hbar-label">{label}</span>
          <span className="hbar-track">
            {segs.filter((s) => s.n > 0).map((s, i) => (
              <span key={i} className={`hbar-seg ${s.series}`} style={{ width: `${(s.n / max) * 100}%` }} />
            ))}
            <span className="hbar-value">{value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const niceMax = (v) => (v <= 5 ? Math.max(v, 1) : Math.ceil(v / 5) * 5);

// ---------- view ----------

export default function Charts({ people, meta }) {
  const d = useChartData(people, meta);
  const [bind, tipEl] = useTip();
  const catMax = Math.max(1, ...d.cats.map(([, v]) => v.paid + v.unpaid));
  const natMax = Math.max(1, ...d.nations.map(([, n]) => n));
  const dayMax = niceMax(Math.max(0, ...d.timeline.map(([, n]) => n)));
  // จ่ายเกิน = เงินที่เข้ามา − มูลค่าที่จ่ายครบแล้วตามราคา (เช่น จ่ายซ้ำ)
  const overpaid = Math.max(0, d.collected - (d.expected - d.outstanding));
  const peakDay = d.timeline.reduce((best, x) => (x[1] > (best?.[1] ?? -1) ? x : best), null);

  return (
    <div className="viz">
      <div className="viz-kpis">
        <div className="viz-kpi" title="Players whose categories are all paid">
          <span className="muted">Paid players</span>
          <b>{fmt(d.paidPlayers)}<small> / {fmt(d.players)}</small></b>
          <span className="viz-meter"><span style={{ width: `${d.players ? (d.paidPlayers / d.players) * 100 : 0}%` }} /></span>
        </div>
        <div className="viz-kpi" title={`Price list total for all players (${Object.entries(PRICES).map(([n, v]) => `${n} cat ${fmt(v)}`).join(" · ")})`}>
          <span className="muted">Expected</span><b>{fmt(d.expected)}<small> THB</small></b>
        </div>
        <div className="viz-kpi" title="Sum of the payment amounts entered in the form">
          <span className="muted">Collected</span><b>{fmt(d.collected)}<small> THB</small></b>
        </div>
        <div className="viz-kpi" title="Still owed, by the price list, from players who haven't fully paid">
          <span className="muted">Outstanding</span><b>{fmt(d.outstanding)}<small> THB</small></b>
        </div>
        {overpaid > 0 && (
          <div className="viz-kpi" title="Collected minus the value of players paid in full — usually double payments to refund">
            <span className="muted">Overpaid</span><b>{fmt(overpaid)}<small> THB</small></b>
          </div>
        )}
      </div>

      <div className="viz-grid">
        <Card title="Players per category" sub="Each player counted once per category"
          legend={<><Swatch series="s1" label="Paid" /><Swatch series="s2" label="Unpaid" /></>}
          table={[["Category", "Paid", "Unpaid", "Total"], ...d.cats.map(([c, v]) => [c, v.paid, v.unpaid, v.paid + v.unpaid])]}>
          <HBars max={catMax} bind={bind} rows={d.cats.map(([c, v]) => ({
            label: c,
            segs: [{ n: v.paid, series: "s1" }, { n: v.unpaid, series: "s2" }],
            value: v.paid + v.unpaid,
            tip: [[`${v.paid + v.unpaid}`, c], [v.paid, "Paid", "s1"], [v.unpaid, "Unpaid", "s2"]],
          }))} />
        </Card>

        <Card title="Registrations per day" sub="Form submissions by date"
          table={[["Date", "Registrations"], ...d.timeline.map(([day, n]) => [dayLabel(day), n])]}>
          {d.timeline.length ? (
            <div className="cols">
              <div className="cols-plot">
                {[dayMax, Math.round(dayMax / 2), 0].map((t) => (
                  <span key={t} className="cols-grid" style={{ bottom: `${(t / dayMax) * 100}%` }}><span>{t}</span></span>
                ))}
                <div className="cols-bars">
                  {d.timeline.map(([day, n]) => (
                    <div key={day} className="col" {...bind([[n, dayLabel(day)]])} aria-label={`${dayLabel(day)}: ${n}`}>
                      {n > 0 && <span className="col-bar" style={{ height: `${(n / dayMax) * 100}%` }}>
                        {peakDay?.[0] === day && <span className="col-value">{n}</span>}
                      </span>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="cols-x">
                {d.timeline.map(([day], i) => (
                  <span key={day}>{i === 0 || i === d.timeline.length - 1 || d.timeline.length <= 8 ? dayLabel(day) : ""}</span>
                ))}
              </div>
            </div>
          ) : <p className="muted">No timestamp column found.</p>}
        </Card>

        <Card title="Nationalities" sub="Players who filled in the form"
          table={[["Nationality", "Players"], ...d.nations]}>
          {d.nations.length ? (
            <HBars max={natMax} bind={bind} rows={d.nations.map(([n, c]) => ({
              label: n, segs: [{ n: c, series: "s1" }], value: c, tip: [[c, n]],
            }))} />
          ) : <p className="muted">No nationality column found.</p>}
        </Card>
      </div>
      {tipEl}
    </div>
  );
}
