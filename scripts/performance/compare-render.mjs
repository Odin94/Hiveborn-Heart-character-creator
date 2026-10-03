import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const root = fileURLToPath(new URL("../..", import.meta.url))
const baselineRef = process.argv[2] ?? "8a0544fb1baeee61a3dcc7334c4548103328751a"
const temporaryDirectory = mkdtempSync(join(root, ".performance-baseline-"))
try {
    const archive = execFileSync("git", ["archive", baselineRef, "src"], { cwd: root, maxBuffer: 10 * 1024 * 1024 })
    execFileSync("tar", ["-x", "-C", temporaryDirectory], { input: archive })
    const results = {}
    for (const source of ["baseline", "optimized"]) {
        const output = execFileSync(
            "pnpm",
            ["exec", "vitest", "run", "--config", "scripts/performance/vitest.config.ts", "scripts/performance/render.bench.test.tsx"],
            {
                cwd: root,
                env: { ...process.env, HIVEBORN_BENCHMARK_SOURCE: source === "baseline" ? join(temporaryDirectory, "src") : join(root, "src") },
                encoding: "utf8",
                maxBuffer: 5 * 1024 * 1024,
            },
        )
        results[source] = output
            .split("\n")
            .filter((line) => line.startsWith('{"benchmark":'))
            .map((line) => JSON.parse(line))
        if (results[source].length !== 2) throw new Error(`Missing ${source} benchmark output`)
    }
    console.log(
        JSON.stringify(
            {
                baselineRef,
                optimizedRef: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
                node: process.version,
                platform: process.platform,
                architecture: process.arch,
                results,
            },
            null,
            2,
        ),
    )
} finally {
    rmSync(temporaryDirectory, { recursive: true })
}
