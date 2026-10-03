import { describe, expect, it } from "vitest"
import { parseStageConnection } from "./stageConnection"

describe("Stage native handoff", () => {
    const state = "a".repeat(64)
    const query = (redirectUri: string, nonce = state) => new URLSearchParams({ redirect_uri: redirectUri, state: nonce }).toString()
    it("accepts only the native loopback callback with a strong nonce", () => {
        expect(parseStageConnection(query("http://127.0.0.1:43822/hiveborn/callback"), 10)).toEqual({
            redirectUri: "http://127.0.0.1:43822/hiveborn/callback",
            state,
            expiresAt: 180010,
        })
        for (const target of [
            "https://attacker.test/hiveborn/callback",
            "http://localhost:43822/hiveborn/callback",
            "http://127.0.0.1:80/hiveborn/callback",
            "http://127.0.0.1:43822/other",
            "http://user:secret@127.0.0.1:43822/hiveborn/callback",
            "http://127.0.0.1:43822/hiveborn/callback?next=attacker",
            "http://127.0.0.1:43822/hiveborn/callback#token",
        ])
            expect(parseStageConnection(query(target))).toBeNull()
        expect(parseStageConnection(query("http://127.0.0.1:43822/hiveborn/callback", "short"))).toBeNull()
    })
})
