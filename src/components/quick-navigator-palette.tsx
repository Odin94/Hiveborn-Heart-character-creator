import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"
import { CornerDownLeft, Dices, FileText, LogIn, MoonStar, Plus, Search, SunMedium, Users } from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { HeartSigil } from "@/components/ui/sigil"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import { useDiceRollerStore } from "@/hiveborn/character_sheet/dice_roller_state"
import type { useAuth } from "@/hooks/useAuth"
import { api, type PlayGroup } from "@/lib/api"
import { useThemeStore } from "@/lib/theme"
import { cn } from "@/lib/utils"

type Item = { id: string; group: string; label: string; hint?: string; keywords?: string; icon: ReactNode; run: () => void }

// Remember play groups across opens so the list doesn't flicker.
let cachedGroups: Pick<PlayGroup, "id" | "name">[] = []

const score = (item: Item, query: string) => {
    if (!query) return 1
    const haystack = `${item.label} ${item.hint ?? ""} ${item.keywords ?? ""} ${item.group}`.toLowerCase()
    const label = item.label.toLowerCase()
    if (label.startsWith(query)) return 3
    if (label.includes(query)) return 2
    return query.split(/\s+/).every((part) => haystack.includes(part)) ? 1 : 0
}

export default function QuickNavigatorPalette({
    auth,
    open,
    onOpenChange,
}: {
    auth: ReturnType<typeof useAuth>
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const navigate = useNavigate()
    const [query, setQuery] = useState("")
    const [active, setActive] = useState(0)
    const [groups, setGroups] = useState(cachedGroups)
    const listRef = useRef<HTMLDivElement>(null)

    // Only mounted while the navigator is in use, so subscribing to the array is cheap.
    const characters = useCharacterStore((state) => state.characters)
    const currentCharacterIndex = useCharacterStore((state) => state.currentCharacterIndex)
    const setCurrentCharacter = useCharacterStore.use.setCurrentCharacter()
    const addCharacter = useCharacterStore.use.addCharacter()
    const setDiceRollerOpen = useDiceRollerStore.use.setOpen()
    const theme = useThemeStore((state) => state.theme)
    const toggleTheme = useThemeStore((state) => state.toggleTheme)

    useEffect(() => {
        if (!open) return
        setQuery("")
        setActive(0)
        if (!auth.isAuthenticated) return
        let cancelled = false
        api.groups()
            .then(({ groups }) => {
                cachedGroups = groups.map(({ id, name }) => ({ id, name }))
                if (!cancelled) setGroups(cachedGroups)
            })
            .catch(() => {
                /* Navigator still works without groups. */
            })
        return () => {
            cancelled = true
        }
    }, [open, auth.isAuthenticated])

    const items = useMemo<Item[]>(() => {
        const close = () => onOpenChange(false)
        const goToSheet = () => void navigate({ to: "/" })
        const list: Item[] = characters.map((character, index) => ({
            id: `character-${character.uuid}`,
            group: "Characters",
            label: character.name || `Unnamed character ${index + 1}`,
            hint: [character.characterClass, character.calling].filter(Boolean).join(" · ") || undefined,
            keywords: index === currentCharacterIndex ? "current active" : undefined,
            icon: <HeartSigil filled={index === currentCharacterIndex} className="size-4 text-heart" />,
            run: () => {
                setCurrentCharacter(index)
                goToSheet()
                close()
            },
        }))
        for (const group of auth.isAuthenticated ? groups : []) {
            list.push({
                id: `group-${group.id}`,
                group: "Play groups",
                label: group.name,
                keywords: "table play",
                icon: <Users className="size-4" />,
                run: () => {
                    void navigate({ to: "/play/$groupId", params: { groupId: group.id } })
                    close()
                },
            })
        }
        list.push({
            id: "page-sheet",
            group: "Go to",
            label: "Character sheet",
            keywords: "home",
            icon: <FileText className="size-4" />,
            run: () => (goToSheet(), close()),
        })
        if (auth.isAuthenticated) {
            list.push({
                id: "page-play",
                group: "Go to",
                label: "Play Mode",
                keywords: "groups table",
                icon: <Users className="size-4" />,
                run: () => (void navigate({ to: "/play" }), close()),
            })
        }
        list.push(
            {
                id: "action-new",
                group: "Actions",
                label: "New character",
                keywords: "add create",
                icon: <Plus className="size-4" />,
                run: () => {
                    addCharacter()
                    goToSheet()
                    close()
                },
            },
            {
                id: "action-dice",
                group: "Actions",
                label: "Open dice roller",
                keywords: "roll dice d6 d10",
                icon: <Dices className="size-4" />,
                run: () => {
                    goToSheet()
                    setDiceRollerOpen(true)
                    close()
                },
            },
            {
                id: "action-theme",
                group: "Actions",
                label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
                keywords: "theme appearance",
                icon: theme === "dark" ? <SunMedium className="size-4" /> : <MoonStar className="size-4" />,
                run: () => (toggleTheme(), close()),
            },
        )
        if (!auth.isAuthenticated)
            list.push({
                id: "action-login",
                group: "Actions",
                label: "Sign in",
                keywords: "login account",
                icon: <LogIn className="size-4" />,
                run: auth.login,
            })
        return list
    }, [characters, currentCharacterIndex, groups, auth, theme, navigate, onOpenChange, setCurrentCharacter, addCharacter, setDiceRollerOpen, toggleTheme])

    const results = useMemo(() => {
        const normalized = query.trim().toLowerCase()
        return items
            .map((item, order) => ({ item, order, score: score(item, normalized) }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => (normalized ? b.score - a.score : 0) || a.order - b.order)
            .map((entry) => entry.item)
    }, [items, query])

    const sections = useMemo(() => {
        const map = new Map<string, Item[]>()
        for (const item of results) map.set(item.group, [...(map.get(item.group) ?? []), item])
        // Flatten in section order so arrow keys follow what's on screen.
        return [...map.entries()]
    }, [results])
    const ordered = useMemo(() => sections.flatMap(([, entries]) => entries), [sections])
    const activeIndex = Math.min(active, Math.max(0, ordered.length - 1))

    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" })
    }, [activeIndex])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                hideClose
                aria-describedby={undefined}
                className="top-[max(1rem,12vh)] max-h-[min(34rem,calc(100dvh-2rem))] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl sm:p-0"
                onOpenAutoFocus={(event) => {
                    event.preventDefault()
                    ;(event.currentTarget as HTMLElement).querySelector("input")?.focus()
                }}
            >
                <DialogPrimitive.Title className="sr-only">Quick navigator</DialogPrimitive.Title>
                <div className="flex items-center gap-3 border-b border-border px-4">
                    <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <input
                        autoFocus
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="quick-navigator-list"
                        aria-activedescendant={ordered[activeIndex] ? `qn-${ordered[activeIndex].id}` : undefined}
                        aria-label="Search characters, groups and actions"
                        placeholder="Search characters, groups, actions…"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value)
                            setActive(0)
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "ArrowDown") {
                                event.preventDefault()
                                setActive((index) => (ordered.length ? (Math.min(index, ordered.length - 1) + 1) % ordered.length : 0))
                            } else if (event.key === "ArrowUp") {
                                event.preventDefault()
                                setActive((index) => (ordered.length ? (Math.min(index, ordered.length - 1) - 1 + ordered.length) % ordered.length : 0))
                            } else if (event.key === "Enter") {
                                event.preventDefault()
                                ordered[activeIndex]?.run()
                            }
                        }}
                        className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/75 focus-visible:outline-none"
                    />
                    <Kbd className="hidden sm:inline-flex">Esc</Kbd>
                </div>
                <div ref={listRef} id="quick-navigator-list" role="listbox" aria-label="Results" className="min-h-0 overflow-y-auto overscroll-contain p-2">
                    {ordered.length === 0 ? (
                        <p className="px-3 py-10 text-center text-sm text-muted-foreground">No matches for “{query}”.</p>
                    ) : (
                        sections.map(([group, entries]) => (
                            <div key={group} role="group" aria-label={group} className="pb-1">
                                <div className="px-2.5 pt-2 pb-1 text-[0.6875rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">{group}</div>
                                {entries.map((item) => {
                                    const index = ordered.indexOf(item)
                                    const selected = index === activeIndex
                                    return (
                                        <div
                                            key={item.id}
                                            id={`qn-${item.id}`}
                                            role="option"
                                            aria-selected={selected}
                                            data-index={index}
                                            onPointerMove={() => !selected && setActive(index)}
                                            onClick={item.run}
                                            className={cn(
                                                "flex min-h-10 items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors duration-100 ease-out",
                                                selected ? "bg-accent text-accent-foreground" : "text-foreground",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "grid size-7 shrink-0 place-items-center rounded-md border border-border bg-sunken",
                                                    selected ? "text-heart" : "text-muted-foreground",
                                                )}
                                            >
                                                {item.icon}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                                            {item.hint ? <span className="hidden truncate text-xs text-muted-foreground sm:block">{item.hint}</span> : null}
                                            <CornerDownLeft
                                                className={cn("size-3.5 shrink-0 text-muted-foreground", selected ? "opacity-100" : "opacity-0")}
                                                aria-hidden="true"
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
