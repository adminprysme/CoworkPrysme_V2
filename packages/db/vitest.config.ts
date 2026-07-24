import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Integration suites each spin a MongoMemoryReplSet — limit parallelism to
    // avoid flaky 5s timeouts under CPU/IO contention.
    fileParallelism: true,
    maxWorkers: 4,
    testTimeout: 15_000,
  },
});
