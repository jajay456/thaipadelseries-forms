import { useEffect, useState } from "react";
import { store } from "./sheet.js";
import useMediaQuery from "./useMediaQuery.js";

export const THEME_KEY = "sheetDashboard.theme";
const BG = { light: "#f4f5f8", dark: "#0c0f14" };

// ธีมที่ผู้ใช้เลือก ("light" | "dark") หรือ null = ตามเครื่อง
// index.html ตั้ง data-theme ไว้ก่อนแล้ว (กันจอกะพริบตอนโหลด) — ตรงนี้ดูแลตอนกดสลับ
export default function useTheme() {
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [chosen, setChosen] = useState(() => {
    const t = store.get(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  });
  const theme = chosen || (systemDark ? "dark" : "light");

  useEffect(() => {
    const root = document.documentElement;
    if (chosen) root.dataset.theme = chosen;
    else delete root.dataset.theme;
    // แถบสีของเบราว์เซอร์บนมือถือให้ตรงกับธีม
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", BG[theme]));
  }, [chosen, theme]);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setChosen(next);
    store.set(THEME_KEY, next);
  };

  return [theme, toggle];
}
