import { useState } from "react"
import { AppWindow, ArrowLeft, Check, LogIn, RotateCw } from "lucide-react"
import { useAppAuth } from "@/App"
import { api, tokenStorage } from "@/lib/api"
import { clearStageConnection, parseStageConnection, readStageConnection, saveStageConnection } from "@/lib/stageConnection"
import { Button } from "@/components/ui/button"
import { HeartSigil } from "@/components/ui/sigil"

/** Hiveborn ⟷ Stage: two seals joined by a thread that pulses while connecting and closes once linked. */
function ConnectionMark({ state }: { state: "idle" | "busy" | "connected" }) {
    return (
        <div className="handoff-mark" data-state={state} aria-hidden="true">
            <span className="handoff-seal" data-tone="heart">
                <HeartSigil className="size-7" />
            </span>
            <span className="handoff-thread">
                <span />
                <span />
                <span />
                {state === "connected" && (
                    <span className="handoff-check">
                        <Check className="size-3.5" strokeWidth={3} />
                    </span>
                )}
            </span>
            <span className="handoff-seal">
                <AppWindow className="size-6" />
            </span>
        </div>
    )
}

export function StageConnectPage() {
    const auth = useAppAuth()
    const [connection] = useState(() => {
        if (window.location.search) {
            const parsed = parseStageConnection(window.location.search)
            clearStageConnection()
            if (parsed) saveStageConnection(parsed)
            window.history.replaceState(window.history.state, "", "/stage-connect")
            return parsed
        }
        return readStageConnection()
    })
    const [busy, setBusy] = useState(false)
    const [connected, setConnected] = useState(false)
    const [error, setError] = useState<string | null>(null)
    async function connect() {
        setBusy(true)
        setError(null)
        try {
            const current = readStageConnection()
            if (!current) throw new Error("This connection request has expired. Start sign-in again in Stage.")
            const generation = tokenStorage.getGeneration()
            const user = await api.me() // Validate the session and apply a rotated token before transfer.
            if (generation !== tokenStorage.getGeneration() || user.id !== auth.user?.id)
                throw new Error("Your account changed. Reload this page to connect the current account.")
            const token = tokenStorage.get()
            if (!token) throw new Error("Sign in with WorkOS again, then retry.")
            const response = await fetch(current.redirectUri, {
                method: "POST",
                credentials: "omit",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: current.state, token }),
                signal: AbortSignal.timeout(15_000),
            })
            if (!response.ok) throw new Error("Stage could not connect. Start a new connection from Stage.")
            clearStageConnection()
            setConnected(true)
        } catch (reason) {
            setError(
                reason instanceof Error && !["TypeError", "TimeoutError"].includes(reason.name)
                    ? reason.message
                    : "Could not reach Stage. Keep the desktop app open, allow local network access if prompted, and retry.",
            )
        } finally {
            setBusy(false)
        }
    }
    function login() {
        if (!connection || !readStageConnection()) {
            setError("This connection request has expired. Start sign-in again in Stage.")
            return
        }
        api.login()
    }
    return (
        <main className="handoff-page">
            <p className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
                <HeartSigil className="size-5 text-heart" /> Hiveborn
            </p>
            <section className="panel-plate flex w-full max-w-md flex-col gap-6 px-6 py-8 sm:px-8" aria-live="polite">
                <ConnectionMark state={connected ? "connected" : busy ? "busy" : "idle"} />
                <div className="text-center">
                    <h1 className="title-display">{connected ? "Connected to Stage" : "Connect Hiveborn to Stage"}</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {connected
                            ? "Return to Stage to choose your characters or a shared play group."
                            : "Stage can read your account’s characters and shared play groups, and keep its character cards up to date."}
                    </p>
                </div>
                {!connected && !connection ? (
                    <p role="alert" className="handoff-alert">
                        Open Settings → Integrations in Stage and choose Sign in with WorkOS to start a connection.
                    </p>
                ) : (
                    !connected && (
                        <div className="flex flex-col gap-3">
                            {auth.loading ? (
                                <>
                                    <p role="status" className="text-center text-sm text-muted-foreground">
                                        Checking your account…
                                    </p>
                                    <div className="h-10 rounded-md bg-foreground/8" aria-hidden="true" />
                                </>
                            ) : auth.user ? (
                                <>
                                    <p className="handoff-account">
                                        <span className="text-muted-foreground">Connect as</span>
                                        <strong className="truncate">{auth.user.nickname || auth.user.email}</strong>
                                    </p>
                                    <Button size="lg" className="w-full" disabled={busy} onClick={() => void connect()}>
                                        {error && !busy ? <RotateCw /> : null}
                                        {busy ? "Connecting…" : error ? "Retry connection" : "Connect to Stage"}
                                    </Button>
                                </>
                            ) : (
                                <Button size="lg" className="w-full" onClick={login}>
                                    <LogIn /> Sign in with WorkOS
                                </Button>
                            )}
                            {error && (
                                <p role="alert" className="handoff-alert">
                                    {error}
                                </p>
                            )}
                        </div>
                    )
                )}
            </section>
            <a className="handoff-back" href="/" onClick={clearStageConnection}>
                <ArrowLeft className="size-4" /> Return to Hiveborn
            </a>
        </main>
    )
}
