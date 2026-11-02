import { useEffect, useState } from "react";
import { store } from "./sheet.js";

export const THEME_KEY = "sheetDashboard.theme";
const BG = { light: "#f1f1ef", dark: "#0b0b0c" };

// ธีมที่ผู้ใช้เลือก ("light" | "dark") · ยังไม่เลือก = มืด (ธีมหลักของ dashboard)
// index.html ตั้ง data-theme ไว้ก่อนแล้ว (กันจอกะพริบตอนโหลด) — ตรงนี้ดูแลตอนกดสลับ
export default function useTheme() {
  const [chosen, setChosen] = useState(() => {
    const t = store.get(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  });
  const theme = chosen || "dark";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // แถบสีของเบราว์เซอร์บนมือถือให้ตรงกับธีม
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", BG[theme]));
  }, [theme]);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setChosen(next);
    store.set(THEME_KEY, next);
  };

  return [theme, toggle];
}
