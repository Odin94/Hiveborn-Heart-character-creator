import { create } from "zustand"
import { persist } from "zustand/middleware"

type PlayModeState = {
    activeGroupId: string | null
    activeGroupName: string | null
    shareRolls: boolean
    setActiveGroup: (group: { id: string; name: string } | null) => void
    setShareRolls: (shareRolls: boolean) => void
}

export const usePlayModeStore = create<PlayModeState>()(
    persist(
        (set) => ({
            activeGroupId: null,
            activeGroupName: null,
            shareRolls: true,
            setActiveGroup: (group) => set({ activeGroupId: group?.id ?? null, activeGroupName: group?.name ?? null }),
            setShareRolls: (shareRolls) => set({ shareRolls }),
        }),
        { name: "hiveborn-play-mode" },
    ),
)
