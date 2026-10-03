import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
    esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": process.env.HIVEBORN_BENCHMARK_SOURCE ?? fileURLToPath(new URL("../../src", import.meta.url)) } },
    test: { environment: "jsdom", include: ["scripts/performance/*.bench.test.tsx"], fileParallelism: false },
})
