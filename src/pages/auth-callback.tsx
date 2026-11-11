import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { api, tokenStorage } from "@/lib/api"
import { useAppAuth } from "@/App"
import { readStageConnection } from "@/lib/stageConnection"
import { HeartSigil } from "@/components/ui/sigil"

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
        <main className="handoff-page">
            <div className="flex flex-col items-center gap-5 text-center" aria-live="polite">
                <span className="handoff-seal handoff-seal-lg" data-tone="heart" data-error={error ? "" : undefined} aria-hidden="true">
                    <HeartSigil className={error ? "size-9" : "hb-heartbeat size-9"} />
                </span>
                <div className="space-y-2">
                    <h1 className="title-display">{error ? "Sign-in didn’t finish" : "Signing you in…"}</h1>
                    {error ? (
                        <p role="alert" className="max-w-sm text-sm text-muted-foreground">
                            {error}
                        </p>
                    ) : null}
                </div>
                {error && (
                    <a className="handoff-back" href="/">
                        <ArrowLeft className="size-4" /> Return to Hiveborn
                    </a>
                )}
            </div>
        </main>
    )
}
