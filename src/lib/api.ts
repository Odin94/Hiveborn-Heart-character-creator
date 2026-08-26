import type { Character } from "@/hiveborn/game_data/character"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3003"
const TOKEN_KEY = "hiveborn-auth-token"

export type User = { id: string; email: string; firstName: string | null; lastName: string | null; nickname: string | null }
export type CloudCharacter = { id: string; name: string; data: Character; updatedAt: string }
export type GroupCharacter = CloudCharacter
export type PlayGroup = {
    id: string
    name: string
    ownerId: string
    createdAt: string
    members: Array<{ id: string; nickname: string | null; email: string; joinedAt: string; characters: GroupCharacter[] }>
    rolls: Array<{ id: string; userId: string; characterName: string; label: string; dice: string; result: string; createdAt: string }>
}

export const tokenStorage = {
    get: () => localStorage.getItem(TOKEN_KEY),
    set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
    remove: () => localStorage.removeItem(TOKEN_KEY),
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = tokenStorage.get()
    const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    })
    const refreshed = response.headers.get("X-New-Token")
    if (refreshed) tokenStorage.set(refreshed)
    if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
        const error = new Error(detail.message ?? detail.error ?? `Request failed (${response.status})`) as Error & { status: number }
        error.status = response.status
        throw error
    }
    return response.json() as Promise<T>
}

export const api = {
    login: () => {
        window.location.href = `${API_URL}/auth/login`
    },
    devLogin: () => request<{ success: boolean; token: string; user: User }>("/auth/dev-login", { method: "POST" }),
    callback: (code: string) => request<{ success: boolean; token: string; user: User }>(`/auth/callback?${new URLSearchParams({ code })}`),
    me: () => request<User>("/auth/me"),
    updateProfile: (nickname: string) => request<User>("/auth/me", { method: "PUT", body: JSON.stringify({ nickname }) }),
    logout: () => request<{ success: boolean }>("/auth/logout", { method: "POST" }),
    characters: () => request<{ characters: CloudCharacter[] }>("/characters"),
    createCharacter: (character: Character) =>
        request<CloudCharacter>("/characters", { method: "POST", body: JSON.stringify({ name: character.name, data: character }) }),
    updateCharacter: (id: string, character: Character) =>
        request<CloudCharacter>(`/characters/${id}`, { method: "PUT", body: JSON.stringify({ name: character.name, data: character }) }),
    deleteCharacter: (id: string) => request<{ success: boolean }>(`/characters/${id}`, { method: "DELETE" }),
    groups: () => request<{ groups: PlayGroup[] }>("/play-groups"),
    createGroup: (name: string) => request<PlayGroup>("/play-groups", { method: "POST", body: JSON.stringify({ name }) }),
    invite: (groupId: string, nickname: string) =>
        request<PlayGroup>(`/play-groups/${groupId}/invitations`, { method: "POST", body: JSON.stringify({ nickname }) }),
    shareRoll: (groupId: string, payload: { label: string; dice: string; result: string; characterName: string }) =>
        request(`/play-groups/${groupId}/rolls`, { method: "POST", body: JSON.stringify(payload) }),
    falloutRoll: (groupId: string, payload: { characterId: string; applyStressUpdate: boolean }) =>
        request<{
            characterId: string
            totalStress: number
            roll: number
            fallout: "minor" | "major" | null
            stressUpdated: boolean
            lastStressResistance: string | null
        }>(`/play-groups/${groupId}/fallout-rolls`, { method: "POST", body: JSON.stringify(payload) }),
}

export { API_URL }
