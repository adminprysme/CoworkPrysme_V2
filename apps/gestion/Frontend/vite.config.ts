import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:8003";

/** Keep SPA document requests on Vite; proxy JSON API calls only. */
function proxyApiOnly(pathPrefix: string) {
  return {
    target: apiTarget,
    bypass(req: { headers: { accept?: string }; url?: string }) {
      const accept = req.headers.accept ?? "";
      const url = req.url ?? "";
      const isSpaDocument =
        accept.includes("text/html") &&
        (url === pathPrefix ||
          url.startsWith(`${pathPrefix}?`) ||
          url.startsWith(`${pathPrefix}/`));
      if (isSpaDocument) {
        return url;
      }
      return null;
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
      "/services": proxyApiOnly("/services"),
      "/discount-codes": apiTarget,
      "/billing": proxyApiOnly("/billing"),
      "/planning": proxyApiOnly("/planning"),
      "/integrations": apiTarget,
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
