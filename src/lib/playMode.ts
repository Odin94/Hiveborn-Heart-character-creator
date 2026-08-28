import { create } from "zustand"
import { persist } from "zustand/middleware"

type PlayModeState = {
    activeGroupId: string | null
    shareRolls: boolean
    setActiveGroupId: (id: string | null) => void
    setShareRolls: (shareRolls: boolean) => void
}

export const usePlayModeStore = create<PlayModeState>()(
    persist(
        (set) => ({
            activeGroupId: null,
            shareRolls: true,
            setActiveGroupId: (activeGroupId) => set({ activeGroupId }),
            setShareRolls: (shareRolls) => set({ shareRolls }),
        }),
        { name: "hiveborn-play-mode" },
    ),
)
