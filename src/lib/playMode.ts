import { create } from "zustand"
import { persist } from "zustand/middleware"

type PlayModeState = {
    activeGroupId: string | null
    isGameMaster: boolean
    shareRolls: boolean
    setActiveGroupId: (id: string | null) => void
    setGameMaster: (isGameMaster: boolean) => void
    setShareRolls: (shareRolls: boolean) => void
}

export const usePlayModeStore = create<PlayModeState>()(
    persist(
        (set) => ({
            activeGroupId: null,
            isGameMaster: false,
            shareRolls: true,
            setActiveGroupId: (activeGroupId) => set({ activeGroupId }),
            setGameMaster: (isGameMaster) => set({ isGameMaster }),
            setShareRolls: (shareRolls) => set({ shareRolls }),
        }),
        { name: "hiveborn-play-mode" },
    ),
)
