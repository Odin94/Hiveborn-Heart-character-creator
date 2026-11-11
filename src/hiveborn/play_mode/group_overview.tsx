import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Markdown } from "@/components/ui/markdown"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HeartSigil } from "@/components/ui/sigil"
import { Hint, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api, API_URL, tokenStorage, type CloudCharacter, type GroupCharacter, type PlayGroup, type PlayGroupInvitation, type User } from "@/lib/api"
import { usePlayModeStore } from "@/lib/playMode"
import { receiveRemoteCharacter } from "@/lib/characterSync"
import { cn } from "@/lib/utils"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import { ReadOnlyStressCounter } from "@/hiveborn/character_sheet/components/stress_counter/stress_counter"
import { TagReferenceDialog, type ReferenceTag } from "@/hiveborn/character_sheet/components/shared/tag_reference_dialog"
import { equipmentTags } from "@/hiveborn/game_data/equipment_tags"
import { resourceTags } from "@/hiveborn/game_data/resource_tags"
import { resistances } from "@/hiveborn/game_data/resistances"
import { falloutOptions, falloutSeverities, type Fallout as FalloutOption } from "@/hiveborn/game_data/fallout"
import { falloutRollOverlayLifetimeMs } from "./fallout_timing"
import { PlayCardSkeleton, PlayModeSkeleton } from "./play_skeleton"
import { useShallow } from "zustand/react/shallow"
import {
    BookOpen,
    Check,
    Crown,
    Dices,
    Eye,
    Info,
    Link2,
    LogIn,
    MailPlus,
    Package,
    Plus,
    RotateCw,
    ShieldAlert,
    UserMinus,
    UserPlus,
    Users,
    X,
} from "lucide-react"
import {
    createContext,
    Fragment,
    useContext,
    lazy,
    memo,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type MouseEvent,
    type ReactNode,
} from "react"
import { toast } from "sonner"

const PlayClockContext = createContext<number | null>(null)

const loadFalloutDie = () => import("./fallout_die")
const FalloutDie = lazy(loadFalloutDie)

type GroupOverviewProps = { user: User; selectedGroupId?: string; onClose: () => void; onSelectGroup: (groupId: string) => void }
type CharacterWithOwner = GroupCharacter & { ownerId: string; nickname: string | null; isOnline: boolean }
type FalloutRoll = { characterName: string; roll: number; fallout: "minor" | "major" | null }
type LiveGroupEvent =
    | { type: "character.updated"; userId: string; character: GroupCharacter }
    | { type: "character.deleted"; userId: string; characterId: string }
    | { type: "member.presence"; userId: string; online: boolean }
    | { type: "roll.shared" | "fallout.rolled" | "group.members.updated" }
type LoadState = "loading" | "ready" | "error"
type LiveStatus = "connecting" | "live" | "reconnecting" | "offline"
type Member = PlayGroup["members"][number]

const lastGroupStorageKey = (userId: string) => `hiveborn-last-play-group:${window.location.origin}:${userId}`
const otherPlayersBeatsStorageKey = (userId: string) => `hiveborn-show-other-players-beats:${window.location.origin}:${userId}`
const ROLL_LIFETIME_MS = 10 * 60 * 1_000
const ROLL_FADE_TICK_MS = 10 * 1_000

const totalStress = (character: GroupCharacter) => Object.values(character.data.stress).reduce((sum, value) => sum + value, 0)
const rollCharacterName = (character: Pick<CloudCharacter, "name">) => character.name || "Unnamed hiveborn"
const rollAge = (createdAt: string, now: number) => Math.max(0, now - new Date(createdAt).getTime())
const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)
const relativeTime = (date: string, now = Date.now()) => {
    const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1_000))
    if (seconds < 10) return "just now"
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    return `${Math.floor(minutes / 60)}h ago`
}
const initialOf = (name: string | null | undefined) => (name?.trim()[0] ?? "?").toUpperCase()
const groupHref = (groupId: string) => `/play/${encodeURIComponent(groupId)}`

/** Each calling-class gets an accent drawn from the palette: crimson, honey, verdigris or Vermissian iron. */
const classAccents: Record<string, string> = {
    Cleaver: "var(--hb-crimson-500)",
    Deadwalker: "var(--hb-verdigris-500)",
    "Deep Apiarist": "var(--hb-honey-500)",
    Heretic: "var(--hb-honey-700)",
    Hound: "var(--hb-iron-300)",
    Incarnadine: "var(--hb-honey-400)",
    "Junk Mage": "var(--hb-verdigris-300)",
    "Vermissian Knight": "var(--hb-iron-400)",
    Witch: "var(--hb-crimson-700)",
}
const classAccent = (characterClass: string) => classAccents[characterClass] ?? "var(--border-strong)"

const selectedFeaturesMarkdown = (features: Record<string, { hasSkill?: boolean; hasDomain?: boolean; knacks: string }>) => {
    const selectedFeatures = Object.entries(features).filter(([, feature]) => feature.hasSkill || feature.hasDomain)
    return selectedFeatures.map(([name, feature]) => `- **${name}**${feature.knacks ? ` — ${feature.knacks}` : ""}`).join("\n") || "—"
}

/** Plain left-click navigates in-app; modified clicks keep the browser's "open in new tab" behavior. */
const handleGroupLinkClick = (event: MouseEvent<HTMLAnchorElement>, groupId: string, onSelectGroup: (groupId: string) => void) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onSelectGroup(groupId)
}

