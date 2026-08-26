import type { FastifyInstance, FastifyRequest } from "fastify"
import os from "node:os"
import { execFileSync } from "node:child_process"
import { env } from "../config/env.js"
import { trackEvent } from "./tracker.js"

function diskUsage() {
    try {
        const [, values] = execFileSync("df", ["-kP", "."], { encoding: "utf8" }).trim().split("\n")
        const columns = values.trim().split(/\s+/)
        const totalKb = Number(columns[1])
        const usedKb = Number(columns[2])
        return { total_mb: Math.round(totalKb / 1024), used_mb: Math.round(usedKb / 1024), percentage: Math.round((usedKb / totalKb) * 10_000) / 100 }
    } catch {
        return undefined
    }
}

export function startMetrics(fastify: FastifyInstance) {
    const starts = new WeakMap<FastifyRequest, number>()
    const durations: number[] = []
    fastify.addHook("onRequest", async (request) => starts.set(request, performance.now()))
    fastify.addHook("onResponse", async (request) => {
        const start = starts.get(request)
        if (start && request.routeOptions.url !== "/health") durations.push(performance.now() - start)
        if (durations.length > 500) durations.splice(0, durations.length - 500)
    })

    const report = () => {
        const memory = process.memoryUsage()
        const sorted = [...durations].sort((a, b) => a - b)
        const percentile = (n: number) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * n) - 1)]!) : 0)
        trackEvent("backend_metrics", "hiveborn-backend", {
            memory_heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
            memory_rss_mb: Math.round(memory.rss / 1024 / 1024),
            memory_system_used_mb: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
            memory_system_total_mb: Math.round(os.totalmem() / 1024 / 1024),
            cpu_load_1m: os.loadavg()[0],
            cpu_cores: os.cpus().length,
            storage: diskUsage(),
            response_p50_ms: percentile(0.5),
            response_p90_ms: percentile(0.9),
            response_p99_ms: percentile(0.99),
            request_count: durations.length,
        })
    }
    const timer = setInterval(report, 10 * 60_000)
    timer.unref()
    if (env.NODE_ENV !== "test") fastify.log.info("PostHog backend resource metrics enabled (10 minute interval)")
}
