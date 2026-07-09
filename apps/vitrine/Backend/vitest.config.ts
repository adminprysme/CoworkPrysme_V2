import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

export default {
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@coworkprysme/db": join(repoRoot, "packages/db/dist/index.js"),
      "@coworkprysme/shared": join(repoRoot, "packages/shared/dist/index.js"),
      "@coworkprysme/shared/server": join(repoRoot, "packages/shared/dist/server.js"),
    },
  },
};
