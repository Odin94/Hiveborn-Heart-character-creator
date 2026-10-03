import { useEffect } from "react"
import { toast } from "sonner"
import { API_URL, api, tokenStorage } from "@/lib/api"
import { usePlayModeStore } from "@/lib/playMode"
import { startCharacterSync } from "@/lib/characterSync"

/** WebSocket transport owns connection lifetime; the sync module owns every data decision. */
const observeCharacters = (refresh: () => void) => {
    let stopped = false
    let socket: WebSocket | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
        const token = tokenStorage.get()
        if (!token || stopped) return
        const url = new URL(API_URL)
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
        url.pathname = "/characters/live"
        url.searchParams.set("token", token)
        socket = new WebSocket(url)
        socket.onmessage = refresh
        socket.onclose = (event) => {
            if (!stopped && event.code !== 1008) reconnectTimer = setTimeout(connect, 1500)
        }
    }
    connect()
    return () => {
        stopped = true
        clearTimeout(reconnectTimer)
        socket?.close()
    }
}

export function useCloudCharacterSync(accountId: string | undefined) {
    useEffect(() => {
        if (!accountId) {
            usePlayModeStore.getState().setActiveGroup(null)
            return
        }
        const sync = startCharacterSync(
            accountId,
            { ...api, observe: observeCharacters },
            {
                onFailure: (error, firstFailure) => {
                    console.warn("Hiveborn character sync will retry", error)
                    if (firstFailure) toast.error("Your characters are saved in this browser. Cloud sync will retry.")
                },
            },
        )
        return sync.stop
    }, [accountId])
}
