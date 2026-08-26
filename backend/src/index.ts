import Fastify from "fastify"
import cors from "@fastify/cors"
import rateLimit from "@fastify/rate-limit"
import { env } from "./config/env.js"
import { authRoutes } from "./routes/auth.js"
import { characterRoutes } from "./routes/characters.js"
import { groupRoutes } from "./routes/groups.js"
import { startMetrics } from "./utils/metrics.js"
import { shutdownTracking } from "./utils/tracker.js"
import { registerLiveGroupRoutes } from "./websocket/liveGroups.js"

const app = Fastify({ logger: env.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : true, trustProxy: true })
await app.register(cors, {
    origin: (origin, callback) => {
        if (!origin || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) return callback(null, true)
        callback(null, origin === new URL(env.FRONTEND_URL).origin)
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-New-Token"],
})
await app.register(rateLimit, { max: 1_000, timeWindow: "15 minutes" })
await registerLiveGroupRoutes(app)
await app.register(authRoutes)
await app.register(characterRoutes)
await app.register(groupRoutes)
app.get("/health", { config: { rateLimit: false } }, async () => ({ status: "ok", app: "hiveborn" }))
startMetrics(app)

async function stop() {
    await app.close()
    await shutdownTracking()
    process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
await app.listen({ port: env.PORT, host: env.HOST })
