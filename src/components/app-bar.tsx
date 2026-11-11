import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { toast } from "sonner"
import { BookOpen, Code2, Copyright, ExternalLink, FlaskConical, LogIn, MoreHorizontal, Search, UserRound, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { HeartSigil } from "@/components/ui/sigil"
import { Hint } from "@/components/ui/tooltip"
import ThemeToggle from "@/components/theme-toggle"
import { openQuickNavigator, quickNavigatorShortcut } from "@/components/quick-navigator"
import type { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

type Auth = ReturnType<typeof useAuth>

const isLocalHost = () => window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"

const externalLinks = [
    { href: "https://odin-matthias.de/", label: "Odin's site", icon: ExternalLink },
    { href: "https://github.com/Odin94/Hiveborn-Heart-character-creator", label: "Source code", icon: Code2 },
    { href: "https://rowanrookanddecard.com/product-category/game-systems/resistance/heart/", label: "Heart by Rowan, Rook & Decard", icon: BookOpen },
]

const navLinkClassName = cn(
    "relative inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground",
    "after:absolute after:inset-x-3 after:-bottom-[calc((var(--app-bar-height)-2.25rem)/2)] after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform after:duration-200 after:ease-out",
    "data-[status=active]:text-foreground data-[status=active]:after:scale-x-100",
)

/** Global top bar: brand, page links, quick navigator, theme, account and the "more" menu. */
export function AppBar({ auth }: { auth: Auth }) {
    const [accountOpen, setAccountOpen] = useState(false)
    const [copyrightOpen, setCopyrightOpen] = useState(false)
    const devLogin = () => void auth.devLogin().catch((error: Error) => toast.error(error.message))

    return (
        <>
            <header
                data-slot="app-bar"
                className="sticky top-0 z-(--z-sticky) h-(--app-bar-height) border-b border-border/70 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70"
            >
                <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-1 px-3 sm:gap-2 sm:px-5">
                    <Link
                        to="/"
                        className="group/brand mr-1 flex items-center gap-2 rounded-md py-1 pr-2 text-foreground hover:text-foreground sm:mr-3"
                        aria-label="Hiveborn — character sheets"
                    >
                        <HeartSigil className="size-6 text-heart transition-transform duration-300 ease-out group-hover/brand:scale-110" />
                        <span className="font-display text-[1.4rem] leading-none font-bold tracking-[0.01em]">Hiveborn</span>
                    </Link>

                    <nav aria-label="Main" className="hidden items-center gap-0.5 sm:flex">
                        <Link to="/" activeOptions={{ exact: true }} className={navLinkClassName}>
                            Sheets
                        </Link>
                        {auth.isAuthenticated ? (
                            <Link to="/play" className={navLinkClassName}>
                                Play
                            </Link>
                        ) : null}
                    </nav>

                    <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
                        <button
                            type="button"
                            onClick={openQuickNavigator}
                            className="hidden h-8 w-52 items-center gap-2 rounded-md border border-border bg-sunken/80 pr-1.5 pl-2.5 text-sm text-muted-foreground shadow-xs transition-colors duration-150 ease-out hover:border-border-strong hover:text-foreground md:flex lg:w-64"
                        >
                            <Search className="size-4" aria-hidden="true" />
                            <span className="flex-1 text-left">Jump to…</span>
                            <Kbd>{quickNavigatorShortcut()}</Kbd>
                        </button>
                        <Hint label={`Jump to… (${quickNavigatorShortcut()})`}>
                            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open quick navigator" onClick={openQuickNavigator}>
                                <Search />
                            </Button>
                        </Hint>

                        <ThemeToggle />

                        {auth.isAuthenticated ? (
                            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => setAccountOpen(true)}>
                                <UserRound />
                                <span className="max-w-32 truncate">{auth.user?.nickname || "Account"}</span>
                            </Button>
                        ) : (
                            <>
                                {isLocalHost() ? (
                                    <Button variant="ghost" size="sm" className="hidden text-muted-foreground lg:inline-flex" onClick={devLogin}>
                                        <FlaskConical />
                                        Local test sign-in
                                    </Button>
                                ) : null}
                                <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={auth.login}>
                                    <LogIn />
                                    Sign in
                                </Button>
                            </>
                        )}

                        <DropdownMenu modal={false}>
                            <Hint label="More">
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon-sm" aria-label="More">
                                        <MoreHorizontal />
                                    </Button>
                                </DropdownMenuTrigger>
                            </Hint>
                            <DropdownMenuContent align="end" className="w-60">
                                <div className="sm:hidden">
                                    {auth.isAuthenticated ? (
                                        <>
                                            <DropdownMenuItem asChild>
                                                <Link to="/play">
                                                    <Users /> Play Mode
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setAccountOpen(true)}>
                                                <UserRound /> Account
                                            </DropdownMenuItem>
                                        </>
                                    ) : (
                                        <DropdownMenuItem onSelect={auth.login}>
                                            <LogIn /> Sign in
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                </div>
                                {!auth.isAuthenticated && isLocalHost() ? (
                                    <div className="lg:hidden">
                                        <DropdownMenuItem onSelect={devLogin}>
                                            <FlaskConical /> Local test sign-in
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </div>
                                ) : null}
                                <DropdownMenuLabel>Elsewhere</DropdownMenuLabel>
                                {externalLinks.map(({ href, label, icon: Icon }) => (
                                    <DropdownMenuItem key={href} asChild>
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-normal text-popover-foreground hover:text-popover-foreground"
                                        >
                                            <Icon /> {label}
                                        </a>
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setCopyrightOpen(true)}>
                                    <Copyright /> Copyright notice
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            {auth.isAuthenticated ? (
                <AccountDialog
                    open={accountOpen}
                    onOpenChange={setAccountOpen}
                    nickname={auth.user?.nickname ?? ""}
                    onSave={auth.updateProfile}
                    onLogout={auth.logout}
                />
            ) : null}
            <CopyrightDialog open={copyrightOpen} onOpenChange={setCopyrightOpen} />
        </>
    )
}

function AccountDialog({
    open,
    onOpenChange,
    nickname,
    onSave,
    onLogout,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    nickname: string
    onSave: (nickname: string) => Promise<unknown>
    onLogout: () => Promise<void>
}) {
    const [value, setValue] = useState(nickname)
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Play account</DialogTitle>
                    <DialogDescription>Your globally unique nickname lets other players invite you to play groups.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                    <Label htmlFor="account-nickname">Nickname</Label>
                    <Input
                        id="account-nickname"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && value.trim()) void save()
                        }}
                        placeholder="e.g. HoneyWitch"
                    />
                </div>
                <DialogFooter className="sm:justify-between">
                    <Button variant="ghost" className="text-destructive" onClick={() => void onLogout()}>
                        Sign out
                    </Button>
                    <Button disabled={!value.trim()} onClick={() => void save()}>
                        Save nickname
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function CopyrightDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Copyright notice</DialogTitle>
                    <DialogDescription asChild>
                        <div className="space-y-4 text-sm">
                            <p>
                                <em>Hiveborn</em> is an independent production by <em>Odin</em> and is not affiliated with Rowan, Rook and Decard. It is
                                published under the RR&D Community License. Heart is copyright Rowan, Rook and Decard.
                            </p>
                            <p>
                                You can find out more and support these games at{" "}
                                <a href="https://rowanrookanddecard.com" target="_blank" rel="noreferrer">
                                    rowanrookanddecard.com
                                </a>
                            </p>
                        </div>
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}
