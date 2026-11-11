import { Button } from "@/components/ui/button"
import { Hint } from "@/components/ui/tooltip"
import { useThemeStore } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { Moon, Sun } from "lucide-react"

const ThemeToggle = ({ className }: { className?: string }) => {
    const theme = useThemeStore((state) => state.theme)
    const toggleTheme = useThemeStore((state) => state.toggleTheme)
    const nextTheme = theme === "dark" ? "light" : "dark"
    const label = `Switch to ${nextTheme} mode`

    return (
        <Hint label={label}>
            <Button type="button" variant="ghost" size="icon-sm" className={cn("relative overflow-hidden", className)} aria-label={label} onClick={toggleTheme}>
                <Sun
                    aria-hidden="true"
                    className={cn(
                        "absolute transition-[transform,opacity] duration-300 ease-out",
                        theme === "dark" ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0",
                    )}
                />
                <Moon
                    aria-hidden="true"
                    className={cn(
                        "absolute transition-[transform,opacity] duration-300 ease-out",
                        theme === "dark" ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
                    )}
                />
            </Button>
        </Hint>
    )
}

export default ThemeToggle
