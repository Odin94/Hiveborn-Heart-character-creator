import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Theme = "light" | "dark"

export const themeStorageKey = "hiveborn-theme"

export const applyTheme = (theme: Theme) => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.style.colorScheme = theme
}

type ThemeState = {
    theme: Theme
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: "light",
            setTheme: (theme) => {
                applyTheme(theme)
                set({ theme })
            },
            toggleTheme: () => {
                const theme = get().theme === "dark" ? "light" : "dark"
                applyTheme(theme)
                set({ theme })
            },
        }),
        {
            name: themeStorageKey,
            onRehydrateStorage: () => (state) => {
                if (state) applyTheme(state.theme)
            },
        },
    ),
)
