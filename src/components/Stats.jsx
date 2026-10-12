import { fmt, num } from "../lib/sheet.js";

export default function Stats({ data, rows }) {
  const { headers, meta } = data;
  const stats = [["Registrations", fmt(rows.length)]];
  if (meta.amount >= 0) stats.push([
    "Total paid" + (/thb/i.test(headers[meta.amount]) ? " (THB)" : ""),
    fmt(rows.reduce((t, r) => t + num(r[meta.amount]), 0)),
  ]);
  if (meta.nation >= 0) stats.push(["Nationalities", fmt(new Set(rows.map((r) => r[meta.nation].toLowerCase()).filter(Boolean)).size)]);
  if (meta.cats.length) stats.push(["Category entries", fmt(rows.reduce((t, r) => t + meta.cats.filter((i) => r[i]).length, 0))]);

  return (
    <div className="stats">
      {stats.map(([k, v]) => <div key={k} className="stat"><div className="k">{k}</div><div className="v">{v}</div></div>)}
    </div>
  );
}
