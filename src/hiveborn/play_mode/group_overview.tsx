import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Markdown } from "@/components/ui/markdown"
import ThemeToggle from "@/components/theme-toggle"
import { api, API_URL, tokenStorage, type CloudCharacter, type GroupCharacter, type PlayGroup, type PlayGroupInvitation, type User } from "@/lib/api"
import { usePlayModeStore } from "@/lib/playMode"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import { ReadOnlyStressCounter } from "@/hiveborn/character_sheet/components/stress_counter/stress_counter"
import { TagReferenceDialog, type ReferenceTag } from "@/hiveborn/character_sheet/components/shared/tag_reference_dialog"
import { equipmentTags } from "@/hiveborn/game_data/equipment_tags"
import { resourceTags } from "@/hiveborn/game_data/resource_tags"
import { resistances } from "@/hiveborn/game_data/resistances"
import FalloutDie, { falloutRollOverlayLifetimeMs } from "./fallout_die"
import { BookOpen, ChevronLeft, Circle, Dices, Plus, Sparkles, Users } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

type GroupOverviewProps = { user: User; selectedGroupId?: string; onClose: () => void; onSelectGroup: (groupId: string) => void }
type CharacterWithOwner = GroupCharacter & { ownerId: string; nickname: string | null; isOnline: boolean }
type FalloutRoll = { characterName: string; roll: number; fallout: "minor" | "major" | null }
type LiveGroupEvent =
    | { type: "character.updated"; userId: string; character: GroupCharacter }
    | { type: "character.deleted"; userId: string; characterId: string }
    | { type: "member.presence"; userId: string; online: boolean }
    | { type: "roll.shared" | "fallout.rolled" | "group.members.updated" }

const lastGroupStorageKey = (userId: string) => `hiveborn-last-play-group:${window.location.origin}:${userId}`
const otherPlayersBeatsStorageKey = (userId: string) => `hiveborn-show-other-players-beats:${window.location.origin}:${userId}`
const ROLL_LIFETIME_MS = 10 * 60 * 1_000
const ROLL_FADE_TICK_MS = 10 * 1_000

const totalStress = (character: GroupCharacter) => Object.values(character.data.stress).reduce((sum, value) => sum + value, 0)
const rollCharacterName = (character: Pick<CloudCharacter, "name">) => character.name || "Unnamed hiveborn"
const rollAge = (createdAt: string, now: number) => Math.max(0, now - new Date(createdAt).getTime())
const relativeTime = (date: string, now = Date.now()) => {
    const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1_000))
    if (seconds < 10) return "just now"
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    return `${Math.floor(minutes / 60)}h ago`
}

const classCardThemes: Record<string, string> = {
    Cleaver: "bg-gradient-to-br from-red-500/18 via-stone-300/18 to-card dark:from-red-950/70 dark:via-stone-900/60 dark:to-card",
    Deadwalker: "bg-gradient-to-br from-teal-400/16 via-slate-300/20 to-card dark:from-teal-950/70 dark:via-slate-800/65 dark:to-card",
    "Deep Apiarist": "bg-gradient-to-br from-amber-400/18 via-teal-400/11 to-card dark:from-amber-950/75 dark:via-teal-950/55 dark:to-card",
    Heretic: "bg-gradient-to-br from-orange-400/18 via-red-400/11 to-card dark:from-orange-950/70 dark:via-red-950/50 dark:to-card",
    Hound: "bg-gradient-to-br from-blue-400/16 via-amber-300/11 to-card dark:from-blue-950/75 dark:via-amber-950/45 dark:to-card",
    Incarnadine: "bg-gradient-to-br from-amber-400/16 via-rose-500/14 to-card dark:from-amber-950/60 dark:via-rose-950/70 dark:to-card",
    "Junk Mage": "bg-gradient-to-br from-teal-400/18 via-blue-500/14 to-card dark:from-teal-950/70 dark:via-blue-950/65 dark:to-card",
    "Vermissian Knight": "bg-gradient-to-br from-sky-400/17 via-yellow-300/12 to-card dark:from-sky-950/75 dark:via-yellow-950/45 dark:to-card",
    Witch: "bg-gradient-to-br from-red-500/17 via-orange-400/11 to-card dark:from-red-950/75 dark:via-orange-950/55 dark:to-card",
}

const getClassCardTheme = (characterClass: string) => classCardThemes[characterClass] ?? "bg-card"

