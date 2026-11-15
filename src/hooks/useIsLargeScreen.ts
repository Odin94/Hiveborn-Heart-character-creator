import { useState, useEffect } from "react"

export const useIsLargeScreen = () => {
    const [isLargeScreen, setIsLargeScreen] = useState(false)

    useEffect(() => {
        const checkScreenSize = () => {
            setIsLargeScreen(window.innerWidth >= 2100)
        }

        checkScreenSize()

        window.addEventListener("resize", checkScreenSize)

        return () => {
            window.removeEventListener("resize", checkScreenSize)
        }
    }, [])

    return isLargeScreen
}
