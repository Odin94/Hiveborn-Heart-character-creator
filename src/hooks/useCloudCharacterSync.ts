import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { API_URL, api, tokenStorage, type ApiRequestError, type CloudCharacter } from "@/lib/api"
import { usePlayModeStore } from "@/lib/playMode"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import type { Character } from "@/hiveborn/game_data/character"

type SyncSnapshot = {
    accountId: string
    generation: number
    characters: Character[]
    ids: string[]
    versions: number[]
    bases: Character[]
}

const characterFields = [
    "name",
    "characterClass",
    "calling",
    "activeBeats",
    "equipment",
    "resources",
    "abilities",
    "fallout",
    "skills",
    "domains",
    "protections",
    "stress",
    "lastStressResistance",
] as const satisfies ReadonlyArray<keyof Character>

const isEqual = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
const syncedAccountStorageKey = `hiveborn-cloud-character-account:${window.location.origin}`

const getChanges = (base: Character, character: Character): Partial<Character> => {
    const changes = {} as Partial<Character>
    for (const field of characterFields) {
        if (!isEqual(base[field], character[field])) Reflect.set(changes, field, character[field])
    }
    return changes
}

/** Keeps owned sheets available to every member of a play group while preserving local-first editing. */
export function useCloudCharacterSync(accountId: string | undefined) {
    const characters = useCharacterStore.use.characters()
    const ids = useCharacterStore.use.cloudCharacterIds()
    const versions = useCharacterStore.use.cloudCharacterVersions()
    const bases = useCharacterStore.use.cloudCharacterBases()
    const setCloudCharacters = useCharacterStore.use.setCloudCharacters()
    const setCloudCharacterIds = useCharacterStore.use.setCloudCharacterIds()
    const completeCloudCharacterSync = useCharacterStore.use.completeCloudCharacterSync()
    const applyRemoteCloudCharacter = useCharacterStore.use.applyRemoteCloudCharacter()
    const ready = useRef(false)
    const previousAccountId = useRef<string | undefined>(undefined)
    const knownIds = useRef<string[]>([])
    const pendingSync = useRef<SyncSnapshot | null>(null)
    const syncing = useRef(false)
    const retryTimer = useRef<number | undefined>(undefined)
    const generation = useRef(0)
    const activeAccountId = useRef<string | undefined>(undefined)
    const saveFailureNotified = useRef(false)
    const runSync = useRef<() => void>(() => {})

    runSync.current = () => {
        if (syncing.current || !pendingSync.current) return
        syncing.current = true
        void (async () => {
            let failedSnapshot: SyncSnapshot | null = null
            try {
                while (pendingSync.current) {
                    const snapshot = pendingSync.current
                    pendingSync.current = null
                    if (snapshot.accountId !== activeAccountId.current || snapshot.generation !== generation.current || !ready.current) continue
                    failedSnapshot = snapshot

                    const currentIds = snapshot.ids.filter(Boolean)
                    for (const id of knownIds.current.filter((knownId) => !currentIds.includes(knownId))) {
                        if (snapshot.accountId !== activeAccountId.current || snapshot.generation !== generation.current) return
                        await api.deleteCharacter(id)
                    }

                    const nextIds = [...snapshot.ids]
                    for (const [index, character] of snapshot.characters.entries()) {
                        if (snapshot.accountId !== activeAccountId.current || snapshot.generation !== generation.current) return
                        const id = nextIds[index]
                        if (id) {
                            const base = snapshot.bases[index] ?? character
                            const changes = getChanges(base, character)
                            if (!Object.keys(changes).length) continue
                            const updated = await api.updateCharacter(id, {
                                baseVersion: snapshot.versions[index] ?? 1,
                                baseData: base,
                                changes,
                            })
                            if (snapshot.accountId !== activeAccountId.current || snapshot.generation !== generation.current) return
                            completeCloudCharacterSync(id, character, updated.data, updated.version)
                        } else {
                            const created = await api.createCharacter(character)
                            if (snapshot.accountId !== activeAccountId.current || snapshot.generation !== generation.current) return
                            nextIds[index] = created.id
                            setCloudCharacterIds(nextIds)
                            completeCloudCharacterSync(created.id, character, created.data, created.version)
                        }
                    }
                    knownIds.current = nextIds.filter(Boolean)
                    if (nextIds.some((id, index) => id !== snapshot.ids[index])) setCloudCharacterIds(nextIds)
                    failedSnapshot = null
                    saveFailureNotified.current = false
                }
            } catch (error) {
                const snapshot = failedSnapshot
                if (snapshot && snapshot.accountId === activeAccountId.current && snapshot.generation === generation.current) {
                    if ((error as Partial<ApiRequestError>).status === 409) {
                        // A same-field edit cannot be merged safely. Keep the local work in
                        // the editor, but never hammer the server or overwrite the remote edit.
                        toast.error("A field changed on another device. Reload this sheet to use the newer version.")
                        return
                    }
                    // Do not lose player edits when a connection briefly drops. A newer
                    // snapshot already contains the failed changes, so prefer it.
                    pendingSync.current ??= snapshot
                    console.warn("Hiveborn cloud character sync will retry", error)
                    if (!saveFailureNotified.current) {
                        saveFailureNotified.current = true
                        toast.error("Could not save your sheet. We’ll keep retrying while you stay signed in.")
                    }
                    retryTimer.current = window.setTimeout(() => {
                        retryTimer.current = undefined
                        runSync.current()
                    }, 2_000)
                }
            } finally {
                syncing.current = false
                if (pendingSync.current && !retryTimer.current) runSync.current()
            }
        })()
    }

    useEffect(() => {
        let cancelled = false
        const nextGeneration = generation.current + 1
        generation.current = nextGeneration
        activeAccountId.current = accountId
        ready.current = false
        pendingSync.current = null
        if (retryTimer.current) window.clearTimeout(retryTimer.current)
        retryTimer.current = undefined
        const accountChanged =
            (previousAccountId.current && previousAccountId.current !== accountId) ||
            (localStorage.getItem(syncedAccountStorageKey) && localStorage.getItem(syncedAccountStorageKey) !== accountId)
        if (!accountId) {
            // Missing authentication on mount is normal for browser-only users
            // and while a saved session is loading. Only clear sheets on an
            // actual sign-out, never when restoring the page's local storage.
            if (previousAccountId.current) setCloudCharacters([], [], [])
            usePlayModeStore.getState().setActiveGroup(null)
            knownIds.current = []
            previousAccountId.current = undefined
            return () => {
                cancelled = true
            }
        }
        if (accountChanged) {
            usePlayModeStore.getState().setActiveGroup(null)
            knownIds.current = []
        }

        void (async () => {
            const remote = await api.characters()
            if (cancelled || activeAccountId.current !== accountId || generation.current !== nextGeneration) return

            // Read after the request: players may have edited or added sheets
            // while authentication or the network was loading. Unsynced sheets
            // belong to this browser and must accompany any account's sheets.
            const local = useCharacterStore.getState()
            const remaining = new Map(remote.characters.map((character) => [character.id, character]))
            const nextCharacters: Character[] = []
            const nextIds: string[] = []
            const nextVersions: number[] = []
            const nextBases: Character[] = []
            let nextIndex = 0
            for (const [index, character] of local.characters.entries()) {
                const id = local.cloudCharacterIds[index]
                // Do not transfer another account's cloud sheets into this one.
                if (accountChanged && id) continue
                const server = id ? remaining.get(id) : undefined
                const base = local.cloudCharacterBases[index]
                const dirty = !base || !isEqual(base, character)
                if (index === local.currentCharacterIndex) nextIndex = nextCharacters.length
                nextCharacters.push(server && !dirty ? server.data : character)
                nextIds.push(server?.id ?? "")
                nextVersions.push(server?.version ?? 0)
                // Keep the original base for pending local edits so conflict
                // detection can still compare them to the server's version.
                nextBases.push(server && !dirty ? server.data : (base ?? character))
                if (server && dirty) nextVersions[nextVersions.length - 1] = local.cloudCharacterVersions[index] ?? 1
                if (id) remaining.delete(id)
            }
            for (const character of remaining.values()) {
                nextCharacters.push(character.data)
                nextIds.push(character.id)
                nextVersions.push(character.version)
                nextBases.push(character.data)
            }

            previousAccountId.current = accountId
            localStorage.setItem(syncedAccountStorageKey, accountId)
            knownIds.current = remote.characters.map((character) => character.id)
            ready.current = true
            setCloudCharacters(nextCharacters, nextIds, nextVersions)
            useCharacterStore.setState({ cloudCharacterBases: nextBases })
            useCharacterStore.getState().setCurrentCharacter(nextIndex)
            // The regular sync queue uploads browser-only sheets. Keeping them
            // locally until each upload succeeds also makes failures retryable.
        })().catch(() => {
            if (!cancelled && activeAccountId.current === accountId && generation.current === nextGeneration) ready.current = false
        })

        return () => {
            cancelled = true
        }
        // Reconcile once per account; subsequent edits use the regular sync queue.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountId])

    useEffect(() => {
        if (!accountId || !tokenStorage.get()) return
        let closed = false
        let socket: WebSocket | undefined
        let reconnectTimer: number | undefined
        const connect = () => {
            const url = new URL(API_URL)
            url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
            url.pathname = "/characters/live"
            url.searchParams.set("token", tokenStorage.get()!)
            socket = new WebSocket(url)
            socket.onmessage = (message) => {
                try {
                    const event = JSON.parse(message.data) as { type?: string; character?: CloudCharacter }
                    if (event.type === "character.updated" && event.character) {
                        applyRemoteCloudCharacter(event.character.id, event.character.data, event.character.version)
                    }
                } catch {
                    // A malformed live event is ignored; the next save/load remains authoritative.
                }
            }
            socket.onclose = (event) => {
                if (!closed && event.code !== 1008) reconnectTimer = window.setTimeout(connect, 1_500)
            }
        }
        connect()
        return () => {
            closed = true
            if (reconnectTimer) window.clearTimeout(reconnectTimer)
            socket?.close()
        }
    }, [accountId, applyRemoteCloudCharacter])

    useEffect(() => {
        if (!accountId || !ready.current) return
        const timer = window.setTimeout(() => {
            pendingSync.current = {
                accountId,
                generation: generation.current,
                characters: [...characters],
                ids: [...ids],
                versions: [...versions],
                bases: [...bases],
            }
            runSync.current()
        }, 700)
        return () => window.clearTimeout(timer)
    }, [accountId, bases, characters, ids, versions])
}
