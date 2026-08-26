import { useEffect, useRef } from "react"
import { api } from "@/lib/api"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"

/** Keeps owned sheets available to every member of a play group while preserving local-first editing. */
export function useCloudCharacterSync(authenticated: boolean) {
    const characters = useCharacterStore.use.characters()
    const ids = useCharacterStore.use.cloudCharacterIds()
    const setCloudCharacters = useCharacterStore.use.setCloudCharacters()
    const setCloudCharacterIds = useCharacterStore.use.setCloudCharacterIds()
    const ready = useRef(false)

    useEffect(() => {
        ready.current = false
        if (!authenticated) return
        void (async () => {
            const remote = await api.characters()
            if (remote.characters.length)
                setCloudCharacters(
                    remote.characters.map((character) => character.data),
                    remote.characters.map((character) => character.id),
                )
            else {
                const created = await Promise.all(characters.map((character) => api.createCharacter(character)))
                setCloudCharacterIds(created.map((character) => character.id))
            }
            ready.current = true
        })().catch(() => {
            ready.current = false
        })
        // Local sheets should seed the account only on initial authentication.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authenticated])

    useEffect(() => {
        if (!authenticated || !ready.current) return
        const timer = window.setTimeout(() => {
            void Promise.all(
                characters.map(async (character, index) => {
                    const id = ids[index]
                    if (id) return api.updateCharacter(id, character)
                    const created = await api.createCharacter(character)
                    setCloudCharacterIds([...ids.slice(0, index), created.id, ...ids.slice(index + 1)])
                    return created
                }),
            ).catch(() => undefined)
        }, 700)
        return () => window.clearTimeout(timer)
    }, [authenticated, characters, ids, setCloudCharacterIds])
}
