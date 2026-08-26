import "./App.css"
import CharacterSheet from "./hiveborn/character_sheet/character_sheet"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { JSONDownloadButton, JSONUploadButton, PDFDownloadButton, ResetButton } from "./hiveborn/character_sheet/components/character_buttons"
import { Toaster } from "@/components/ui/sonner"
import { useUserUuid } from "@/lib/analytics"
import { createContext, useContext, useEffect, useState } from "react"
import { usePostHog } from "posthog-js/react"
import CookieConsent from "./components/cookie-consent"
import DiceRoller from "./hiveborn/character_sheet/components/dice_roller/dice_roller"
import ThemeToggle from "./components/theme-toggle"
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { api, tokenStorage } from "./lib/api"
import { useAuth } from "./hooks/useAuth"
import { useCloudCharacterSync } from "./hooks/useCloudCharacterSync"
import GroupOverview from "./hiveborn/play_mode/group_overview"
import { toast } from "sonner"
import { Outlet, useNavigate } from "@tanstack/react-router"

type AuthState = ReturnType<typeof useAuth>
const AuthContext = createContext<AuthState | null>(null)

export const useAppAuth = () => {
    const auth = useContext(AuthContext)
    if (!auth) throw new Error("useAppAuth must be used inside the app route")
    return auth
}

function App() {
    const posthog = usePostHog()
    const { userUuid, setUserUuid } = useUserUuid()
    const auth = useAuth()
    useEffect(() => {
        if (!userUuid) {
            setUserUuid()
        }
    }, [userUuid, setUserUuid])

    useCloudCharacterSync(auth.user?.id)

    useEffect(() => {
        // Keep authenticated account activity on the WorkOS user identity.
        // Previously this effect ran after useAuth identified the account and
        // replaced it with an anonymous browser UUID.
        const distinctId = auth.user?.id ?? userUuid
        if (!distinctId) return
        posthog.identify(distinctId)
        posthog.capture("Pageview: Hiveborn", { userUuid, authenticated: Boolean(auth.user) })
    }, [auth.user, posthog, userUuid])

    return (
        <AuthContext.Provider value={auth}>
            <Toaster closeButton />
            <Outlet />
        </AuthContext.Provider>
    )
}

export function CharacterSheetPage() {
    const auth = useAppAuth()
    const navigate = useNavigate()

    return (
        <div className="relative min-h-screen bg-background pb-28 sm:pb-0">
            <CookieConsent variant="small" />
            <Dialog>
                <div className="container relative mx-auto max-w-screen-xl text-foreground lg:px-20">
                    <nav className="relative z-10 mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1 px-2 text-sm lg:absolute lg:top-2 lg:left-24 lg:mb-0 lg:flex-nowrap lg:justify-start lg:px-0">
                        <a href="https://odin-matthias.de/" target="_blank" className="underline">
                            /Odin's Site/
                        </a>
                        <a href="https://github.com/Odin94/Hiveborn-Heart-character-creator" target="_blank" className="underline">
                            /Source Code/
                        </a>
                        <a href="https://rowanrookanddecard.com/product-category/game-systems/resistance/heart/" target="_blank" className="underline">
                            /Heart/
                        </a>

                        <DialogTrigger className="link-like underline">/Copyright/</DialogTrigger>
                        {auth.isAuthenticated ? (
                            <>
                                <Button variant="link" className="h-auto p-0 text-sm" onClick={() => void navigate({ to: "/play" })}>
                                    /Play Mode/
                                </Button>
                                <AccountDialog nickname={auth.user?.nickname ?? ""} onSave={auth.updateProfile} onLogout={auth.logout} />
                            </>
                        ) : (
                            <>
                                <Button variant="link" className="h-auto p-0 text-sm" onClick={auth.login}>
                                    /Sign in/
                                </Button>
                                {window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? (
                                    <Button
                                        variant="link"
                                        className="h-auto p-0 text-sm"
                                        onClick={() => void auth.devLogin().catch((error) => toast.error(error.message))}
                                    >
                                        /Local test sign-in/
                                    </Button>
                                ) : null}
                            </>
                        )}
                        <div className="lg:hidden">
                            <ThemeToggle />
                        </div>
                    </nav>
                    <CharacterSheet />
                </div>
                <div className="hidden lg:absolute lg:top-1 lg:right-5 lg:block">
                    <ThemeToggle />
                </div>
                <DiceRoller />

                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Copyright notice</DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm">
                            <p>
                                <em>Hiveborn</em> is an independent production by <em>Odin</em> and is not affiliated with Rowan, Rook and Decard. It is
                                published under the RR&D Community License. Heart is copyright Rowan, Rook and Decard.
                            </p>
                            <p className="mt-5">
                                You can find out more and support these games at{" "}
                                <a href="https://rowanrookanddecard.com" target="_blank">
                                    rowanrookanddecard.com
                                </a>
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>

            <div className="container mx-auto max-w-screen-xl lg:px-20">
                <div className="mt-0 flex flex-wrap justify-center gap-2 px-2 pb-4 lg:h-10 lg:justify-start lg:gap-8 lg:pl-4 lg:pb-0">
                    <PDFDownloadButton />
                    <JSONDownloadButton />
                    <JSONUploadButton />
                    <ResetButton />

                    {/* TODOdin: Add a button that opens a history pane that keeps character-states from the past (in case you accidentally overwrite) */}
                </div>
            </div>
        </div>
    )
}

