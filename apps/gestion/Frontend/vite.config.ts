import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:8003";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.PORT ?? 3002),
    proxy: {
      "/auth": apiTarget,
      "/admin/permissions": apiTarget,
      "/buildings": apiTarget,
      "/spaces": apiTarget,
      "/media": apiTarget,
      "/health": apiTarget,
      "/nominatim": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ""),
        headers: {
          "User-Agent": "CoworkPrysme-Gestion/1.0 (contact@coworkprysme.fr)",
        },
      },
    },
  },
  preview: {
    host: true,
    port: Number(process.env.PORT ?? 3002),
    proxy: {
      "/nominatim": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ""),
        headers: {
          "User-Agent": "CoworkPrysme-Gestion/1.0 (contact@coworkprysme.fr)",
        },
      },
    },
  },
});
