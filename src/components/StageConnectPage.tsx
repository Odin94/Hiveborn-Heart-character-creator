import { useState } from "react"
import { Heart, ArrowLeft } from "lucide-react"
import { useAppAuth } from "@/App"
import { api, tokenStorage } from "@/lib/api"
import { clearStageConnection, parseStageConnection, readStageConnection, saveStageConnection } from "@/lib/stageConnection"
import { Button } from "@/components/ui/button"

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
        <main className="grid min-h-dvh place-items-center bg-background px-5 py-10 text-foreground">
            <section className="w-full max-w-md space-y-5 rounded-xl border border-border bg-card p-6 shadow-lg">
                <Heart className="size-7 text-primary" />
                <div>
                    <h1 className="text-2xl font-semibold">{connected ? "Connected to Stage" : "Connect Hiveborn to Stage"}</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {connected
                            ? "Return to Stage to choose your characters or a shared play group."
                            : "Stage can read your account’s characters and shared play groups, and keep its character cards up to date."}
                    </p>
                </div>
                {!connected && !connection ? (
                    <p role="alert" className="text-sm text-destructive">
                        Open Settings → Integrations in Stage and choose Sign in with WorkOS to start a connection.
                    </p>
                ) : (
                    !connected && (
                        <>
                            {auth.loading ? (
                                <p role="status" className="text-sm text-muted-foreground">
                                    Checking your account…
                                </p>
                            ) : auth.user ? (
                                <>
                                    <p className="text-sm">
                                        Connect as <strong>{auth.user.nickname || auth.user.email}</strong>
                                    </p>
                                    <Button className="cursor-pointer" disabled={busy} onClick={() => void connect()}>
                                        {busy ? "Connecting…" : error ? "Retry connection" : "Connect to Stage"}
                                    </Button>
                                </>
                            ) : (
                                <Button className="cursor-pointer" onClick={login}>
                                    Sign in with WorkOS
                                </Button>
                            )}
                            {error && (
                                <p role="alert" className="text-sm text-destructive">
                                    {error}
                                </p>
                            )}
                        </>
                    )
                )}
                <a
                    className="flex w-fit items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground"
                    href="/"
                    onClick={clearStageConnection}
                >
                    <ArrowLeft className="size-4" /> Return to Hiveborn
                </a>
            </section>
        </main>
    )
}