export function AuthCallbackPage() {
    const auth = useAppAuth()
    const navigate = useNavigate()
    const [error, setError] = useState<string | null>(null)
    useEffect(() => {
        const code = new URLSearchParams(window.location.search).get("code")
        if (!code) {
            setError("The sign-in response did not include an authorization code.")
            return
        }
        void api
            .callback(code)
            .then(async (response) => {
                tokenStorage.set(response.token)
                await auth.refresh()
                await navigate({ to: "/", replace: true })
            })
            .catch((reason: Error) => setError(reason.message))
    }, [auth, navigate])
    return (
        <main className="grid min-h-screen place-items-center bg-background p-6">
            <div className="text-center">
                <h1 className="text-2xl font-bold">Signing you in…</h1>
                {error && <p className="mt-3 text-destructive">{error}</p>}
            </div>
        </main>
    )
}

export function PlayModePage({ groupId }: { groupId?: string }) {
    const auth = useAppAuth()
    const navigate = useNavigate()
    if (!auth.user) {
        return (
            <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
                <div>
                    <h1 className="text-2xl font-bold">Sign in to enter Play Mode</h1>
                    <p className="mt-2 text-muted-foreground">Play groups and shared sheets require an account.</p>
                    <Button className="mt-4" onClick={() => void navigate({ to: "/" })}>
                        Back to character sheets
                    </Button>
                </div>
            </main>
        )
    }
    return (
        <GroupOverview
            user={auth.user}
            selectedGroupId={groupId}
            onClose={() => void navigate({ to: "/" })}
            onSelectGroup={(id) => void navigate({ to: "/play/$groupId", params: { groupId: id } })}
        />
    )
}

function AccountDialog({ nickname, onSave, onLogout }: { nickname: string; onSave: (nickname: string) => Promise<unknown>; onLogout: () => Promise<void> }) {
    const [value, setValue] = useState(nickname)
    const [open, setOpen] = useState(false)
    useEffect(() => setValue(nickname), [nickname])
    const save = async () => {
        try {
            await onSave(value)
            toast.success("Nickname saved")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save nickname")
        }
    }
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="link" className="h-auto p-0 text-sm">
                    /Account/
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Play account</DialogTitle>
                    <DialogDescription>Your globally unique nickname lets other players invite you to play groups.</DialogDescription>
                </DialogHeader>
                <label className="space-y-2 text-sm font-medium">
                    Nickname
                    <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="e.g. HoneyWitch" className="text-base" />
                </label>
                <div className="flex justify-between gap-2">
                    <Button variant="destructive" onClick={() => void onLogout()}>
                        Sign out
                    </Button>
                    <Button disabled={!value.trim()} onClick={() => void save()}>
                        Save nickname
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default App
