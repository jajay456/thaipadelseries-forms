import { driveId, fmt, num } from "../lib/sheet.js";
import useMediaQuery from "../lib/useMediaQuery.js";
import Avatar from "./Avatar.jsx";
import DriveImage from "./DriveImage.jsx";

const stop = (e) => e.stopPropagation();

function Cell({ v, i, meta }) {
  if (!v) return <td />;
  if (/^https?:\/\//.test(v)) {
    const id = driveId(v);
    if (i === meta.photo && id) return (
      <td><a href={v} target="_blank" rel="noreferrer" onClick={stop}>
        <DriveImage key={id} id={id} width={100} className="thumb" fallback={<span className="link">Open ↗</span>} />
      </a></td>
    );
    return <td><a className="link" href={v} target="_blank" rel="noreferrer" onClick={stop}>Open ↗</a></td>;
  }
  if (i === meta.amount) return <td className="num">{fmt(num(v))}</td>;
  return <td className={v.length > 40 ? "wrap-text" : ""}>{v}</td>;
}

// บนมือถือแสดงเป็นการ์ด: ชื่อ, สัญชาติ, ประเภทที่ลง, ยอดเงิน
function RowCard({ r, meta, headers, onOpen }) {
  const title = meta.name >= 0 ? r[meta.name] : r.find((v) => v && !/^https?:/.test(v)) || "—";
  const sub = meta.nation >= 0 ? r[meta.nation] : "";
  const cats = meta.cats.map((i) => r[i]).filter(Boolean);
  return (
    <div className="card" onClick={() => onOpen(r)}>
      <Avatar name={title} photo={meta.photo >= 0 ? r[meta.photo] : null} size={40} />
      <div className="card-body">
        <div className="card-title">{title}</div>
        {sub && <div className="muted">{sub}</div>}
        {cats.length > 0 && <div className="card-pills">{cats.map((c, k) => <span key={k} className="pill">{c}</span>)}</div>}
      </div>
      {meta.amount >= 0 && r[meta.amount] && (
        <div className="card-amount">{fmt(num(r[meta.amount]))}{/thb/i.test(headers[meta.amount]) && <div className="muted">THB</div>}</div>
      )}
    </div>
  );
}

export default function DataTable({ data, rows, sortCol, sortDir, onSort, onOpen }) {
  const { headers, meta } = data;
  const mobile = useMediaQuery("(max-width: 640px)");

  if (mobile) return (
    <div className="cards">
      {rows.map((r) => <RowCard key={data.rows.indexOf(r)} r={r} meta={meta} headers={headers} onOpen={onOpen} />)}
    </div>
  );

  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} onClick={() => onSort(i)}>
                {h}{sortCol === i ? (sortDir > 0 ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={data.rows.indexOf(r)} onClick={() => onOpen(r)}>
              {r.map((v, i) => <Cell key={i} v={v} i={i} meta={meta} />)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
