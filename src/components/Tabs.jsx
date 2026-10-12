import Icon from "./Icon.jsx";

// onDelete มีเฉพาะตอนเป็นแอดมิน
export default function Tabs({ sheets, active, onSelect, onDelete }) {
  return (
    <div className="tabs">
      {sheets.map((s, i) => (
        <div key={i} className={`tab ${i === active ? "active" : ""}`} onClick={() => onSelect(i)}>
          {s.name}
          {onDelete && (
            <span className="x" title="Remove for everyone" onClick={(e) => { e.stopPropagation(); onDelete(i); }}><Icon name="x" /></span>
          )}
        </div>
      ))}
    </div>
  );
}
