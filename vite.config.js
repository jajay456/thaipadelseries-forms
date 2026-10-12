import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" ให้ไฟล์ใน dist/ เปิดจากโฟลเดอร์ย่อยหรือ static host ใดก็ได้
export default defineConfig({ plugins: [react()], base: "./" });
