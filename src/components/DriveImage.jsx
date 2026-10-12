import { useState } from "react";

// รูปจาก Google Drive: โหลดจาก lh3.googleusercontent.com โดยไม่ส่ง cookie/referrer
// (เบราว์เซอร์ที่ล็อกอิน Google อยู่ — โดยเฉพาะหลายบัญชี — มักโหลด drive.google.com/thumbnail ไม่ขึ้น)
// ถ้าไม่ได้ ลอง drive.google.com/thumbnail อีกรอบ แล้วค่อยแสดง fallback
const sources = (id, w) => [
  { src: `https://lh3.googleusercontent.com/d/${id}=w${w}`, anon: true },
  { src: `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`, anon: false },
];

export default function DriveImage({ id, width = 600, fallback = null, ...props }) {
  const [attempt, setAttempt] = useState(0);
  const list = sources(id, width);
  if (attempt >= list.length) return fallback;
  const { src, anon } = list[attempt];
  return (
    <img key={src} src={src} alt="" loading="lazy" referrerPolicy="no-referrer"
      crossOrigin={anon ? "anonymous" : undefined}
      onError={() => setAttempt((a) => a + 1)} {...props} />
  );
}
