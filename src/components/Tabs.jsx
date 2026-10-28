import Icon from "./Icon.jsx";

// onEdit / onDelete มีเฉพาะตอนเป็นแอดมิน
export default function Tabs({ sheets, active, onSelect, onEdit, onDelete }) {
  return (
    <div className="tabs">
      {sheets.map((s, i) => (
        <div key={i} className={`tab ${i === active ? "active" : ""}`} onClick={() => onSelect(i)}>
          {s.name}
          {onEdit && (
            <span className="x" title="Edit name / link" onClick={(e) => { e.stopPropagation(); onEdit(i); }}><Icon name="edit" /></span>
          )}
          {onDelete && (
            <span className="x" title="Remove for everyone" onClick={(e) => { e.stopPropagation(); onDelete(i); }}><Icon name="x" /></span>
          )}
        </div>
      ))}
    </div>
  );
}
