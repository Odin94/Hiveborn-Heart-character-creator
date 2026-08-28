import { useEffect, useRef } from "react"
import { api } from "@/lib/api"
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
    const ready = useRef(false)
    const previousAccountId = useRef<string | undefined>(undefined)
    const knownIds = useRef<string[]>([])
    const pendingSync = useRef<SyncSnapshot | null>(null)
    const syncing = useRef(false)
    const retryTimer = useRef<number | undefined>(undefined)
    const generation = useRef(0)
    const activeAccountId = useRef<string | undefined>(undefined)
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
                }
            } catch (error) {
                const snapshot = failedSnapshot
                if (snapshot && snapshot.accountId === activeAccountId.current && snapshot.generation === generation.current) {
                    // Do not lose player edits when a connection briefly drops. A newer
                    // snapshot already contains the failed changes, so prefer it.
                    pendingSync.current ??= snapshot
                    console.warn("Hiveborn cloud character sync will retry", error)
                    retryTimer.current = window.setTimeout(runSync.current, 2_000)
                }
            } finally {
                syncing.current = false
                if (pendingSync.current) runSync.current()
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
        if (!accountId)
            return () => {
                cancelled = true
            }

        void (async () => {
            const remote = await api.characters()
            if (cancelled || activeAccountId.current !== accountId || generation.current !== nextGeneration) return
            if (remote.characters.length) {
                setCloudCharacters(
                    remote.characters.map((character) => character.data),
                    remote.characters.map((character) => character.id),
                    remote.characters.map((character) => character.version),
                )
                knownIds.current = remote.characters.map((character) => character.id)
            } else if (previousAccountId.current && previousAccountId.current !== accountId) {
                // Local storage is shared by browser users. Never seed a newly
                // signed-in account with the previous account's cached sheets.
                setCloudCharacters([], [], [])
                knownIds.current = []
            } else {
                const created = await Promise.all(characters.map((character) => api.createCharacter(character)))
                if (cancelled || activeAccountId.current !== accountId || generation.current !== nextGeneration) return
                setCloudCharacters(
                    created.map((character) => character.data),
                    created.map((character) => character.id),
                    created.map((character) => character.version),
                )
                knownIds.current = created.map((character) => character.id)
            }
            previousAccountId.current = accountId
            ready.current = true
        })().catch(() => {
            if (!cancelled && activeAccountId.current === accountId && generation.current === nextGeneration) ready.current = false
        })

        return () => {
            cancelled = true
        }
        // Local sheets should seed only the first account authenticated in this browser.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountId])

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
