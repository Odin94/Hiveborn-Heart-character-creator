import type { FastifyInstance } from "fastify"
import { db } from "../db/index.js"
import { captureCharacterHistory } from "../db/characterHistory.js"

export function startCharacterHistory(app: FastifyInstance) {
    const capture = () => {
        try {
            captureCharacterHistory(db)
        } catch (error) {
            app.log.error({ err: error }, "Character history capture failed; will retry in one hour")
        }
    }
    // Restart catch-up captures the current state, never inventing missed snapshots.
    capture()
    const timer = setInterval(capture, 60 * 60 * 1_000)
    timer.unref()
    app.addHook("onClose", async () => clearInterval(timer))
}
