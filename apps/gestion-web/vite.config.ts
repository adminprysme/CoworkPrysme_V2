import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT ?? 3002),
  },
  preview: {
    port: Number(process.env.PORT ?? 3002),
  },
});
