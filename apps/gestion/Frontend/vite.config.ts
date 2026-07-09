import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:8003";

/** Keep SPA routes (/spaces, /spaces/:id) on Vite; proxy JSON API calls only. */
function proxyApiOnly(pathPrefix: string) {
  return {
    target: apiTarget,
    bypass(req: { headers: { accept?: string }; url?: string }) {
      const accept = req.headers.accept ?? "";
      if (accept.includes("text/html")) {
        return req.url;
      }
      if (req.url === pathPrefix || req.url?.startsWith(`${pathPrefix}?`)) {
        return req.url;
      }
    },
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.PORT ?? 3002),
    proxy: {
      "/auth": apiTarget,
      "/admin/permissions": apiTarget,
      "/admin/vitrine-content": apiTarget,
      "/buildings": apiTarget,
      "/spaces": proxyApiOnly("/spaces"),
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
