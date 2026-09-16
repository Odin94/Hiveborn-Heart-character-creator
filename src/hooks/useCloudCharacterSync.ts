import { useEffect } from "react"
import { toast } from "sonner"
import { API_URL, api, tokenStorage, type ApiRequestError } from "@/lib/api"
import { usePlayModeStore } from "@/lib/playMode"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import { acknowledgeCharacter, acknowledgeDeletion, characterChanges, reconcileCharacters } from "@/lib/characterSync"

/** The browser is durable storage; authentication only enables a retrying sync queue. */
export function useCloudCharacterSync(accountId: string | undefined) {
    useEffect(() => {
        if (!accountId) {
            usePlayModeStore.getState().setActiveGroup(null)
            return
        }
        let cancelled = false
        let running = false
        let refresh = true
        let failureNotified = false
        let timer: number | undefined
        let socket: WebSocket | undefined
        let reconnectTimer: number | undefined
        const schedule = (delay = 700) => {
            if (cancelled) return
            window.clearTimeout(timer)
            timer = window.setTimeout(() => void sync(), delay)
        }
        const sync = async () => {
            if (cancelled || running) return
            running = true
            try {
                if (refresh) {
                    refresh = false
                    try {
                        const response = await api.characters(true)
                        if (cancelled) return
                        reconcileCharacters(response.characters, accountId)
                    } catch (error) {
                        refresh = true
                        throw error
                    }
                }
                // Work from fresh state on every retry, including offline deletes.
                const snapshot = useCharacterStore.getState()
                for (const entry of snapshot.archivedCharacters) {
                    if (cancelled) return
                    if (!entry.synced && entry.cloudId && entry.accountId === accountId) {
                        try {
                            const response = await api.deleteCharacter(entry.cloudId)
                            if (cancelled) return
                            acknowledgeDeletion(entry.archiveId, response.character)
                        } catch (error) {
                            if ((error as ApiRequestError).status !== 404) throw error
                            if (!cancelled) acknowledgeDeletion(entry.archiveId)
                        }
                    }
                }
                for (const character of snapshot.characters) {
                    if (cancelled) return
                    const state = useCharacterStore.getState()
                    const index = state.characters.findIndex((entry) => entry.uuid === character.uuid)
                    if (index < 0) continue
                    const current = state.characters[index]
                    const id = state.cloudCharacterIds[index]
                    const base = state.cloudCharacterBases[index] ?? current
                    const changes = characterChanges(base, current)
                    if (id && !Object.keys(changes).length) continue
                    try {
                        const saved = id
                            ? await api.updateCharacter(id, { baseVersion: state.cloudCharacterVersions[index] || 1, baseData: base, changes })
                            : await api.createCharacter(current)
                        if (cancelled) return
                        acknowledgeCharacter(current, saved, accountId)
                    } catch (error) {
                        const status = (error as ApiRequestError).status
                        if (status === 404 || status === 409) refresh = true
                        throw error
                    }
                }
                failureNotified = false
            } catch (error) {
                if (!cancelled) {
                    console.warn("Hiveborn character sync will retry", error)
                    if (!failureNotified) toast.error("Your characters are saved in this browser. Cloud sync will retry.")
                    failureNotified = true
                    schedule(2000)
                }
            } finally {
                running = false
            }
        }
        const unsubscribe = useCharacterStore.subscribe(() => schedule())
        void sync()

        const connect = () => {
            if (!tokenStorage.get() || cancelled) return
            const url = new URL(API_URL)
            url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
            url.pathname = "/characters/live"
            url.searchParams.set("token", tokenStorage.get()!)
            socket = new WebSocket(url)
            socket.onmessage = () => {
                refresh = true
                schedule()
            }
            socket.onclose = (event) => {
                if (!cancelled && event.code !== 1008) reconnectTimer = window.setTimeout(connect, 1500)
            }
        }
        connect()
        return () => {
            cancelled = true
            unsubscribe()
            window.clearTimeout(timer)
            window.clearTimeout(reconnectTimer)
            socket?.close()
        }
    }, [accountId])
}
