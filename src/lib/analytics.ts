import { create } from "zustand"
import { persist } from "zustand/middleware"
import { v4 as uuidv4 } from "uuid"

export const useUserUuid = create<{ userUuid: string | undefined; setUserUuid: () => void }>()(
    persist(
        (set) => ({
            userUuid: undefined,
            setUserUuid: () => set({ userUuid: uuidv4() }),
        }),
        {
            name: "userUuid",
        },
    ),
)