const copyGroupLink = (groupId: string) => {
    const href = new URL(groupHref(groupId), window.location.origin).href
    navigator.clipboard.writeText(href).then(
        () => toast.success("Link copied"),
        () => toast.error("Could not copy the link"),
    )
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

// Every server sheet mutation advances its version; HTTP JSON decoding alone
// must not invalidate otherwise unchanged sheet subtrees. Keep response metadata
// fresh (membership, permissions, names and presence), sharing only sheet data.
function preserveGroupSheetData(current: PlayGroup[], next: PlayGroup[]) {
    const previousSheets = new Map(
        current.flatMap((group) => group.members.flatMap((member) => member.characters.map((character) => [character.id, character] as const))),
    )
    return next.map((group) => ({
        ...group,
        members: group.members.map((member) => ({
            ...member,
            characters: member.characters.map((character) => {
                const previous = previousSheets.get(character.id)
                return previous && previous.version === character.version && previous.updatedAt === character.updatedAt && previous.name === character.name
                    ? { ...character, data: previous.data }
                    : character
            }),
        })),
    }))
}

function sameCharacterSnapshot(a: CharacterWithOwner | null, b: CharacterWithOwner | null) {
    return (
        a === b ||
        Boolean(
            a &&
            b &&
            a.id === b.id &&
            a.version === b.version &&
            a.name === b.name &&
            a.data === b.data &&
            a.updatedAt === b.updatedAt &&
            a.ownerId === b.ownerId &&
            a.nickname === b.nickname &&
            a.isOnline === b.isOnline,
        )
    )
}

export default function GroupOverview({ user, selectedGroupId, onClose, onSelectGroup }: GroupOverviewProps) {
    const [groups, setGroups] = useState<PlayGroup[]>([])
    const [ownCharacters, setOwnCharacters] = useState<CloudCharacter[]>([])
    const [invitations, setInvitations] = useState<PlayGroupInvitation[]>([])
    const [groupsState, setGroupsState] = useState<LoadState>("loading")
    const [groupsError, setGroupsError] = useState<string | null>(null)
    const [charactersState, setCharactersState] = useState<LoadState>("loading")
    const [charactersError, setCharactersError] = useState<string | null>(null)
    const [liveStatus, setLiveStatus] = useState<LiveStatus>("connecting")
    const [createName, setCreateName] = useState("")
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [inviteNickname, setInviteNickname] = useState("")
    const [declineTarget, setDeclineTarget] = useState<PlayGroupInvitation | null>(null)
    const [selectedCharacter, setSelectedCharacter] = useState<CharacterWithOwner | null>(null)
    const [autoUpdateStress, setAutoUpdateStress] = useState(true)
    const [falloutRoll, setFalloutRoll] = useState<FalloutRoll | null>(null)
    const [rollingFalloutCharacterId, setRollingFalloutCharacterId] = useState<string | null>(null)
    const [manualFalloutPickerOpen, setManualFalloutPickerOpen] = useState(false)
    const [selectedFallout, setSelectedFallout] = useState<FalloutOption | null>(null)
    const [assigningFallout, setAssigningFallout] = useState(false)
    const [rollAgeUpdatedAt, setRollAgeUpdatedAt] = useState(() => Date.now())
    const [showOtherPlayersBeats, setShowOtherPlayersBeats] = useState(() => localStorage.getItem(otherPlayersBeatsStorageKey(user.id)) === "true")
    const refreshTimer = useRef<number | undefined>(undefined)
    const groupsLoaded = useRef(false)
    const charactersLoaded = useRef(false)
    const setActiveGroup = usePlayModeStore((state) => state.setActiveGroup)
    const cloudIds = useCharacterStore.use.cloudCharacterIds()
    const localCharacterNames = useCharacterStore(useShallow((state) => state.characters.map((character) => character.name)))
    const currentCharacterIndex = useCharacterStore.use.currentCharacterIndex()
    const setCurrentCharacter = useCharacterStore.use.setCurrentCharacter()

    const refresh = useCallback(async () => {
        // Groups and the player's own sheets load independently: one failing never hides the other.
        const [groupsResult, charactersResult] = await Promise.allSettled([api.groups(), api.characters()])
        if (groupsResult.status === "fulfilled") {
            groupsLoaded.current = true
            setGroups((current) => preserveGroupSheetData(current, groupsResult.value.groups))
            setRollAgeUpdatedAt(Date.now())
            setInvitations(groupsResult.value.invitations)
            setGroupsState("ready")
            setGroupsError(null)
        } else {
            const message = errorMessage(groupsResult.reason, "Could not load play groups")
            // Keep showing what we have; a background failure only gets a toast.
            if (groupsLoaded.current) toast.error(message)
            else {
                setGroupsError(message)
                setGroupsState("error")
            }
        }
        if (charactersResult.status === "fulfilled") {
            charactersLoaded.current = true
            setOwnCharacters(charactersResult.value.characters)
            setCharactersState("ready")
            setCharactersError(null)
        } else if (!charactersLoaded.current) {
            setCharactersError(errorMessage(charactersResult.reason, "Could not load your sheets"))
            setCharactersState("error")
        }
    }, [])
    const retry = useCallback(() => {
        if (!groupsLoaded.current) setGroupsState("loading")
        if (!charactersLoaded.current) setCharactersState("loading")
        void refresh()
    }, [refresh])
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
        setLiveStatus("connecting")
        const connect = () => {
            const url = new URL(API_URL)
            url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
            url.pathname = `/play-groups/${group.id}/live`
            url.search = ""
            socket = new WebSocket(url)
            socket.onopen = () => {
                setLiveStatus("live")
                socket?.send(JSON.stringify({ type: "auth", token: tokenStorage.get() }))
            }
            socket.onmessage = (message) => {
                try {
                    const event = JSON.parse(message.data) as LiveGroupEvent
                    setGroups((current) => applyLiveCharacterUpdate(current, group.id, event))
                    if (event.type === "character.updated" && event.userId === user.id) {
                        receiveRemoteCharacter(event.character, user.id)
                    }
                } catch {
                    // A malformed live event never prevents the authoritative refresh below.
                }
                scheduleRefresh()
            }
            socket.onclose = (event) => {
                if (closed) return
                // Authentication and membership failures will not recover by
                // reconnecting; transient network/server closes will.
                if (event.code === 1008) {
                    setLiveStatus("offline")
                    return
                }
                setLiveStatus("reconnecting")
                reconnectTimer = window.setTimeout(connect, 1_500)
            }
        }
        connect()
        return () => {
            closed = true
            if (reconnectTimer) window.clearTimeout(reconnectTimer)
            socket?.close()
        }
    }, [group?.id, scheduleRefresh, user.id])

    const createGroup = async () => {
        try {
            const created = await api.createGroup(createName)
            setCreateName("")
            setCreateDialogOpen(false)
            await refresh()
            onSelectGroup(created.id)
            toast.success("Play group created")
        } catch (error) {
            toast.error(errorMessage(error, "Could not create group"))
        }
    }
    const invite = async () => {
        if (!group) return
        try {
            await api.invite(group.id, inviteNickname)
            setInviteNickname("")
            toast.success("Invitation sent")
        } catch (error) {
            toast.error(errorMessage(error, "Could not invite that player"))
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
            toast.error(errorMessage(error, "Could not update invitation"))
        }
    }
    const assignGameMaster = async (memberId: string, isGameMaster: boolean) => {
        if (!group) return
        try {
            await api.setGameMaster(group.id, memberId, isGameMaster)
            await refresh()
        } catch (error) {
            toast.error(errorMessage(error, "Could not update game master"))
        }
    }
    const assignCharacter = useCallback(
        async (character: CloudCharacter) => {
            if (!activeGroupId) return
            try {
                await api.assignCharacter(activeGroupId, character.id)
                await refresh()
                toast.success(`${rollCharacterName(character)} added to this group`)
            } catch (error) {
                toast.error(errorMessage(error, "Could not add that character"))
            }
        },
        [activeGroupId, refresh],
    )
    const removeCharacter = useCallback(
        async (character: CloudCharacter) => {
            if (!activeGroupId) return
            try {
                await api.removeCharacterFromGroup(activeGroupId, character.id)
                await refresh()
                // Removing a sheet from a table is reversible: offer Undo instead of a confirmation.
                toast.success(`${rollCharacterName(character)} removed from this group`, {
                    action: { label: "Undo", onClick: () => void assignCharacter(character) },
                })
            } catch (error) {
                toast.error(errorMessage(error, "Could not remove that character"))
            }
        },
        [activeGroupId, assignCharacter, refresh],
    )
    const removeGroupCharacter = useCallback((character: CharacterWithOwner) => void removeCharacter(character), [removeCharacter])
    const openCharacter = useCallback(
        (character: CharacterWithOwner) => {
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
        },
        [cloudIds, setCurrentCharacter, onClose, user.id],
    )
    const setOtherPlayersBeats = (showBeats: boolean) => {
        setShowOtherPlayersBeats(showBeats)
        localStorage.setItem(otherPlayersBeatsStorageKey(user.id), String(showBeats))
    }
    const rollFallout = useCallback(
        async (character: CharacterWithOwner) => {
            if (!activeGroupId) return
            setRollingFalloutCharacterId(character.id)
            try {
                // Handle the optional chunk immediately: a failed animation must not
                // skip reconciliation after the server has applied stress changes.
                const animation = loadFalloutDie().then(
                    () => true,
                    () => false,
                )
                const result = await api.falloutRoll(activeGroupId, { characterId: character.id, applyStressUpdate: autoUpdateStress })
                if (await animation) {
                    setFalloutRoll({ characterName: rollCharacterName(character), roll: result.roll, fallout: result.fallout })
                    await new Promise<void>((resolve) => window.setTimeout(resolve, falloutRollOverlayLifetimeMs))
                }
                const stressUpdate =
                    result.stressUpdate?.type === "all"
                        ? "set all stress to 0"
                        : result.stressUpdate
                          ? `set ${result.stressUpdate.resistance} stress to 0`
                          : null
                const message = result.fallout
                    ? `${character.name}: ${result.fallout.toUpperCase()} fallout (${result.roll} vs ${result.totalStress} stress)${stressUpdate ? ` — ${stressUpdate}` : ""}`
                    : `${character.name}: no fallout (${result.roll} vs ${result.totalStress} stress)`
                toast(message)
                await refresh()
            } catch (error) {
                toast.error(errorMessage(error, "Could not roll fallout"))
            } finally {
                setFalloutRoll(null)
                setRollingFalloutCharacterId(null)
            }
        },
        [activeGroupId, autoUpdateStress, refresh],
    )

    const characters = useMemo<CharacterWithOwner[]>(
        () =>
            group?.members.flatMap((member) =>
                member.characters.map((character) => ({ ...character, ownerId: member.id, nickname: member.nickname, isOnline: member.isOnline })),
            ) ?? [],
        [group?.members],
    )
    const selectedCharacterView = selectedCharacter ? (characters.find((character) => character.id === selectedCharacter.id) ?? null) : null
    const closeCharacterModal = useCallback(() => setSelectedCharacter(null), [])
    const assignedOwnCharacterIds = new Set(activeGroupCharacterIdsKey ? activeGroupCharacterIdsKey.split(",") : [])
    const unassignedOwnCharacters = ownCharacters.filter((character) => !assignedOwnCharacterIds.has(character.id))
    const isGameMaster = group?.members.find((member) => member.id === user.id)?.isGameMaster ?? false
    const isGroupOwner = group?.ownerId === user.id
    const visibleRolls = useMemo(
        () => group?.rolls.filter((roll) => rollAge(roll.createdAt, rollAgeUpdatedAt) < ROLL_LIFETIME_MS) ?? [],
        [group?.rolls, rollAgeUpdatedAt],
    )
    const groupEquipment = useMemo(() => characters.map((character) => character.data.equipment).join("\n"), [characters])
    const groupResources = useMemo(() => characters.map((character) => character.data.resources).join("\n"), [characters])
    const groupCreationKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter" || !createName.trim()) return
        event.preventDefault()
        void createGroup()
    }
    const assignFallout = async (fallout: FalloutOption, characterId: string | undefined, autoAssign = false, fallbackOnEligibilityConflict = false) => {
        if (!group) return
        if (assigningFallout) return
        setAssigningFallout(true)
        try {
            const assignment = await api.assignFallout(group.id, {
                characterId,
                autoAssign,
                fallout: { name: fallout.name, description: fallout.description },
            })
            setSelectedFallout(null)
            setManualFalloutPickerOpen(false)
            await refresh()
            const characterName = rollCharacterName(assignment.character)
            if (assignment.matched && assignment.rollId) {
                toast.success(`Auto-added ${fallout.name} to ${characterName} because it matched recent fallout roll`, {
                    action: { label: "Undo", onClick: () => void undoFalloutAssignment(assignment.rollId!) },
                })
            } else {
                toast.success(`Added ${fallout.name} to ${characterName}`)
            }
        } catch (error) {
            if (fallbackOnEligibilityConflict && (error as { status?: number }).status === 409) {
                setSelectedFallout(fallout)
                setManualFalloutPickerOpen(true)
                return
            }
            toast.error(errorMessage(error, "Could not assign fallout"))
        } finally {
            setAssigningFallout(false)
        }
    }
    const undoFalloutAssignment = async (rollId: string) => {
        if (!group) return
        try {
            await api.undoFalloutAssignment(group.id, rollId)
            await refresh()
            toast.success("Fallout assignment undone")
        } catch (error) {
            toast.error(errorMessage(error, "Could not undo fallout assignment"))
        }
    }
    const selectFallout = (fallout: FalloutOption) => {
        void assignFallout(fallout, undefined, true, true)
    }
    const hasFadingRolls = visibleRolls.length > 0
    useEffect(() => {
        if (!hasFadingRolls) return

        setRollAgeUpdatedAt(Date.now())
        const interval = window.setInterval(() => setRollAgeUpdatedAt(Date.now()), ROLL_FADE_TICK_MS)
        return () => window.clearInterval(interval)
    }, [group?.id, hasFadingRolls])

    if (groupsState === "loading") return <PlayModeSkeleton />

    const invitationList = (
        <InvitationList invitations={invitations} onAccept={(invitation) => void respondToInvitation(invitation, true)} onDecline={setDeclineTarget} />
    )
    const onlineCount = group?.members.filter((member) => member.isOnline).length ?? 0

    return (
        <div className="play-shell">
            <aside className="play-rail max-lg:hidden" aria-label="Play groups">
                <div className="mb-3 flex items-center justify-between gap-2 pl-1">
                    <h2 className="eyebrow">Play groups</h2>
                    <Hint label="New play group">
                        <Button variant="ghost" size="icon-xs" aria-label="Create a new play group" onClick={() => setCreateDialogOpen(true)}>
                            <Plus />
                        </Button>
                    </Hint>
                </div>
                {groupsState === "error" ? (
                    <RequestError message={groupsError} onRetry={retry} />
                ) : (
                    <GroupList groups={groups} selectedGroupId={selectedGroupId} userId={user.id} onSelectGroup={onSelectGroup} />
                )}
                {invitations.length > 0 && <div className="mt-6">{invitationList}</div>}
                <Button variant="outline" className="mt-6 w-full justify-start" onClick={() => setCreateDialogOpen(true)}>
                    <Plus /> Create group
                </Button>
            </aside>

            <main className="play-main" aria-labelledby={group ? "play-table-title" : undefined}>
                {groups.length > 0 && (
                    <div className="play-switcher lg:hidden">
                        <Select value={group?.id} onValueChange={(value) => value && onSelectGroup(value)}>
                            <SelectTrigger aria-label="Play group" className="min-w-0 flex-1">
                                <SelectValue placeholder="Choose a play group" />
                            </SelectTrigger>
                            <SelectContent>
                                {groups.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>
                                        {entry.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Hint label="New play group">
                            <Button variant="secondary" size="icon" aria-label="Create a new play group" onClick={() => setCreateDialogOpen(true)}>
                                <Plus />
                            </Button>
                        </Hint>
                    </div>
                )}
                {invitations.length > 0 && <div className="mb-6 lg:hidden">{invitationList}</div>}

                {groupsState === "error" ? (
                    <div className="mx-auto max-w-md pt-10 lg:hidden">
                        <RequestError message={groupsError} onRetry={retry} />
                    </div>
                ) : !group ? (
                    groups.length && selectedGroupId ? (
                        <EmptyState
                            title="This group isn’t available"
                            description="It may have been removed, or you’re no longer a member."
                            action={
                                <Button variant="secondary" onClick={() => onSelectGroup(groups[0]!.id)}>
                                    Go to {groups[0]!.name}
                                </Button>
                            }
                        />
                    ) : groups.length ? (
                        <EmptyState title="Choose a play group" description="Pick a group to join its live table." />
                    ) : (
                        <EmptyState
                            title="Start a play group"
                            description="Set your nickname in the account menu, then create a group and invite players by nickname."
                            action={
                                <form
                                    className="flex w-full max-w-sm gap-2"
                                    onSubmit={(event) => {
                                        event.preventDefault()
                                        if (createName.trim()) void createGroup()
                                    }}
                                >
                                    <Input
                                        value={createName}
                                        onChange={(event) => setCreateName(event.target.value)}
                                        placeholder="Group name"
                                        aria-label="Group name"
                                    />
                                    <Hint label="Name the group first" wrap disabled={Boolean(createName.trim())}>
                                        <Button type="submit" disabled={!createName.trim()}>
                                            Create
                                        </Button>
                                    </Hint>
                                </form>
                            }
                        />
                    )
                ) : (
                    <>
                        <header className="play-header">
                            <div className="min-w-0">
                                <p className="eyebrow flex items-center gap-2">
                                    <LiveIndicator status={liveStatus} />
                                    {isGameMaster && (
                                        <span className="inline-flex items-center gap-1 text-honey">
                                            <Crown className="size-3.5" aria-hidden="true" /> Game master
                                        </span>
                                    )}
                                </p>
                                <h1 id="play-table-title" className="title-display mt-2 break-words">
                                    {group.name}
                                </h1>
                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                                    <MemberSeals members={group.members} />
                                    <span>
                                        <span className="font-semibold text-foreground tabular-nums">{onlineCount}</span> of {group.members.length} online
                                    </span>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                <TableReferenceActions
                                    groupEquipment={groupEquipment}
                                    groupResources={groupResources}
                                    isGameMaster={isGameMaster}
                                    onSelectFallout={selectFallout}
                                />
                            </div>
                        </header>

                        <div className="play-settings">
                            <label className="play-toggle">
                                <Checkbox checked={showOtherPlayersBeats} onCheckedChange={(checked) => setOtherPlayersBeats(checked === true)} />
                                <span>Show me other players’ beats</span>
                            </label>
                            {isGameMaster && (
                                <span className="inline-flex items-center gap-1">
                                    <label className="play-toggle">
                                        <Checkbox checked={autoUpdateStress} onCheckedChange={(checked) => setAutoUpdateStress(checked === true)} />
                                        <span>Auto-update stress after fallout</span>
                                    </label>
                                    <Hint label="Off lets the player update their own sheet.">
                                        <button type="button" className="play-info" aria-label="About auto-updating stress">
                                            <Info className="size-3.5" />
                                        </button>
                                    </Hint>
                                </span>
                            )}
                            {localCharacterNames.length > 0 && (
                                <div className="flex w-full items-center gap-2 sm:w-auto lg:hidden">
                                    <Label htmlFor="mobile-group-character" className="shrink-0 text-muted-foreground">
                                        Sheet
                                    </Label>
                                    <Select value={String(currentCharacterIndex)} onValueChange={(value) => setCurrentCharacter(Number(value))}>
                                        <SelectTrigger id="mobile-group-character" size="sm" className="min-w-0 flex-1 sm:w-48">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {localCharacterNames.map((name, index) => (
                                                <SelectItem key={cloudIds[index] || index} value={String(index)}>
                                                    {name || `Character ${index + 1}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <PlayClockContext.Provider value={rollAgeUpdatedAt}>
                            <CharacterCards
                                characters={characters}
                                userId={user.id}
                                gameMaster={isGameMaster}
                                rollingId={rollingFalloutCharacterId}
                                onOpen={openCharacter}
                                onFallout={rollFallout}
                                onRemove={removeGroupCharacter}
                                showBeats={showOtherPlayersBeats}
                                seat={
                                    assignedOwnCharacterIds.size === 0 && unassignedOwnCharacters.length > 0 ? (
                                        <EmptySeat characters={unassignedOwnCharacters} onAdd={(character) => void assignCharacter(character)} />
                                    ) : charactersState === "loading" && characters.length === 0 ? (
                                        <PlayCardSkeleton />
                                    ) : null
                                }
                                onCreateSheet={onClose}
                            />
                        </PlayClockContext.Provider>
                    </>
                )}
            </main>

            {group && (
                <aside className="play-aside" aria-label="Table activity and members">
                    <RollFeed characters={characters} rolls={visibleRolls} now={rollAgeUpdatedAt} />
                    <Roster
                        group={group}
                        userId={user.id}
                        isGroupOwner={isGroupOwner}
                        onToggleGameMaster={(member, value) => void assignGameMaster(member.id, value)}
                        inviteNickname={inviteNickname}
                        onInviteNicknameChange={setInviteNickname}
                        onInvite={() => void invite()}
                    />
                    <OwnSheets
                        state={charactersState}
                        error={charactersError}
                        onRetry={retry}
                        characters={ownCharacters}
                        assignedIds={assignedOwnCharacterIds}
                        onAdd={(character) => void assignCharacter(character)}
                        onRemove={(character) => void removeCharacter(character)}
                    />
                </aside>
            )}

            <CharacterSheetModal character={selectedCharacterView} showBeats={showOtherPlayersBeats} onClose={closeCharacterModal} />
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>New play group</DialogTitle>
                        <DialogDescription>Invite players by nickname once it’s created.</DialogDescription>
                    </DialogHeader>
                    <Input
                        autoFocus
                        value={createName}
                        onChange={(event) => setCreateName(event.target.value)}
                        onKeyDown={groupCreationKeyDown}
                        placeholder="New group name"
                        aria-label="Group name"
                    />
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="secondary">Cancel</Button>
                        </DialogClose>
                        <Hint label="Name the group first" wrap disabled={Boolean(createName.trim())}>
                            <Button disabled={!createName.trim()} onClick={() => void createGroup()}>
                                <Plus /> Create group
                            </Button>
                        </Hint>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmDialog
                open={Boolean(declineTarget)}
                onOpenChange={(open) => !open && setDeclineTarget(null)}
                title={`Decline ${declineTarget?.group.name ?? "this invitation"}?`}
                description={
                    declineTarget?.invitedByNickname
                        ? `${declineTarget.invitedByNickname} would have to invite you again.`
                        : "You would need a new invitation to join."
                }
                confirmLabel="Decline"
                onConfirm={() => (declineTarget ? respondToInvitation(declineTarget, false) : undefined)}
            />
            <Dialog open={manualFalloutPickerOpen} onOpenChange={setManualFalloutPickerOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign {selectedFallout?.name ?? "fallout"}</DialogTitle>
                        <DialogDescription>
                            No matching unassigned fallout roll was found in the last minute. Choose the character who should receive this fallout.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-1.5">
                        {characters.map((character) => (
                            <button
                                key={character.id}
                                type="button"
                                className="play-pick"
                                style={{ "--class-accent": classAccent(character.data.characterClass) } as CSSProperties}
                                disabled={assigningFallout}
                                onClick={() => selectedFallout && void assignFallout(selectedFallout, character.id)}
                            >
                                <span className="play-pick-accent" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{rollCharacterName(character)}</span>
                                <span className="text-xs text-muted-foreground tabular-nums">{totalStress(character)} stress</span>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
            {falloutRoll && (
                <Suspense fallback={null}>
                    <FalloutDie {...falloutRoll} value={falloutRoll.roll} />
                </Suspense>
            )}
        </div>
    )
}

function LiveIndicator({ status }: { status: LiveStatus }) {
    if (status === "live")
        return (
            <span className="inline-flex items-center gap-1.5">
                <span className="play-live-dot hb-heartbeat" aria-hidden="true" /> Live table
            </span>
        )
    if (status === "reconnecting" || status === "offline")
        return (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="play-live-dot" data-off="" aria-hidden="true" /> {status === "offline" ? "Live updates paused" : "Reconnecting…"}
            </span>
        )
    return <span>Play table</span>
}

function RequestError({ message, onRetry, className }: { message: string | null; onRetry: () => void; className?: string }) {
    return (
        <div role="alert" className={cn("play-error", className)}>
            <p className="min-w-0 flex-1">{message ?? "Something went wrong."}</p>
            <Button variant="secondary" size="sm" onClick={onRetry}>
                <RotateCw /> Retry
            </Button>
        </div>
    )
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return (
        <section className="play-empty">
            <HeartSigil filled={false} className="size-10 text-heart/80" />
            <h1 className="title-display">{title}</h1>
            <p className="max-w-sm text-muted-foreground">{description}</p>
            {action && <div className="mt-2 flex w-full justify-center">{action}</div>}
        </section>
    )
}

function GroupList({
    groups,
    selectedGroupId,
    userId,
    onSelectGroup,
}: {
    groups: PlayGroup[]
    selectedGroupId?: string
    userId: string
    onSelectGroup: (groupId: string) => void
}) {
    if (!groups.length) return <p className="px-1 text-sm text-muted-foreground">No groups yet.</p>
    return (
        <nav className="space-y-0.5">
            {groups.map((entry) => {
                const online = entry.members.filter((member) => member.isOnline).length
                const selected = entry.id === selectedGroupId
                return (
                    <ContextMenu key={entry.id}>
                        <ContextMenuTrigger asChild>
                            <a
                                href={groupHref(entry.id)}
                                aria-current={selected ? "page" : undefined}
                                className="play-group-link"
                                onClick={(event) => handleGroupLinkClick(event, entry.id, onSelectGroup)}
                            >
                                <span className="play-hex play-hex-sm" aria-hidden="true">
                                    {initialOf(entry.name)}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-semibold">{entry.name}</span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {entry.members.length === 1 ? "1 member" : `${entry.members.length} members`}
                                        {online > 0 && ` · ${online} online`}
                                        {entry.ownerId === userId && " · yours"}
                                    </span>
                                </span>
                            </a>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                            <ContextMenuItem onSelect={() => onSelectGroup(entry.id)}>
                                <Users /> Open table
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => copyGroupLink(entry.id)}>
                                <Link2 /> Copy link
                            </ContextMenuItem>
                        </ContextMenuContent>
                    </ContextMenu>
                )
            })}
        </nav>
    )
}

function InvitationList({
    invitations,
    onAccept,
    onDecline,
}: {
    invitations: PlayGroupInvitation[]
    onAccept: (invitation: PlayGroupInvitation) => void
    onDecline: (invitation: PlayGroupInvitation) => void
}) {
    if (!invitations.length) return null
    return (
        <section aria-labelledby="play-invitations-title">
            <h2 id="play-invitations-title" className="eyebrow mb-2 flex items-center gap-1.5 pl-1">
                <MailPlus className="size-3.5" aria-hidden="true" /> Play group invitations
            </h2>
            <ul className="space-y-2">
                {invitations.map((invitation) => (
                    <ContextMenu key={invitation.group.id}>
                        <ContextMenuTrigger asChild>
                            <li className="play-invite">
                                <p className="min-w-0 text-sm">
                                    <span className="block truncate font-display text-lg leading-tight font-semibold">{invitation.group.name}</span>
                                    {invitation.invitedByNickname && (
                                        <span className="text-xs text-muted-foreground">invited by {invitation.invitedByNickname}</span>
                                    )}
                                </p>
                                <div className="flex gap-1.5">
                                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => onDecline(invitation)}>
                                        Decline
                                    </Button>
                                    <Button size="sm" className="flex-1" onClick={() => onAccept(invitation)}>
                                        Accept
                                    </Button>
                                </div>
                            </li>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                            <ContextMenuItem onSelect={() => onAccept(invitation)}>
                                <Check /> Accept
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem variant="destructive" onSelect={() => onDecline(invitation)}>
                                <X /> Decline…
                            </ContextMenuItem>
                        </ContextMenuContent>
                    </ContextMenu>
                ))}
            </ul>
        </section>
    )
}

function MemberSeals({ members }: { members: Member[] }) {
    const shown = members.slice(0, 6)
    return (
        <span className="flex items-center -space-x-1.5" aria-hidden="true">
            {shown.map((member) => (
                <span key={member.id} className="play-hex play-hex-sm" data-online={member.isOnline || undefined}>
                    {initialOf(member.nickname)}
                </span>
            ))}
            {members.length > shown.length && <span className="pl-3 text-xs">+{members.length - shown.length}</span>}
        </span>
    )
}

function TableReferenceActions({
    groupEquipment,
    groupResources,
    isGameMaster,
    onSelectFallout,
}: {
    groupEquipment: string
    groupResources: string
    isGameMaster: boolean
    onSelectFallout: (fallout: FalloutOption) => void
}) {
    const [falloutReferenceOpen, setFalloutReferenceOpen] = useState(false)
    return (
        <>
            <Dialog>
                <Hint label="Equipment tags in use">
                    <DialogTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="Open equipment tags for this group">
                            <BookOpen />
                        </Button>
                    </DialogTrigger>
                </Hint>
                <TagReferenceDialog title="GROUP EQUIPMENT TAGS" tags={equipmentTags} primaryText={groupEquipment} primarySourceLabel="In use" />
            </Dialog>
            <Dialog>
                <Hint label="Resource tags in use">
                    <DialogTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="Open resource tags for this group">
                            <Package />
                        </Button>
                    </DialogTrigger>
                </Hint>
                <TagReferenceDialog title="GROUP RESOURCE TAGS" tags={resourceTags} primaryText={groupResources} primarySourceLabel="In use" />
            </Dialog>
            {isGameMaster && (
                <Dialog open={falloutReferenceOpen} onOpenChange={setFalloutReferenceOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" aria-label="Open fallout assignment reference">
                            <ShieldAlert /> <span className="max-sm:hidden">Assign fallout</span>
                        </Button>
                    </DialogTrigger>
                    <FalloutReferenceDialog
                        onSelect={(fallout) => {
                            setFalloutReferenceOpen(false)
                            onSelectFallout(fallout)
                        }}
                    />
                </Dialog>
            )}
        </>
    )
}

const severityLabels: Record<FalloutOption["severity"], string> = { minor: "Minor", major: "Major", critical: "Critical" }

function FalloutReferenceDialog({ onSelect }: { onSelect: (fallout: FalloutOption) => void }) {
    return (
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>Fallout</DialogTitle>
                <DialogDescription>Select a fallout to assign it to a character at this table.</DialogDescription>
            </DialogHeader>
            <div className="-mx-1 min-h-0 space-y-5 overflow-y-auto px-1 pb-1">
                {falloutSeverities.map((severity) => {
                    const options = falloutOptions.filter((fallout) => fallout.severity === severity)
                    if (!options.length) return null
                    return (
                        <section key={severity}>
                            <h3 className="eyebrow mb-2">{severityLabels[severity]}</h3>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {options.map((fallout) => (
                                    <button
                                        key={`${fallout.severity}-${fallout.resistance}-${fallout.name}`}
                                        type="button"
                                        className="play-fallout-option"
                                        data-severity={fallout.severity}
                                        onClick={() => onSelect(fallout)}
                                    >
                                        <span className="flex items-baseline justify-between gap-3">
                                            <span className="font-display text-lg leading-tight font-semibold">{fallout.name}</span>
                                            <span className="text-[0.6875rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                                                {fallout.resistance}
                                            </span>
                                        </span>
                                        <span className="mt-1 block text-sm leading-snug text-muted-foreground">{fallout.description}</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )
                })}
            </div>
        </DialogContent>
    )
}

/** "8 (Success)" → { value: "8", outcome: "Success" } so the number can lead. */
const splitRollResult = (result: string) => {
    const match = /^\s*(-?\d+)\s*(?:\((.+)\))?\s*$/.exec(result)
    return match ? { value: match[1]!, outcome: match[2] ?? null } : { value: result, outcome: null }
}

const RollFeed = memo(function RollFeed({ characters, rolls, now }: { characters: CharacterWithOwner[]; rolls: PlayGroup["rolls"]; now: number }) {
    const accents = useMemo(() => new Map(characters.map((character) => [character.id, classAccent(character.data.characterClass)])), [characters])
    const sorted = useMemo(() => [...rolls].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [rolls])
    // Rolls that arrive after the first paint get a brief highlight.
    const seen = useRef<Set<string> | null>(null)
    const fresh = new Set<string>()
    if (seen.current) for (const roll of sorted) if (!seen.current.has(roll.id)) fresh.add(roll.id)
    useEffect(() => {
        seen.current ??= new Set()
        for (const roll of sorted) seen.current.add(roll.id)
    }, [sorted])

    return (
        <section className="play-panel" aria-labelledby="play-activity-title">
            <h2 id="play-activity-title" className="eyebrow mb-3 flex items-center gap-1.5">
                <Dices className="size-3.5" aria-hidden="true" /> Recent table activity
            </h2>
            {sorted.length ? (
                <ol className="space-y-1">
                    {sorted.map((roll) => {
                        const opacity = Math.max(0, 1 - rollAge(roll.createdAt, now) / ROLL_LIFETIME_MS)
                        const { value, outcome } = splitRollResult(roll.result)
                        return (
                            <li
                                key={roll.id}
                                className="play-roll transition-opacity duration-[10000ms] ease-linear motion-reduce:transition-none"
                                data-fresh={fresh.has(roll.id) || undefined}
                                style={{ opacity, "--class-accent": accents.get(roll.characterId ?? "") ?? "var(--border-strong)" } as CSSProperties}
                            >
                                <span className="play-roll-accent" aria-hidden="true" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">{roll.characterName}</span>
                                    <span className="block text-xs text-muted-foreground">
                                        Rolled {roll.dice} for {roll.label} · {relativeTime(roll.createdAt, now)}
                                    </span>
                                </span>
                                <span className="shrink-0 text-right">
                                    <span className="block font-display text-2xl leading-none font-bold text-heart tabular-nums">{value}</span>
                                    {outcome && <span className="block text-[0.6875rem] font-semibold text-muted-foreground">{outcome}</span>}
                                </span>
                            </li>
                        )
                    })}
                </ol>
            ) : (
                <p className="play-quiet">Shared rolls and fallout outcomes will appear here.</p>
            )}
        </section>
    )
})

function Roster({
    group,
    userId,
    isGroupOwner,
    onToggleGameMaster,
    inviteNickname,
    onInviteNicknameChange,
    onInvite,
}: {
    group: PlayGroup
    userId: string
    isGroupOwner: boolean
    onToggleGameMaster: (member: Member, isGameMaster: boolean) => void
    inviteNickname: string
    onInviteNicknameChange: (value: string) => void
    onInvite: () => void
}) {
    const inviteInput = useRef<HTMLInputElement>(null)
    const submitInvite = () => {
        if (!inviteNickname.trim()) return
        onInvite()
        inviteInput.current?.focus()
    }
    return (
        <section className="play-panel" aria-labelledby="play-roster-title">
            <h2 id="play-roster-title" className="eyebrow mb-1 flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden="true" /> Game masters
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
                {isGroupOwner ? "Choose any number of members, or leave the group without a GM." : "Only the group owner can assign game masters."}
            </p>
            <ul className="space-y-0.5">
                {group.members.map((member) => {
                    const name = member.nickname ?? "Player"
                    const row = (
                        <li className="play-member">
                            <span className="play-hex" data-online={member.isOnline || undefined} aria-hidden="true">
                                {initialOf(member.nickname)}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">
                                    {name}
                                    {member.id === userId && <span className="font-normal text-muted-foreground"> (you)</span>}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    {member.isOnline ? "online" : "away"}
                                    {member.id === group.ownerId && " · owner"}
                                </span>
                            </span>
                            {isGroupOwner ? (
                                <label className="play-toggle play-toggle-compact">
                                    <Checkbox
                                        checked={member.isGameMaster}
                                        aria-label={`${name} is a game master`}
                                        onCheckedChange={(checked) => onToggleGameMaster(member, checked === true)}
                                    />
                                    <span>GM</span>
                                </label>
                            ) : member.isGameMaster ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-honey">
                                    <Crown className="size-3.5" aria-hidden="true" /> GM
                                </span>
                            ) : null}
                        </li>
                    )
                    if (!isGroupOwner) return <Fragment key={member.id}>{row}</Fragment>
                    return (
                        <ContextMenu key={member.id}>
                            <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
                            <ContextMenuContent>
                                <ContextMenuItem onSelect={() => onToggleGameMaster(member, !member.isGameMaster)}>
                                    <Crown /> {member.isGameMaster ? "Remove game master" : "Make game master"}
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    )
                })}
            </ul>
            <form
                className="mt-4 flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault()
                    submitInvite()
                }}
            >
                <Input
                    ref={inviteInput}
                    value={inviteNickname}
                    onChange={(event) => onInviteNicknameChange(event.target.value)}
                    placeholder="Player nickname"
                    aria-label="Invite by nickname"
                    className="min-w-0"
                />
                <Hint label="Type a nickname first" wrap disabled={Boolean(inviteNickname.trim())}>
                    <Button type="submit" variant="secondary" disabled={!inviteNickname.trim()}>
                        <UserPlus /> Invite
                    </Button>
                </Hint>
            </form>
        </section>
    )
}

function OwnSheets({
    state,
    error,
    onRetry,
    characters,
    assignedIds,
    onAdd,
    onRemove,
}: {
    state: LoadState
    error: string | null
    onRetry: () => void
    characters: CloudCharacter[]
    assignedIds: Set<string>
    onAdd: (character: CloudCharacter) => void
    onRemove: (character: CloudCharacter) => void
}) {
    return (
        <section className="play-panel" aria-labelledby="play-own-title">
            <h2 id="play-own-title" className="eyebrow mb-3 flex items-center gap-1.5">
                <BookOpen className="size-3.5" aria-hidden="true" /> Your characters in this group
            </h2>
            {state === "loading" ? (
                <div className="space-y-1" aria-hidden="true">
                    {[0, 1].map((row) => (
                        <div key={row} className="flex h-11 items-center gap-3 px-2">
                            <span className="h-3.5 w-36 rounded-md bg-foreground/8" />
                            <span className="ml-auto h-7 w-16 rounded-md bg-foreground/8" />
                        </div>
                    ))}
                </div>
            ) : state === "error" ? (
                <RequestError message={error} onRetry={onRetry} />
            ) : characters.length ? (
                <ul className="space-y-0.5">
                    {characters.map((character) => {
                        const assigned = assignedIds.has(character.id)
                        const toggle = () => (assigned ? onRemove(character) : onAdd(character))
                        return (
                            <ContextMenu key={character.id}>
                                <ContextMenuTrigger asChild>
                                    <li className="play-member" data-assigned={assigned || undefined}>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold">{rollCharacterName(character)}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                {assigned ? "At this table" : character.data.characterClass || "Not at this table"}
                                            </span>
                                        </span>
                                        <Button size="xs" variant={assigned ? "outline" : "secondary"} onClick={toggle}>
                                            {assigned ? "Remove" : "Add"}
                                        </Button>
                                    </li>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                    {assigned ? (
                                        <ContextMenuItem onSelect={toggle}>
                                            <UserMinus /> Remove from this group
                                        </ContextMenuItem>
                                    ) : (
                                        <ContextMenuItem onSelect={toggle}>
                                            <LogIn /> Bring to this group
                                        </ContextMenuItem>
                                    )}
                                </ContextMenuContent>
                            </ContextMenu>
                        )
                    })}
                </ul>
            ) : (
                <p className="play-quiet">Create a character sheet to add it to this group.</p>
            )}
        </section>
    )
}

function SheetUpdatedTime({ updatedAt }: { updatedAt: string }) {
    const now = useContext(PlayClockContext) ?? Date.now()
    return <p className="text-xs text-muted-foreground">Sheet updated {relativeTime(updatedAt, now)}</p>
}

function EmptySeat({ characters, onAdd }: { characters: CloudCharacter[]; onAdd: (character: CloudCharacter) => void }) {
    const [choice, setChoice] = useState(characters[0]!.id)
    const chosen = characters.find((character) => character.id === choice) ?? characters[0]!
    return (
        <div className="play-seat">
            <HeartSigil filled={false} className="size-9 text-heart/70" />
            <div>
                <h2 className="font-display text-xl font-bold">Bring a sheet to the table</h2>
                <p className="mt-1 text-sm text-muted-foreground">Add one of your sheets so it can share rolls and appear for the GM.</p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2">
                {characters.length > 1 && (
                    <Select value={chosen.id} onValueChange={setChoice}>
                        <SelectTrigger aria-label="Sheet to add">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {characters.map((character) => (
                                <SelectItem key={character.id} value={character.id}>
                                    {rollCharacterName(character)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <Button onClick={() => onAdd(chosen)}>
                    <Plus /> Add {rollCharacterName(chosen)}
                </Button>
            </div>
        </div>
    )
}

const CharacterCards = memo(function CharacterCards({
    characters,
    userId,
    gameMaster,
    rollingId,
    onOpen,
    onFallout,
    onRemove,
    showBeats,
    seat,
    onCreateSheet,
}: {
    characters: CharacterWithOwner[]
    userId: string
    gameMaster: boolean
    rollingId: string | null
    onOpen: (character: CharacterWithOwner) => void
    onFallout: (character: CharacterWithOwner) => void
    onRemove: (character: CharacterWithOwner) => void
    showBeats: boolean
    seat: ReactNode
    onCreateSheet: () => void
}) {
    if (!characters.length && !seat)
        return (
            <div className="play-seat">
                <HeartSigil filled={false} className="size-9 text-heart/70" />
                <div>
                    <h2 className="font-display text-xl font-bold">No sheets at this table yet</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Invite players by nickname, or create a character sheet to bring along.</p>
                </div>
                <Button variant="secondary" onClick={onCreateSheet}>
                    <BookOpen /> Character sheets
                </Button>
            </div>
        )
    return (
        <section className="play-cards" aria-label="Characters at this table">
            {characters.map((character) => (
                <CharacterCard
                    key={character.id}
                    character={character}
                    own={character.ownerId === userId}
                    gameMaster={gameMaster}
                    rollingFallout={rollingId === character.id}
                    onOpen={onOpen}
                    onFallout={onFallout}
                    onRemove={onRemove}
                    showBeats={character.ownerId === userId || showBeats}
                />
            ))}
            {seat}
        </section>
    )
})

function ResistanceLedger({ stress, protections }: { stress: GroupCharacter["data"]["stress"]; protections: GroupCharacter["data"]["protections"] }) {
    return (
        <dl className="play-ledger">
            {resistances.map((resistance) => {
                const value = stress[resistance]
                const protection = protections[resistance]
                return (
                    <div
                        key={resistance}
                        className="play-ledger-row"
                        data-active={value > 0 || undefined}
                        aria-label={`${resistance}: ${value} stress, ${protection} protection`}
                    >
                        <dt className="play-ledger-label">{resistance}</dt>
                        <dd className="play-pips" aria-hidden="true">
                            {Array.from({ length: 10 }, (_, index) => (
                                <span key={index} className="play-pip" data-on={index < value || undefined} />
                            ))}
                        </dd>
                        <dd className="play-ledger-value" aria-hidden="true">
                            {value}
                        </dd>
                        <dd className="play-shields" aria-hidden="true">
                            {Array.from({ length: Math.max(protection, 0) }, (_, index) => (
                                <span key={index} className="play-shield" />
                            ))}
                        </dd>
                    </div>
                )
            })}
        </dl>
    )
}

const CharacterCard = memo(
    function CharacterCard({
        character,
        own,
        gameMaster,
        rollingFallout,
        onOpen,
        onFallout,
        onRemove,
        showBeats,
    }: {
        character: CharacterWithOwner
        own: boolean
        gameMaster: boolean
        rollingFallout: boolean
        onOpen: (character: CharacterWithOwner) => void
        onFallout: (character: CharacterWithOwner) => void
        onRemove: (character: CharacterWithOwner) => void
        showBeats: boolean
    }) {
        const data = character.data
        const stress = totalStress(character)
        const falloutDisabled = rollingFallout || stress === 0
        // A soft glow whenever a live update changes this sheet (not on first paint).
        const [pulse, setPulse] = useState(0)
        const [falloutHintOpen, setFalloutHintOpen] = useState(false)
        const firstVersion = useRef(`${character.version}:${character.updatedAt}`)
        const versionKey = `${character.version}:${character.updatedAt}`
        useEffect(() => {
            if (versionKey !== firstVersion.current) setPulse((value) => value + 1)
        }, [versionKey])
        const meta = [data.characterClass, data.calling].filter(Boolean).join(" · ")

        return (
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <article
                        className="play-card group/card"
                        data-own={own || undefined}
                        style={{ "--class-accent": classAccent(data.characterClass) } as CSSProperties}
                        onClick={() => onOpen(character)}
                    >
                        {pulse > 0 && <span key={pulse} className="play-card-pulse" aria-hidden="true" />}
                        <header className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="play-presence" data-online={character.isOnline || undefined}>
                                    <span className="play-presence-dot" aria-hidden="true" />
                                    <span className="truncate">
                                        {own ? "Your character" : (character.nickname ?? "Player")}
                                        {character.isOnline ? " · online" : " · away"}
                                    </span>
                                </p>
                                <h2 className="mt-1.5 font-display text-[1.65rem] leading-[1.05] font-bold break-words">
                                    {character.name || "Unnamed hiveborn"}
                                </h2>
                                <p className="mt-1 truncate text-sm text-muted-foreground">{meta || "No class or calling yet"}</p>
                            </div>
                            <p className="play-stress-total" data-level={stress >= 10 ? "high" : stress > 0 ? "some" : undefined}>
                                <span className="play-stress-number">{stress}</span> <span className="play-stress-label">stress</span>
                            </p>
                        </header>

                        <ResistanceLedger stress={data.stress} protections={data.protections} />

                        <div className="play-note" data-tone="fallout">
                            <p className="play-note-label">Current fallouts</p>
                            <Markdown className="text-sm">{data.fallout || "None recorded"}</Markdown>
                        </div>
                        {showBeats && (
                            <div className="play-note" data-tone="beats">
                                <p className="play-note-label">Active beats</p>
                                <Markdown className="text-sm">{data.activeBeats || "None recorded"}</Markdown>
                            </div>
                        )}

                        <footer className="mt-auto flex flex-wrap items-center gap-2 pt-1" onClick={(event) => event.stopPropagation()}>
                            {gameMaster && (
                                <Tooltip open={falloutDisabled && falloutHintOpen} onOpenChange={setFalloutHintOpen}>
                                    <TooltipTrigger asChild>
                                        <span className="inline-flex" tabIndex={falloutDisabled ? 0 : undefined}>
                                            <Button size="sm" onClick={() => onFallout(character)} disabled={falloutDisabled}>
                                                <Dices /> {rollingFallout ? "Rolling…" : "Roll fallout"}
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>{rollingFallout ? "The fallout die is rolling" : "No stress to roll against"}</TooltipContent>
                                </Tooltip>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => onOpen(character)}>
                                {own ? "Open my sheet" : "View sheet"}
                            </Button>
                            <SheetUpdatedTime updatedAt={character.updatedAt} />
                        </footer>
                    </article>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onSelect={() => onOpen(character)}>
                        {own ? <BookOpen /> : <Eye />} {own ? "Open my sheet" : "View sheet"}
                    </ContextMenuItem>
                    {gameMaster && (
                        <ContextMenuItem disabled={falloutDisabled} onSelect={() => onFallout(character)}>
                            <Dices /> Roll fallout
                        </ContextMenuItem>
                    )}
                    {own && (
                        <>
                            <ContextMenuSeparator />
                            <ContextMenuItem onSelect={() => onRemove(character)}>
                                <UserMinus /> Remove from this group
                            </ContextMenuItem>
                        </>
                    )}
                </ContextMenuContent>
            </ContextMenu>
        )
    },
    (previous, next) => {
        return (
            sameCharacterSnapshot(previous.character, next.character) &&
            previous.own === next.own &&
            previous.gameMaster === next.gameMaster &&
            previous.rollingFallout === next.rollingFallout &&
            previous.showBeats === next.showBeats &&
            previous.onOpen === next.onOpen &&
            previous.onFallout === next.onFallout &&
            previous.onRemove === next.onRemove
        )
    },
)

const CharacterSheetModal = memo(
    function CharacterSheetModal({ character, showBeats, onClose }: { character: CharacterWithOwner | null; showBeats: boolean; onClose: () => void }) {
        return (
            <Dialog open={Boolean(character)} onOpenChange={(open) => !open && onClose()}>
                {character && (
                    <DialogContent
                        // Read-only sheet: start focus on the sheet itself, not on the first tag-reference button (which would pop its tooltip).
                        onOpenAutoFocus={(event) => {
                            event.preventDefault()
                            ;(event.currentTarget as HTMLElement | null)?.focus()
                        }}
                        className="flex max-h-[calc(100dvh-1.5rem-var(--safe-bottom))] max-w-[calc(100vw-1.5rem)] flex-col gap-0 p-0 sm:max-w-[min(72rem,calc(100vw-2rem))] sm:p-0 [&>*]:shrink-0 [&>:has(>[data-slot=dialog-close-button])]:mb-0 [&_[data-slot=dialog-close-button]]:top-3 [&_[data-slot=dialog-close-button]]:right-3"
                    >
                        <DialogHeader className="play-sheet-header" style={{ "--class-accent": classAccent(character.data.characterClass) } as CSSProperties}>
                            <p className="eyebrow">{[character.data.characterClass, character.data.calling].filter(Boolean).join(" · ") || "Hiveborn"}</p>
                            <DialogTitle className="text-3xl">{character.name || "Unnamed hiveborn"}</DialogTitle>
                            <DialogDescription>{character.nickname ?? "Group player"}’s read-only character sheet</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-2">
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
    },
    (previous, next) => sameCharacterSnapshot(previous.character, next.character) && previous.showBeats === next.showBeats && previous.onClose === next.onClose,
)

type TagReference = {
    title: string
    tags: ReferenceTag[]
    primaryText: string
    primarySourceLabel: string
}

function SheetSection({ title, children, tagReference }: { title: string; children: ReactNode; tagReference?: TagReference }) {
    const heading = (
        <h3 className="ritual-band">
            <span className="min-w-0 flex-1">{title}</span>
            {tagReference && (
                <Hint label={`View ${title.toLowerCase()} tags in use`}>
                    <DialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="-my-1 -mr-3 shrink-0 text-primary-foreground not-disabled:hover:bg-[oklch(1_0_0/0.12)] not-disabled:hover:text-primary-foreground"
                            aria-label={`View ${title.toLowerCase()} tags in use`}
                        >
                            <BookOpen />
                        </Button>
                    </DialogTrigger>
                </Hint>
            )}
        </h3>
    )

    return (
        <section className="play-sheet-section">
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
