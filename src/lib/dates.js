const isoLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function dateDay(value) {
  const text = String(value ?? "").trim();
  const slashDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashDate) {
    const [, month, day, year] = slashDate;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
    return isoLocal(date);
  }

  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : isoLocal(date);
}

export function formatDateDay(day) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// เวลาสมัครเป็นมิลลิวินาที (ใช้เรียงลำดับ) · รองรับ "M/D/YYYY H:MM:SS" จาก Google Forms
export function dateTime(value) {
  const text = String(value ?? "").trim();
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (slash) {
    const [, month, day, year, h = 0, m = 0, s = 0] = slash;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(h), Number(m), Number(s)).getTime();
  }
  const time = new Date(text).getTime();
  return Number.isNaN(time) ? null : time;
}
