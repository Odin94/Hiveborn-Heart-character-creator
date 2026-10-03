import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
const root = fileURLToPath(new URL("../..", import.meta.url))
const baselineRef = process.argv[2] ?? "545bb09"
const temporaryDirectory = mkdtempSync(join(root, ".performance-baseline-"))
try {
    execFileSync("tar", ["-x", "-C", temporaryDirectory], {
        input: execFileSync("git", ["archive", baselineRef, "src"], { cwd: root, maxBuffer: 10 * 1024 * 1024 }),
    })
    const runs = []
    for (let pair = 0; pair < 2; pair++)
        for (const source of pair % 2 ? ["optimized", "baseline"] : ["baseline", "optimized"]) {
            const output = execFileSync(
                "pnpm",
                [
                    "exec",
                    "vitest",
                    "run",
                    "--config",
                    "scripts/performance/vitest.config.ts",
                    "scripts/performance/views.bench.test.tsx",
                    "scripts/performance/reference.bench.test.tsx",
                ],
                {
                    cwd: root,
                    env: { ...process.env, HIVEBORN_BENCHMARK_SOURCE: source === "baseline" ? join(temporaryDirectory, "src") : join(root, "src") },
                    encoding: "utf8",
                    maxBuffer: 5 * 1024 * 1024,
                },
            )
            const results = output
                .split("\n")
                .filter((line) => line.startsWith('{"benchmark":'))
                .map((line) => JSON.parse(line))
            if (results.length !== 8) throw new Error("Missing view benchmark output")
            const backend = execFileSync("pnpm", ["exec", "tsx", "scripts/benchmark-groups.ts", ...(source === "baseline" ? [baselineRef] : [])], {
                cwd: join(root, "backend"),
                encoding: "utf8",
            })
                .split("\n")
                .find((line) => line.startsWith('{"benchmark":'))
            runs.push({ pair, source, results, backend: JSON.parse(backend) })
        }
    console.log(
        JSON.stringify(
            {
                baselineRef,
                optimizedRef: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
                workingTree: execFileSync("git", ["diff", "--stat"], { cwd: root, encoding: "utf8" }).trim(),
                node: process.version,
                platform: process.platform,
                architecture: process.arch,
                runs,
            },
            null,
            2,
        ),
    )
} finally {
    rmSync(temporaryDirectory, { recursive: true })
}
