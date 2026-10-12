// เครื่องหมาย ✓ ข้างชื่อผู้เล่นที่แอดมินยืนยันแล้ว
export default function Confirmed({ person }) {
  if (!person?.confirmed) return null;
  return (
    <span className="confirmed" title="Confirmed by admin" aria-label="Confirmed">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </span>
  );
}