const selectedFeaturesMarkdown = (features: Record<string, { hasSkill?: boolean; hasDomain?: boolean; knacks: string }>) => {
    const selectedFeatures = Object.entries(features).filter(([, feature]) => feature.hasSkill || feature.hasDomain)
    return selectedFeatures.map(([name, feature]) => `- **${name}**${feature.knacks ? ` — ${feature.knacks}` : ""}`).join("\n") || "—"
}

function applyLiveCharacterUpdate(groups: PlayGroup[], groupId: string, event: LiveGroupEvent): PlayGroup[] {
    return groups.map((entry) => {
        if (entry.id !== groupId) return entry
        if (event.type === "member.presence") {
            return { ...entry, members: entry.members.map((member) => (member.id === event.userId ? { ...member, isOnline: event.online } : member)) }
        }
        if (event.type !== "character.updated" && event.type !== "character.deleted") return entry
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
    const [ownCharacters, setOwnCharacters] = useState<CloudCharacter[]>([])
    const [invitations, setInvitations] = useState<PlayGroupInvitation[]>([])
    const [createName, setCreateName] = useState("")
    const [inviteNickname, setInviteNickname] = useState("")
    const [selectedCharacter, setSelectedCharacter] = useState<CharacterWithOwner | null>(null)
    const [autoUpdateStress, setAutoUpdateStress] = useState(true)
    const [gmTargetCharacterId, setGmTargetCharacterId] = useState("")
    const [falloutRoll, setFalloutRoll] = useState<FalloutRoll | null>(null)
    const [rollingFalloutCharacterId, setRollingFalloutCharacterId] = useState<string | null>(null)
    const [rollAgeUpdatedAt, setRollAgeUpdatedAt] = useState(() => Date.now())
    const [showOtherPlayersBeats, setShowOtherPlayersBeats] = useState(() => localStorage.getItem(otherPlayersBeatsStorageKey(user.id)) === "true")
    const refreshTimer = useRef<number | undefined>(undefined)
    const setActiveGroup = usePlayModeStore((state) => state.setActiveGroup)
    const cloudIds = useCharacterStore.use.cloudCharacterIds()
    const localCharacters = useCharacterStore.use.characters()
    const currentCharacterIndex = useCharacterStore.use.currentCharacterIndex()
    const setCurrentCharacter = useCharacterStore.use.setCurrentCharacter()
    const applyRemoteCloudCharacter = useCharacterStore.use.applyRemoteCloudCharacter()

    const refresh = useCallback(async () => {
        try {
            const [nextGroups, nextCharacters] = await Promise.all([api.groups(), api.characters()])
            setGroups(nextGroups.groups)
            setInvitations(nextGroups.invitations)
            setOwnCharacters(nextCharacters.characters)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not load play groups")
        }
    }, [])
    const scheduleRefresh = useCallback(() => {
        if (refreshTimer.current) return
        refreshTimer.current = window.setTimeout(() => {
            refreshTimer.current = undefined
            void refresh()
        }, 350)
    }, [refresh])
    useEffect(() => {
        void refresh()
    }, [refresh])
    useEffect(() => {
        return () => {
            if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
        }
    }, [])
    useEffect(() => {
        const refreshOnFocus = () => void refresh()
        window.addEventListener("focus", refreshOnFocus)
        const interval = window.setInterval(refreshOnFocus, 15_000)
        return () => {
            window.removeEventListener("focus", refreshOnFocus)
            window.clearInterval(interval)
        }
    }, [refresh])

    const group = groups.find((entry) => entry.id === selectedGroupId) ?? null
    const activeGroupId = group?.id ?? null
    const activeGroupName = group?.name ?? null
    const activeGroupCharacterIdsKey =
        group?.members
            .find((member) => member.id === user.id)
            ?.characters.map((character) => character.id)
            .join(",") ?? ""
    useEffect(() => {
        if (selectedGroupId || groups.length === 0) return
        const rememberedGroupId = localStorage.getItem(lastGroupStorageKey(user.id))
        const initialGroup = groups.find((entry) => entry.id === rememberedGroupId) ?? groups[0]
        onSelectGroup(initialGroup.id)
    }, [groups, onSelectGroup, selectedGroupId, user.id])
    useEffect(() => {
        // Do not retain a group from a previous account/session. A stale group
        // id would make rolls appear shareable until the API rejected them.
        setActiveGroup(
            activeGroupId && activeGroupName
                ? { id: activeGroupId, name: activeGroupName, characterIds: activeGroupCharacterIdsKey ? activeGroupCharacterIdsKey.split(",") : [] }
                : null,
        )
    }, [activeGroupCharacterIdsKey, activeGroupId, activeGroupName, setActiveGroup])
    useEffect(() => {
        if (group) localStorage.setItem(lastGroupStorageKey(user.id), group.id)
    }, [group, user.id])
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
                    if (event.type === "character.updated" && event.userId === user.id) {
                        applyRemoteCloudCharacter(event.character.id, event.character.data, event.character.version)
                    }
                } catch {
                    // A malformed live event never prevents the authoritative refresh below.
                }
                scheduleRefresh()
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
    }, [applyRemoteCloudCharacter, group?.id, scheduleRefresh, user.id])

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
            toast.success("Invitation sent")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not invite that player")
        }
    }
    const respondToInvitation = async (invitation: PlayGroupInvitation, accept: boolean) => {
        try {
            if (accept) {
                const acceptedGroup = await api.acceptInvitation(invitation.group.id)
                await refresh()
                onSelectGroup(acceptedGroup.id)
                toast.success(`Joined ${acceptedGroup.name}`)
            } else {
                await api.declineInvitation(invitation.group.id)
                await refresh()
                toast.success("Invitation declined")
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not update invitation")
        }
    }
    const assignGameMaster = async (memberId: string, isGameMaster: boolean) => {
        if (!group) return
        try {
            await api.setGameMaster(group.id, memberId, isGameMaster)
            await refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not update game master")
        }
    }
    const assignCharacter = async (character: CloudCharacter) => {
        if (!group) return
        try {
            await api.assignCharacter(group.id, character.id)
            await refresh()
            toast.success(`${rollCharacterName(character)} added to this group`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not add that character")
        }
    }
    const removeCharacter = async (character: CloudCharacter) => {
        if (!group) return
        try {
            await api.removeCharacterFromGroup(group.id, character.id)
            await refresh()
            toast.success(`${rollCharacterName(character)} removed from this group`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not remove that character")
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
    const setOtherPlayersBeats = (showBeats: boolean) => {
        setShowOtherPlayersBeats(showBeats)
        localStorage.setItem(otherPlayersBeatsStorageKey(user.id), String(showBeats))
    }
    const rollFallout = async (character: CharacterWithOwner) => {
        if (!group) return
        setRollingFalloutCharacterId(character.id)
        try {
            const result = await api.falloutRoll(group.id, { characterId: character.id, applyStressUpdate: autoUpdateStress })
            setFalloutRoll({ characterName: rollCharacterName(character), roll: result.roll, fallout: result.fallout })
            await new Promise<void>((resolve) => window.setTimeout(resolve, falloutRollOverlayLifetimeMs))
            const stressUpdate =
                result.stressUpdate?.type === "all" ? "set all stress to 0" : result.stressUpdate ? `set ${result.stressUpdate.resistance} stress to 0` : null
            const message = result.fallout
                ? `${character.name}: ${result.fallout.toUpperCase()} fallout (${result.roll} vs ${result.totalStress} stress)${stressUpdate ? ` — ${stressUpdate}` : ""}`
                : `${character.name}: no fallout (${result.roll} vs ${result.totalStress} stress)`
            toast(result.fallout ? message : message)
            await refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not roll fallout")
        } finally {
            setFalloutRoll(null)
            setRollingFalloutCharacterId(null)
        }
    }

    const characters: CharacterWithOwner[] =
        group?.members.flatMap((member) =>
            member.characters.map((character) => ({ ...character, ownerId: member.id, nickname: member.nickname, isOnline: member.isOnline })),
        ) ?? []
    const assignedOwnCharacterIds = new Set(activeGroupCharacterIdsKey ? activeGroupCharacterIdsKey.split(",") : [])
    const unassignedOwnCharacters = ownCharacters.filter((character) => !assignedOwnCharacterIds.has(character.id))
    const isGameMaster = group?.members.find((member) => member.id === user.id)?.isGameMaster ?? false
    const isGroupOwner = group?.ownerId === user.id
    const gmTarget = characters.find((character) => character.id === gmTargetCharacterId) ?? characters[0]
    const visibleRolls = group?.rolls.filter((roll) => rollAge(roll.createdAt, rollAgeUpdatedAt) < ROLL_LIFETIME_MS) ?? []
    const hasFadingRolls = visibleRolls.length > 0
    useEffect(() => {
        if (!hasFadingRolls) return

        setRollAgeUpdatedAt(Date.now())
        const interval = window.setInterval(() => setRollAgeUpdatedAt(Date.now()), ROLL_FADE_TICK_MS)
        return () => window.clearInterval(interval)
    }, [group?.id, hasFadingRolls])

    return (
        <div className="mx-auto flex min-h-screen max-w-screen-2xl bg-background text-foreground">
            <aside className="w-72 shrink-0 border-r border-border bg-card/40 p-4 max-md:hidden">
                <div className="mb-6 flex items-center gap-2">
                    <Button variant="ghost" className="flex-1 justify-start" onClick={onClose}>
                        <ChevronLeft /> Character sheets
                    </Button>
                    <ThemeToggle />
                </div>
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
                <label className="mt-2 flex cursor-pointer items-start gap-2 rounded border border-primary/20 p-3 text-sm">
                    <Checkbox checked={showOtherPlayersBeats} onCheckedChange={(checked) => setOtherPlayersBeats(checked === true)} />
                    <span>Show me other players’ beats</span>
                </label>
            </aside>
            <main className="min-w-0 flex-1 p-5 sm:p-8">
                <div className="mb-6 flex items-center justify-between gap-3 md:hidden">
                    <Button variant="outline" onClick={onClose}>
                        <ChevronLeft /> Sheets
                    </Button>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        {isGameMaster && <span className="rounded border border-primary/20 px-3 py-2 text-sm">You’re a GM</span>}
                    </div>
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
                <label className="mb-4 flex cursor-pointer items-start gap-2 rounded border border-primary/20 p-3 text-sm md:hidden">
                    <Checkbox checked={showOtherPlayersBeats} onCheckedChange={(checked) => setOtherPlayersBeats(checked === true)} />
                    <span>Show me other players’ beats</span>
                </label>
                {invitations.length > 0 && (
                    <section className="mb-6 rounded-lg border border-primary/25 bg-card/40 p-4">
                        <h2 className="font-bold">Play group invitations</h2>
                        <div className="mt-3 space-y-3">
                            {invitations.map((invitation) => (
                                <div key={invitation.group.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-background/40 p-3">
                                    <p className="text-sm">
                                        <span className="font-semibold">{invitation.group.name}</span>
                                        {invitation.invitedByNickname ? ` — invited by ${invitation.invitedByNickname}` : ""}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => void respondToInvitation(invitation, false)}>
                                            Decline
                                        </Button>
                                        <Button size="sm" onClick={() => void respondToInvitation(invitation, true)}>
                                            Accept
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
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
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                                <span>Character changes and shared rolls update immediately for everyone here.</span>
                                <span className="inline-flex items-center gap-1 text-sm text-foreground">
                                    <Circle className="size-2 fill-emerald-500 text-emerald-500" />
                                    {group.members.filter((member) => member.isOnline).length} online
                                </span>
                            </p>
                        </header>
                        <section className="sticky top-2 z-20 mb-6 space-y-3 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur md:hidden">
                            <div className="grid grid-cols-2 gap-2">
                                <label className="block text-sm font-semibold" htmlFor="mobile-play-group">
                                    <span className="mb-1 block">Group</span>
                                    <select
                                        id="mobile-play-group"
                                        value={selectedGroupId ?? ""}
                                        onChange={(event) => event.target.value && onSelectGroup(event.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
                                    >
                                        {groups.map((entry) => (
                                            <option key={entry.id} value={entry.id}>
                                                {entry.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block text-sm font-semibold" htmlFor="mobile-group-character">
                                    <span className="mb-1 block">Sheet</span>
                                    <select
                                        id="mobile-group-character"
                                        value={currentCharacterIndex}
                                        onChange={(event) => setCurrentCharacter(Number(event.target.value))}
                                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
                                    >
                                        {localCharacters.map((character, index) => (
                                            <option key={cloudIds[index] || index} value={index}>
                                                {character.name || `Character ${index + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div className="flex gap-2">
                                <Input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="New group name" />
                                <Button disabled={!createName.trim()} onClick={createGroup}>
                                    <Plus /> Create
                                </Button>
                            </div>
                        </section>
                        <section className="mb-6 flex flex-wrap items-center gap-2 rounded-lg bg-card/40 p-3">
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
                        <section className="mb-6 rounded-lg bg-card/40 p-3">
                            <h2 className="font-semibold">Game masters</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {isGroupOwner
                                    ? "Choose any number of members, or leave the group without a GM."
                                    : "Only the group owner can assign game masters."}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {group.members.map((member) => (
                                    <label key={member.id} className="flex items-center gap-2 rounded-md border bg-background/40 px-3 py-2 text-sm">
                                        <Checkbox
                                            checked={member.isGameMaster}
                                            disabled={!isGroupOwner}
                                            onCheckedChange={(checked) => void assignGameMaster(member.id, checked === true)}
                                        />
                                        {member.nickname ?? "Player"}
                                        {member.id === group.ownerId ? " (owner)" : ""}
                                    </label>
                                ))}
                            </div>
                        </section>
                        {isGameMaster && gmTarget && (
                            <section className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4">
                                <div className="min-w-48 flex-1">
                                    <h2 className="font-semibold">GM session control</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Roll fallout without opening a sheet. {totalStress(gmTarget)} stress currently marked.
                                        {totalStress(gmTarget) === 0 ? " Mark stress before rolling." : ""}
                                    </p>
                                </div>
                                <label className="grid gap-1 text-sm font-medium" htmlFor="gm-fallout-character">
                                    Character
                                    <select
                                        id="gm-fallout-character"
                                        value={gmTarget.id}
                                        onChange={(event) => setGmTargetCharacterId(event.target.value)}
                                        className="h-9 min-w-44 rounded-md border border-input bg-background px-2 text-sm font-normal"
                                    >
                                        {characters.map((character) => (
                                            <option key={character.id} value={character.id}>
                                                {rollCharacterName(character)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <Button
                                    variant="destructive"
                                    disabled={rollingFalloutCharacterId === gmTarget.id || totalStress(gmTarget) === 0}
                                    onClick={() => void rollFallout(gmTarget)}
                                >
                                    <Dices /> Roll fallout
                                </Button>
                            </section>
                        )}
                        {unassignedOwnCharacters.length > 0 && (
                            <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                                <div>
                                    <h2 className="font-semibold">Bring a sheet to the table</h2>
                                    <p className="text-sm text-muted-foreground">Add one of your sheets so it can share rolls and appear for the GM.</p>
                                </div>
                                <Button onClick={() => void assignCharacter(unassignedOwnCharacters[0]!)}>
                                    Add {rollCharacterName(unassignedOwnCharacters[0]!)}
                                </Button>
                            </section>
                        )}
                        <section className="mb-6 rounded-lg bg-card/40 p-3">
                            <h2 className="font-semibold">Your characters in this group</h2>
                            {ownCharacters.length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {ownCharacters.map((character) => {
                                        const assigned = assignedOwnCharacterIds.has(character.id)
                                        return (
                                            <div
                                                key={character.id}
                                                className="flex items-center gap-2 rounded-md border bg-background/40 py-1 pl-3 pr-1 text-sm"
                                            >
                                                <span>{rollCharacterName(character)}</span>
                                                <Button
                                                    size="sm"
                                                    variant={assigned ? "outline" : "default"}
                                                    onClick={() => void (assigned ? removeCharacter(character) : assignCharacter(character))}
                                                >
                                                    {assigned ? "Remove" : "Add"}
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">Create a character sheet to add it to this group.</p>
                            )}
                        </section>
                        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            {characters.map((character) => (
                                <CharacterCard
                                    key={character.id}
                                    character={character}
                                    own={character.ownerId === user.id}
                                    gameMaster={isGameMaster}
                                    rollingFallout={rollingFalloutCharacterId === character.id}
                                    onOpen={() => openCharacter(character)}
                                    onFallout={() => void rollFallout(character)}
                                    showBeats={character.ownerId === user.id || showOtherPlayersBeats}
                                />
                            ))}
                        </section>
                        <SharedRolls characters={characters} rolls={visibleRolls} now={rollAgeUpdatedAt} />
                    </>
                )}
            </main>
            <CharacterSheetModal character={selectedCharacter} showBeats={showOtherPlayersBeats} onClose={() => setSelectedCharacter(null)} />
            {falloutRoll && <FalloutDie {...falloutRoll} value={falloutRoll.roll} />}
        </div>
    )
}

function SharedRolls({ characters, rolls, now }: { characters: CharacterWithOwner[]; rolls: PlayGroup["rolls"]; now: number }) {
    const knownCharacterIds = new Set(characters.map((character) => character.id))
    const formerCharacters = [
        ...new Map(
            rolls
                .filter((roll) => !roll.characterId || !knownCharacterIds.has(roll.characterId))
                .map((roll) => [roll.characterId ?? `legacy-${roll.characterName}`, roll.characterName]),
        ).entries(),
    ].map(([id, name]) => ({ id, name }))
    const columns = [...characters.map((character) => ({ id: character.id, name: rollCharacterName(character) })), ...formerCharacters]

    return (
        <section className="mt-8 rounded-lg bg-card/40 p-4">
            <h2 className="font-bold">Recent table activity</h2>
            {columns.length ? (
                <div className="mt-3 overflow-x-auto pb-1">
                    <div className="grid min-w-max grid-flow-col auto-cols-[minmax(13rem,1fr)] gap-4">
                        {columns.map((column) => {
                            const characterRolls = rolls.filter(
                                (roll) => roll.characterId === column.id || (!roll.characterId && column.id === `legacy-${roll.characterName}`),
                            )
                            return (
                                <section key={column.id} className="min-h-28 rounded-md bg-background/35 p-3">
                                    <h3 className="truncate text-sm font-bold" title={column.name}>
                                        {column.name}
                                    </h3>
                                    <div className="mt-2 space-y-2 text-sm">
                                        {characterRolls.length ? (
                                            characterRolls.map((roll) => {
                                                const opacity = Math.max(0, 1 - rollAge(roll.createdAt, now) / ROLL_LIFETIME_MS)
                                                return (
                                                    <p
                                                        key={roll.id}
                                                        className="transition-opacity duration-[10000ms] ease-linear motion-reduce:transition-none"
                                                        style={{ opacity }}
                                                    >
                                                        Rolled {roll.dice} for {roll.label}: <span className="font-bold text-primary">{roll.result}</span>
                                                    </p>
                                                )
                                            })
                                        ) : (
                                            <p className="text-muted-foreground">No recent rolls</p>
                                        )}
                                    </div>
                                </section>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <p className="mt-2 text-sm text-muted-foreground">Shared rolls and fallout outcomes will appear here.</p>
            )}
        </section>
    )
}

function CharacterCard({
    character,
    own,
    gameMaster,
    rollingFallout,
    onOpen,
    onFallout,
    showBeats,
}: {
    character: CharacterWithOwner
    own: boolean
    gameMaster: boolean
    rollingFallout: boolean
    onOpen: () => void
    onFallout: () => void
    showBeats: boolean
}) {
    const data = character.data
    return (
        <article
            className={`group flex h-full cursor-pointer flex-col rounded-xl p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none ${getClassCardTheme(data.characterClass)}`}
            onClick={onOpen}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="flex items-center gap-1 text-xs uppercase tracking-widest text-primary">
                        <Circle
                            className={`size-2 ${character.isOnline ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/50 text-muted-foreground/50"}`}
                        />
                        {own ? "Your character" : (character.nickname ?? "Player")}
                        {character.isOnline ? " online" : " away"}
                    </p>
                    <h2 className="text-2xl font-black">{character.name || "Unnamed hiveborn"}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Sheet updated {relativeTime(character.updatedAt)}</p>
                </div>
                <span className="rounded bg-primary/10 px-2 py-1 text-xs font-bold">{totalStress(character)} stress</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 divide-x divide-foreground/10 rounded-lg bg-background/35 py-3 text-center text-sm backdrop-blur-[1px]">
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
                <Markdown className="text-sm">{data.fallout || "None recorded"}</Markdown>
            </div>
            {showBeats && (
                <div className="mt-3 rounded border-l-4 border-primary bg-primary/5 p-2 text-left">
                    <p className="text-xs font-bold tracking-wider text-primary">ACTIVE BEATS</p>
                    <Markdown className="text-sm">{data.activeBeats || "None recorded"}</Markdown>
                </div>
            )}
            <div className="mt-auto flex gap-2 pt-4" onClick={(event) => event.stopPropagation()}>
                {gameMaster && (
                    <Button size="sm" variant="destructive" onClick={onFallout} disabled={rollingFallout || totalStress(character) === 0}>
                        <Dices /> Roll fallout
                    </Button>
                )}
                <Button size="sm" variant="outline" className="border-0" onClick={onOpen}>
                    {own ? "Open my sheet" : "View sheet"}
                </Button>
            </div>
        </article>
    )
}

function CharacterSheetModal({ character, showBeats, onClose }: { character: CharacterWithOwner | null; showBeats: boolean; onClose: () => void }) {
    return (
        <Dialog open={Boolean(character)} onOpenChange={(open) => !open && onClose()}>
            {character && (
                <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-6xl overflow-y-auto p-0 sm:max-w-6xl">
                    <DialogHeader className="sticky top-0 z-10 border-b bg-background p-6">
                        <DialogTitle className="text-3xl">{character.name || "Unnamed hiveborn"}</DialogTitle>
                        <DialogDescription>{character.nickname ?? "Group player"}’s read-only character sheet</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 p-6 md:grid-cols-2">
                        <SheetSection title="Identity">
                            <div>
                                <p className="font-bold">Class</p>
                                <Markdown>{character.data.characterClass || "—"}</Markdown>
                            </div>
                            <div>
                                <p className="font-bold">Calling</p>
                                <Markdown>{character.data.calling || "—"}</Markdown>
                            </div>
                            {showBeats && (
                                <div>
                                    <p className="font-bold">Active beats</p>
                                    <Markdown>{character.data.activeBeats || "—"}</Markdown>
                                </div>
                            )}
                        </SheetSection>
                        <SheetSection title="Stress & protections">
                            <ReadOnlyStressCounter stress={character.data.stress} protections={character.data.protections} />
                        </SheetSection>
                        <SheetSection title="Fallout">
                            <Markdown>{character.data.fallout || "None recorded"}</Markdown>
                        </SheetSection>
                        <SheetSection title="Abilities">
                            <Markdown>{character.data.abilities || "—"}</Markdown>
                        </SheetSection>
                        <SheetSection title="Skills">
                            <Markdown>{selectedFeaturesMarkdown(character.data.skills)}</Markdown>
                        </SheetSection>
                        <SheetSection title="Domains">
                            <Markdown>{selectedFeaturesMarkdown(character.data.domains)}</Markdown>
                        </SheetSection>
                        <SheetSection
                            title="Equipment"
                            tagReference={{
                                title: "EQUIPMENT TAGS IN USE",
                                tags: equipmentTags,
                                primaryText: character.data.equipment,
                                primarySourceLabel: "Equipment",
                            }}
                        >
                            <Markdown>{character.data.equipment || "—"}</Markdown>
                        </SheetSection>
                        <SheetSection
                            title="Resources"
                            tagReference={{
                                title: "RESOURCE TAGS IN USE",
                                tags: resourceTags,
                                primaryText: character.data.resources,
                                primarySourceLabel: "Resources",
                            }}
                        >
                            <Markdown>{character.data.resources || "—"}</Markdown>
                        </SheetSection>
                    </div>
                </DialogContent>
            )}
        </Dialog>
    )
}

type TagReference = {
    title: string
    tags: ReferenceTag[]
    primaryText: string
    primarySourceLabel: string
}

function SheetSection({ title, children, tagReference }: { title: string; children: React.ReactNode; tagReference?: TagReference }) {
    const heading = (
        <h3 className="flex min-h-10 items-center justify-between gap-3 bg-red-900 px-3 py-2 font-black tracking-wide text-white">
            {title.toUpperCase()}
            {tagReference && (
                <DialogTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-white hover:bg-red-800 hover:text-white"
                        aria-label={`View ${title.toLowerCase()} tags in use`}
                        title={`View ${title.toLowerCase()} tags in use`}
                    >
                        <BookOpen className="size-5" />
                    </Button>
                </DialogTrigger>
            )}
        </h3>
    )

    return (
        <section className="overflow-hidden border border-border bg-background/35 text-left">
            {tagReference ? (
                <Dialog>
                    {heading}
                    <TagReferenceDialog {...tagReference} relevantOnly />
                </Dialog>
            ) : (
                heading
            )}
            <div className="space-y-3 p-4 text-sm">{children}</div>
        </section>
    )
}
