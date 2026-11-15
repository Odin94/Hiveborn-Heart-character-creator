import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { api, tokenStorage } from "@/lib/api"
import { useAppAuth } from "@/App"
import { readStageConnection } from "@/lib/stageConnection"

export function AuthCallbackPage() {
    const { refresh } = useAppAuth()
    const navigate = useNavigate()
    const [error, setError] = useState<string | null>(null)
    const started = useRef(false)
    useEffect(() => {
        if (started.current) return
        started.current = true
        const code = new URLSearchParams(window.location.search).get("code")
        if (!code) {
            setError("The sign-in response did not include an authorization code.")
            return
        }
        void api
            .callback(code)
            .then(async (response) => {
                tokenStorage.set(response.token)
                await refresh()
                await navigate({ to: readStageConnection() ? "/stage-connect" : "/", replace: true })
            })
            .catch((reason: Error) => setError(reason.message))
    }, [refresh, navigate])
    return (
        <main className="grid min-h-screen place-items-center bg-background p-6">
            <div className="text-center">
                <h1 className="text-2xl font-bold">Signing you in…</h1>
                {error && <p className="mt-3 text-destructive">{error}</p>}
            </div>
        </main>
    )
}
