import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

export default {
  test: {
    include: ["src/**/*.test.ts"],
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
  resolve: {
    alias: {
      "@coworkprysme/db": join(repoRoot, "packages/db/dist/index.js"),
      "@coworkprysme/shared": join(repoRoot, "packages/shared/dist/index.js"),
      "@coworkprysme/shared/server": join(repoRoot, "packages/shared/dist/server.js"),
    },
  },
};
