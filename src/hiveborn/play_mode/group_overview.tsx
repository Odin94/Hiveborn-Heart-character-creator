import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api, API_URL, tokenStorage, type GroupCharacter, type PlayGroup, type User } from "@/lib/api"
import { usePlayModeStore } from "@/lib/playMode"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import { resistances } from "@/hiveborn/game_data/resistances"
import { BookOpen, ChevronLeft, Dices, Plus, Sparkles, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

type GroupOverviewProps = { user: User; selectedGroupId?: string; onClose: () => void; onSelectGroup: (groupId: string) => void }
type CharacterWithOwner = GroupCharacter & { ownerId: string; nickname: string | null }
type LiveGroupEvent =
    | { type: "character.updated"; userId: string; character: GroupCharacter }
    | { type: "character.deleted"; userId: string; characterId: string }
    | { type: "roll.shared" | "fallout.rolled" | "group.members.updated" }

const totalStress = (character: GroupCharacter) => Object.values(character.data.stress).reduce((sum, value) => sum + value, 0)

const classCardThemes: Record<string, string> = {
    Cleaver: "border-red-500/25 bg-red-500/8 hover:border-red-500/50",
    Deadwalker: "border-sky-400/25 bg-gradient-to-br from-sky-400/12 via-violet-400/10 to-card hover:border-violet-400/50",
    "Deep Apiarist": "border-amber-400/25 bg-amber-400/8 hover:border-amber-400/50",
    Heretic: "border-slate-400/25 bg-slate-400/8 hover:border-slate-400/50",
    Hound: "border-emerald-500/25 bg-emerald-500/8 hover:border-emerald-500/50",
    Incarnadine: "border-rose-400/25 bg-rose-400/8 hover:border-rose-400/50",
    "Junk Mage": "border-orange-400/25 bg-orange-400/8 hover:border-orange-400/50",
    "Vermissian Knight": "border-teal-400/25 bg-teal-400/8 hover:border-teal-400/50",
    Witch: "border-fuchsia-400/25 bg-fuchsia-400/8 hover:border-fuchsia-400/50",
}

const getClassCardTheme = (characterClass: string) => classCardThemes[characterClass] ?? "border-border bg-card hover:border-primary"

function applyLiveCharacterUpdate(groups: PlayGroup[], groupId: string, event: LiveGroupEvent): PlayGroup[] {
    if (event.type !== "character.updated" && event.type !== "character.deleted") return groups
    return groups.map((entry) => {
        if (entry.id !== groupId) return entry
        return {
            ...entry,
            members: entry.members.map((member) => {
                if (member.id !== event.userId) return member
                if (event.type === "character.deleted")
                    return { ...member, characters: member.characters.filter((character) => character.id !== event.characterId) }
                const hasCharacter = member.characters.some((character) => character.id === event.character.id)
                return {
                    ...member,
                    characters: hasCharacter
                        ? member.characters.map((character) => (character.id === event.character.id ? event.character : character))
                        : [...member.characters, event.character],
                }
            }),
        }
    })
}

export default function GroupOverview({ user, selectedGroupId, onClose, onSelectGroup }: GroupOverviewProps) {
    const [groups, setGroups] = useState<PlayGroup[]>([])
    const [createName, setCreateName] = useState("")
    const [inviteNickname, setInviteNickname] = useState("")
    const [selectedCharacter, setSelectedCharacter] = useState<CharacterWithOwner | null>(null)
    const [autoUpdateStress, setAutoUpdateStress] = useState(true)
    const setActiveGroupId = usePlayModeStore((state) => state.setActiveGroupId)
    const isGameMaster = usePlayModeStore((state) => state.isGameMaster)
    const setGameMaster = usePlayModeStore((state) => state.setGameMaster)
    const cloudIds = useCharacterStore.use.cloudCharacterIds()
    const setCurrentCharacter = useCharacterStore.use.setCurrentCharacter()

    const refresh = useCallback(async () => {
        try {
            const next = await api.groups()
            setGroups(next.groups)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not load play groups")
        }
    }, [])
    useEffect(() => {
        void refresh()
    }, [refresh])

    const group = groups.find((entry) => entry.id === selectedGroupId) ?? null
    useEffect(() => {
        // Do not retain a group from a previous account/session. A stale group
        // id would make rolls appear shareable until the API rejected them.
        setActiveGroupId(group?.id ?? null)
    }, [group?.id, setActiveGroupId])
    useEffect(() => {
        if (!group?.id || !tokenStorage.get()) return
        let closed = false
        let socket: WebSocket | undefined
        let reconnectTimer: number | undefined
        const connect = () => {
            const url = new URL(API_URL)
            url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
            url.pathname = `/play-groups/${group.id}/live`
            url.searchParams.set("token", tokenStorage.get()!)
            socket = new WebSocket(url)
            socket.onmessage = (message) => {
                try {
                    const event = JSON.parse(message.data) as LiveGroupEvent
                    setGroups((current) => applyLiveCharacterUpdate(current, group.id, event))
                } catch {
                    // A malformed live event never prevents the authoritative refresh below.
                }
                void refresh()
            }
            socket.onclose = (event) => {
                // Authentication and membership failures will not recover by
                // reconnecting; transient network/server closes will.
                if (!closed && event.code !== 1008) reconnectTimer = window.setTimeout(connect, 1_500)
            }
        }
        connect()
        return () => {
            closed = true
            if (reconnectTimer) window.clearTimeout(reconnectTimer)
            socket?.close()
        }
    }, [group?.id, refresh])

    const createGroup = async () => {
        try {
            const created = await api.createGroup(createName)
            setCreateName("")
            await refresh()
            onSelectGroup(created.id)
            toast.success("Play group created")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not create group")
        }
    }
    const invite = async () => {
        if (!group) return
        try {
            await api.invite(group.id, inviteNickname)
            setInviteNickname("")
            await refresh()
            toast.success("Player added to the group")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not invite that player")
        }
    }
    const openCharacter = (character: CharacterWithOwner) => {
        if (character.ownerId === user.id) {
            const index = cloudIds.indexOf(character.id)
            if (index >= 0) {
                setCurrentCharacter(index)
                onClose()
                return
            }
            toast.error("Your sheet is still syncing. Try again in a moment.")
            return
        }
        setSelectedCharacter(character)
    }
    const rollFallout = async (character: CharacterWithOwner) => {
        if (!group) return
        try {
            const result = await api.falloutRoll(group.id, { characterId: character.id, applyStressUpdate: autoUpdateStress })
            const message = result.fallout
                ? `${character.name}: ${result.fallout.toUpperCase()} fallout (${result.roll} vs ${result.totalStress} stress)${result.stressUpdated ? " — stress updated" : ""}`
                : `${character.name}: no fallout (${result.roll} vs ${result.totalStress} stress)`
            toast(result.fallout ? message : message)
            await refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not roll fallout")
        }
    }

    const characters: CharacterWithOwner[] =
        group?.members.flatMap((member) => member.characters.map((character) => ({ ...character, ownerId: member.id, nickname: member.nickname }))) ?? []
    return (
        <div className="mx-auto flex min-h-screen max-w-screen-2xl bg-background text-foreground">
            <aside className="w-72 shrink-0 border-r border-border bg-card/40 p-4 max-md:hidden">
                <Button variant="ghost" className="mb-6 w-full justify-start" onClick={onClose}>
                    <ChevronLeft /> Character sheets
                </Button>
                <div className="mb-3 flex items-center gap-2 font-bold">
                    <Users /> Play groups
                </div>
                <div className="space-y-1">
                    {groups.map((entry) => (
                        <button
                            key={entry.id}
                            onClick={() => onSelectGroup(entry.id)}
                            className={`w-full rounded px-3 py-2 text-left ${entry.id === selectedGroupId ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                        >
                            {entry.name}
                        </button>
                    ))}
                </div>
                <div className="mt-6 space-y-2">
                    <Input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="New group name" className="text-sm" />
                    <Button className="w-full" disabled={!createName.trim()} onClick={createGroup}>
                        <Plus /> Create group
                    </Button>
                </div>
                <label className="mt-8 flex cursor-pointer items-center gap-2 rounded border border-primary/20 p-3 text-sm">
                    <Checkbox checked={isGameMaster} onCheckedChange={(checked) => setGameMaster(checked === true)} /> I’m the game master
                </label>
                {isGameMaster && (
                    <label className="mt-2 flex cursor-pointer items-start gap-2 rounded border border-primary/20 p-3 text-sm">
                        <Checkbox checked={autoUpdateStress} onCheckedChange={(checked) => setAutoUpdateStress(checked === true)} />
                        <span>
                            Auto-update stress after fallout
                            <br />
                            <small className="text-muted-foreground">Off lets the player update their own sheet.</small>
                        </span>
                    </label>
                )}
            </aside>
            <main className="min-w-0 flex-1 p-5 sm:p-8">
                <div className="mb-6 flex items-center justify-between gap-3 md:hidden">
                    <Button variant="outline" onClick={onClose}>
                        <ChevronLeft /> Sheets
                    </Button>
                    <label className="flex cursor-pointer items-center gap-2 rounded border border-primary/20 px-3 py-2 text-sm">
                        <Checkbox checked={isGameMaster} onCheckedChange={(checked) => setGameMaster(checked === true)} /> I’m the GM
                    </label>
                </div>
                {isGameMaster && (
                    <label className="mb-4 flex cursor-pointer items-start gap-2 rounded border border-primary/20 p-3 text-sm md:hidden">
                        <Checkbox checked={autoUpdateStress} onCheckedChange={(checked) => setAutoUpdateStress(checked === true)} />
                        <span>
                            Auto-update stress after fallout
                            <br />
                            <small className="text-muted-foreground">Off lets the player update their own sheet.</small>
                        </span>
                    </label>
                )}
                {!group ? (
                    <section className="mx-auto mt-20 max-w-md text-center">
                        <h1 className="text-3xl font-bold">{groups.length ? "Choose a play group" : "Start a play group"}</h1>
                        <p className="mt-2 text-muted-foreground">
                            {groups.length
                                ? "Choose a group from the sidebar to join its live table."
                                : "Set your nickname in the account menu, then create a group and invite players by nickname."}
                        </p>
                        <div className="mt-6 flex gap-2">
                            <Input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Group name" />
                            <Button disabled={!createName.trim()} onClick={createGroup}>
                                Create
                            </Button>
                        </div>
                    </section>
                ) : (
                    <>
                        <header className="mb-7">
                            <p className="text-sm uppercase tracking-widest text-primary">Live play table</p>
                            <h1 className="text-4xl font-black">{group.name}</h1>
                            <p className="mt-1 text-muted-foreground">Character changes and shared rolls update immediately for everyone here.</p>
                        </header>
                        <section className="mb-6 space-y-3 rounded-lg border border-border bg-card/40 p-3 md:hidden">
                            <label className="block text-sm font-semibold" htmlFor="mobile-play-group">
                                Play group
                            </label>
                            <select
                                id="mobile-play-group"
                                value={selectedGroupId ?? ""}
                                onChange={(event) => event.target.value && onSelectGroup(event.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                                {groups.map((entry) => (
                                    <option key={entry.id} value={entry.id}>
                                        {entry.name}
                                    </option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                                <Input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="New group name" />
                                <Button disabled={!createName.trim()} onClick={createGroup}>
                                    <Plus /> Create
                                </Button>
                            </div>
                        </section>
                        <section className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/40 p-3">
                            <span className="font-semibold">Invite by nickname</span>
                            <Input
                                value={inviteNickname}
                                onChange={(event) => setInviteNickname(event.target.value)}
                                placeholder="Player nickname"
                                className="w-52 text-sm"
                            />
                            <Button size="sm" disabled={!inviteNickname.trim()} onClick={invite}>
                                Invite
                            </Button>
                        </section>
                        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            {characters.map((character) => (
                                <CharacterCard
                                    key={character.id}
                                    character={character}
                                    own={character.ownerId === user.id}
                                    gameMaster={isGameMaster}
                                    onOpen={() => openCharacter(character)}
                                    onFallout={() => void rollFallout(character)}
                                />
                            ))}
                        </section>
                        <section className="mt-8 rounded-lg border border-border bg-card/40 p-4">
                            <h2 className="font-bold">Recent shared rolls</h2>
                            <div className="mt-2 space-y-1 text-sm">
                                {group.rolls.length ? (
                                    group.rolls.map((roll) => (
                                        <p key={roll.id}>
                                            <span className="font-semibold">{roll.characterName}</span> rolled {roll.dice} for {roll.label}:{" "}
                                            <span className="font-bold text-primary">{roll.result}</span>
                                        </p>
                                    ))
                                ) : (
                                    <p className="text-muted-foreground">Shared rolls will appear here.</p>
                                )}
                            </div>
                        </section>
                    </>
                )}
            </main>
            <CharacterSheetModal character={selectedCharacter} onClose={() => setSelectedCharacter(null)} />
        </div>
    )
}

function CharacterCard({
    character,
    own,
    gameMaster,
    onOpen,
    onFallout,
}: {
    character: CharacterWithOwner
    own: boolean
    gameMaster: boolean
    onOpen: () => void
    onFallout: () => void
}) {
    const data = character.data
    return (
        <article
            className={`group cursor-pointer rounded-xl border p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${getClassCardTheme(data.characterClass)}`}
            onClick={onOpen}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-widest text-primary">{own ? "Your character" : (character.nickname ?? "Player")}</p>
                    <h2 className="text-2xl font-black">{character.name || "Unnamed hiveborn"}</h2>
                </div>
                <span className="rounded bg-primary/10 px-2 py-1 text-xs font-bold">{totalStress(character)} stress</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 divide-x divide-foreground/10 rounded-lg border border-foreground/10 bg-background/35 py-3 text-center text-sm backdrop-blur-[1px]">
                <div className="min-w-0 px-2">
                    <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <BookOpen className="size-3.5" /> Class
                    </dt>
                    <dd className="mt-1 truncate font-bold" title={data.characterClass || undefined}>
                        {data.characterClass || "—"}
                    </dd>
                </div>
                <div className="min-w-0 px-2">
                    <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <Sparkles className="size-3.5" /> Calling
                    </dt>
                    <dd className="mt-1 truncate font-bold" title={data.calling || undefined}>
                        {data.calling || "—"}
                    </dd>
                </div>
            </dl>
            <div className="mt-4">
                <p className="text-xs font-bold tracking-wider text-muted-foreground">CURRENT STRESS</p>
                <div className="mt-1 flex flex-wrap gap-1">
                    {resistances.map((resistance) => (
                        <span key={resistance} className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                            {resistance}: {data.stress[resistance]}
                        </span>
                    ))}
                </div>
            </div>
            <div className="mt-3 rounded border-l-4 border-destructive bg-destructive/5 p-2">
                <p className="text-xs font-bold tracking-wider text-destructive">CURRENT FALLOUTS</p>
                <p className="whitespace-pre-wrap text-sm">{data.fallout || "None recorded"}</p>
            </div>
            <div className="mt-4 flex gap-2" onClick={(event) => event.stopPropagation()}>
                {gameMaster && (
                    <Button size="sm" variant="destructive" onClick={onFallout}>
                        <Dices /> Roll fallout
                    </Button>
                )}
                <Button size="sm" variant="outline" onClick={onOpen}>
                    {own ? "Open my sheet" : "View sheet"}
                </Button>
            </div>
        </article>
    )
}

function CharacterSheetModal({ character, onClose }: { character: CharacterWithOwner | null; onClose: () => void }) {
    return (
        <Dialog open={Boolean(character)} onOpenChange={(open) => !open && onClose()}>
            {character && (
                <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto p-0 sm:max-w-4xl">
                    <DialogHeader className="sticky top-0 z-10 border-b bg-background p-6">
                        <DialogTitle className="text-3xl">{character.name || "Unnamed hiveborn"}</DialogTitle>
                        <DialogDescription>{character.nickname ?? "Group player"}’s read-only character sheet</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 p-6 md:grid-cols-2">
                        <SheetSection title="Identity">
                            <p>
                                <b>Class:</b> {character.data.characterClass || "—"}
                            </p>
                            <p>
                                <b>Calling:</b> {character.data.calling || "—"}
                            </p>
                            <p>
                                <b>Active beats:</b>
                            </p>
                            <p className="whitespace-pre-wrap">{character.data.activeBeats || "—"}</p>
                        </SheetSection>
                        <SheetSection title="Stress & protections">
                            <div className="grid grid-cols-2 gap-2">
                                {resistances.map((resistance) => (
                                    <p key={resistance}>
                                        <b>{resistance.toUpperCase()}:</b> {character.data.stress[resistance]} stress / {character.data.protections[resistance]}{" "}
                                        protection
                                    </p>
                                ))}
                            </div>
                        </SheetSection>
                        <SheetSection title="Fallout">
                            <p className="whitespace-pre-wrap">{character.data.fallout || "None recorded"}</p>
                        </SheetSection>
                        <SheetSection title="Abilities">
                            <p className="whitespace-pre-wrap">{character.data.abilities || "—"}</p>
                        </SheetSection>
                        <SheetSection title="Skills">
                            <p className="whitespace-pre-wrap">
                                {Object.entries(character.data.skills)
                                    .filter(([, skill]) => skill.hasSkill)
                                    .map(([skill, details]) => `${skill}${details.knacks ? ` — ${details.knacks}` : ""}`)
                                    .join("\n") || "—"}
                            </p>
                        </SheetSection>
                        <SheetSection title="Domains">
                            <p className="whitespace-pre-wrap">
                                {Object.entries(character.data.domains)
                                    .filter(([, domain]) => domain.hasDomain)
                                    .map(([domain, details]) => `${domain}${details.knacks ? ` — ${details.knacks}` : ""}`)
                                    .join("\n") || "—"}
                            </p>
                        </SheetSection>
                        <SheetSection title="Equipment">
                            <p className="whitespace-pre-wrap">{character.data.equipment || "—"}</p>
                        </SheetSection>
                        <SheetSection title="Resources">
                            <p className="whitespace-pre-wrap">{character.data.resources || "—"}</p>
                        </SheetSection>
                    </div>
                </DialogContent>
            )}
        </Dialog>
    )
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-lg border border-border p-4">
            <h3 className="mb-3 font-black tracking-wide text-primary">{title}</h3>
            <div className="space-y-2 text-sm">{children}</div>
        </section>
    )
}
