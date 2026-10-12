import { driveId } from "../lib/sheet.js";
import DriveImage from "./DriveImage.jsx";

const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const initials = (s) => s.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

// รูปจาก Google Drive ถ้ามี ไม่งั้นใช้ตัวอักษรย่อบนพื้นสีที่คำนวณจากชื่อ
export default function Avatar({ name = "", photo, size = 36 }) {
  const id = photo && driveId(photo);
  return (
    <span className="avatar" style={{ "--h": hue(name), "--size": `${size}px` }} title={name}>
      {id ? <DriveImage key={id} id={id} width={size * 3} fallback={initials(name)} /> : initials(name)}
    </span>
  );
}
