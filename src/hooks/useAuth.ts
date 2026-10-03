import { useCallback, useEffect, useRef, useState } from "react"
import posthog from "posthog-js"
import { api, tokenStorage, type ApiRequestError, type User } from "@/lib/api"

export function useAuth() {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(Boolean(tokenStorage.get()))
    const confirmedUser = useRef<User | null>(null)
    const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const mounted = useRef(true)
    const requestId = useRef(0)
    const cancelRequests = useCallback(() => {
        ++requestId.current
        clearTimeout(retryTimer.current)
    }, [])
    const refresh = useCallback(async (): Promise<User | null> => {
        const attempt = ++requestId.current
        clearTimeout(retryTimer.current)
        const token = tokenStorage.get()
        if (!token) {
            confirmedUser.current = null
            setUser(null)
            setLoading(false)
            return null
        }
        if (!confirmedUser.current) setLoading(true)
        try {
            const current = await api.me()
            if (!mounted.current || attempt !== requestId.current || !tokenStorage.get()) return null
            confirmedUser.current = current
            setUser(current)
            setLoading(false)
            posthog.identify(current.id, { email: current.email, nickname: current.nickname })
            return current
        } catch (error) {
            if (!mounted.current || attempt !== requestId.current || tokenStorage.get() !== token) return null
            if ((error as ApiRequestError).status === 401) {
                tokenStorage.remove()
                confirmedUser.current = null
                setUser(null)
                setLoading(false)
            } else {
                // Initialization remains pending; an existing session stays authenticated.
                retryTimer.current = setTimeout(() => void refresh(), 3000)
            }
            return null
        }
    }, [])
    useEffect(() => {
        mounted.current = true
        void refresh()
        const retry = () => void refresh()
        window.addEventListener("online", retry)
        return () => {
            mounted.current = false
            cancelRequests()
            window.removeEventListener("online", retry)
        }
    }, [refresh, cancelRequests])
    const devLogin = useCallback(async () => {
        const attempt = ++requestId.current
        clearTimeout(retryTimer.current)
        const result = await api.devLogin()
        if (!mounted.current || attempt !== requestId.current) return null
        tokenStorage.set(result.token)
        confirmedUser.current = result.user
        setUser(result.user)
        setLoading(false)
        posthog.identify(result.user.id, { email: result.user.email })
        return result.user
    }, [])
    const logout = useCallback(async () => {
        const attempt = ++requestId.current
        clearTimeout(retryTimer.current)
        // Invalidate in-flight refreshes immediately, before the logout request resolves.
        confirmedUser.current = null
        try {
            await api.logout()
        } finally {
            if (attempt === requestId.current) {
                tokenStorage.remove()
                if (mounted.current) {
                    setUser(null)
                    setLoading(false)
                }
                posthog.reset()
            }
        }
    }, [])
    const updateProfile = useCallback(async (nickname: string) => {
        const attempt = requestId.current
        const updated = await api.updateProfile(nickname)
        if (mounted.current && attempt === requestId.current && tokenStorage.get()) {
            confirmedUser.current = updated
            setUser(updated)
        }
        return updated
    }, [])
    return { user, loading, isAuthenticated: Boolean(user), login: api.login, devLogin, logout, refresh, updateProfile }
}
