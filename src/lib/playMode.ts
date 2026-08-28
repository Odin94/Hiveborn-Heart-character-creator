import { create } from "zustand"
import { persist } from "zustand/middleware"

type PlayModeState = {
    activeGroupId: string | null
    activeGroupName: string | null
    activeGroupCharacterIds: string[]
    shareRolls: boolean
    setActiveGroup: (group: { id: string; name: string; characterIds: string[] } | null) => void
    setShareRolls: (shareRolls: boolean) => void
}

export const usePlayModeStore = create<PlayModeState>()(
    persist(
        (set) => ({
            activeGroupId: null,
            activeGroupName: null,
            activeGroupCharacterIds: [],
            shareRolls: true,
            setActiveGroup: (group) =>
                set({ activeGroupId: group?.id ?? null, activeGroupName: group?.name ?? null, activeGroupCharacterIds: group?.characterIds ?? [] }),
            setShareRolls: (shareRolls) => set({ shareRolls }),
        }),
        { name: "hiveborn-play-mode" },
    ),
)
