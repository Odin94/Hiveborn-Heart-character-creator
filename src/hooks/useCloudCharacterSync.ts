import { useEffect, useRef } from "react"
import { api } from "@/lib/api"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import type { Character } from "@/hiveborn/game_data/character"

/** Keeps owned sheets available to every member of a play group while preserving local-first editing. */
export function useCloudCharacterSync(accountId: string | undefined) {
    const characters = useCharacterStore.use.characters()
    const ids = useCharacterStore.use.cloudCharacterIds()
    const setCloudCharacters = useCharacterStore.use.setCloudCharacters()
    const setCloudCharacterIds = useCharacterStore.use.setCloudCharacterIds()
    const ready = useRef(false)
    const previousAccountId = useRef<string | undefined>(undefined)
    const knownIds = useRef<string[]>([])
    const pendingSync = useRef<{ characters: Character[]; ids: string[] } | null>(null)
    const syncing = useRef(false)
    const retryTimer = useRef<number | undefined>(undefined)
    const runSync = useRef<() => void>(() => {})

    runSync.current = () => {
        if (syncing.current || !pendingSync.current) return
        syncing.current = true
        void (async () => {
            let failedSnapshot: { characters: Character[]; ids: string[] } | null = null
            try {
                while (pendingSync.current) {
                    const snapshot = pendingSync.current
                    pendingSync.current = null
                    failedSnapshot = snapshot
                    const currentIds = snapshot.ids.filter(Boolean)
                    await Promise.all(knownIds.current.filter((id) => !currentIds.includes(id)).map((id) => api.deleteCharacter(id)))

                    const nextIds = [...snapshot.ids]
                    for (const [index, character] of snapshot.characters.entries()) {
                        const id = nextIds[index]
                        if (id) await api.updateCharacter(id, character)
                        else {
                            const created = await api.createCharacter(character)
                            nextIds[index] = created.id
                        }
                    }
                    knownIds.current = nextIds.filter(Boolean)
                    if (nextIds.some((id, index) => id !== snapshot.ids[index])) setCloudCharacterIds(nextIds)
                    failedSnapshot = null
                }
            } catch (error) {
                // Do not lose player edits when a connection briefly drops. A newer
                // snapshot already contains the failed changes, so prefer it.
                pendingSync.current ??= failedSnapshot
                console.warn("Hiveborn cloud character sync will retry", error)
                retryTimer.current = window.setTimeout(runSync.current, 2_000)
            } finally {
                syncing.current = false
            }
        })()
    }

    useEffect(() => {
        ready.current = false
        pendingSync.current = null
        if (retryTimer.current) window.clearTimeout(retryTimer.current)
        if (!accountId) return
        void (async () => {
            const remote = await api.characters()
            if (remote.characters.length) {
                setCloudCharacters(
                    remote.characters.map((character) => character.data),
                    remote.characters.map((character) => character.id),
                )
                knownIds.current = remote.characters.map((character) => character.id)
            } else if (previousAccountId.current && previousAccountId.current !== accountId) {
                // Local storage is shared by browser users. Never seed a newly
                // signed-in account with the previous account's cached sheets.
                setCloudCharacters([], [])
                knownIds.current = []
            } else {
                const created = await Promise.all(characters.map((character) => api.createCharacter(character)))
                setCloudCharacterIds(created.map((character) => character.id))
                knownIds.current = created.map((character) => character.id)
            }
            previousAccountId.current = accountId
            ready.current = true
        })().catch(() => {
            ready.current = false
        })
        // Local sheets should seed only the first account authenticated in this browser.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountId])

    useEffect(() => {
        if (!accountId || !ready.current) return
        const timer = window.setTimeout(() => {
            pendingSync.current = { characters: [...characters], ids: [...ids] }
            runSync.current()
        }, 700)
        return () => window.clearTimeout(timer)
    }, [accountId, characters, ids])
}
