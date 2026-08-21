import { Button } from "@/components/ui/button"
import { useThemeStore } from "@/lib/theme"
import { Moon, Sun } from "lucide-react"

const ThemeToggle = () => {
    const theme = useThemeStore((state) => state.theme)
    const toggleTheme = useThemeStore((state) => state.toggleTheme)
    const nextTheme = theme === "dark" ? "light" : "dark"

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full border border-border bg-background/75 shadow-xs hover:bg-accent"
            aria-label={`Switch to ${nextTheme} mode`}
            title={`Switch to ${nextTheme} mode`}
            onClick={toggleTheme}
        >
            {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
    )
}

export default ThemeToggle
