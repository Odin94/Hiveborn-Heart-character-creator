import { useCallback, useEffect, useState } from "react"
import posthog from "posthog-js"
import { api, tokenStorage, type User } from "@/lib/api"

export function useAuth() {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(Boolean(tokenStorage.get()))
    const refresh = useCallback(async () => {
        if (!tokenStorage.get()) {
            setUser(null)
            setLoading(false)
            return null
        }
        setLoading(true)
        try {
            const current = await api.me()
            setUser(current)
            posthog.identify(current.id, { email: current.email, nickname: current.nickname })
            return current
        } catch {
            tokenStorage.remove()
            setUser(null)
            return null
        } finally {
            setLoading(false)
        }
    }, [])
    useEffect(() => {
        void refresh()
    }, [refresh])
    const devLogin = useCallback(async () => {
        const result = await api.devLogin()
        tokenStorage.set(result.token)
        setUser(result.user)
        posthog.identify(result.user.id, { email: result.user.email })
        return result.user
    }, [])
    const logout = useCallback(async () => {
        try {
            await api.logout()
        } finally {
            tokenStorage.remove()
            setUser(null)
            posthog.reset()
        }
    }, [])
    const updateProfile = useCallback(async (nickname: string) => {
        const updated = await api.updateProfile(nickname)
        setUser(updated)
        return updated
    }, [])
    return { user, loading, isAuthenticated: Boolean(user), login: api.login, devLogin, logout, refresh, updateProfile }
}
