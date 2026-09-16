import { v4 as uuid } from "uuid"
import { getEmptyCharacter, type Character } from "@/hiveborn/game_data/character"
import { useCharacterStore, type ArchivedCharacter } from "@/hiveborn/character_sheet/character_states"
import type { CloudCharacter } from "./api"

const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === "object")
        return Object.fromEntries(
            Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => [k, canonical(v)]),
        )
    return value
}
export const sameCharacter = (a: Character, b: Character) => {
    const { uuid: _a, ...left } = a
    const { uuid: _b, ...right } = b
    return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}
export const characterChanges = (base: Character, character: Character): Partial<Character> =>
    Object.fromEntries(
        Object.entries(character).filter(
            ([key, value]) => key !== "uuid" && JSON.stringify(canonical(base[key as keyof Character])) !== JSON.stringify(canonical(value)),
        ),
    )

const archive = (character: CloudCharacter, accountId: string): ArchivedCharacter => ({
    archiveId: uuid(),
    character: character.data,
    deletedAt: character.deletedAt || new Date().toISOString(),
    cloudId: character.id,
    accountId,
    synced: true,
})

/** Reconcile by identity, retaining both sides of divergent edits. Never infer a deletion from absence. */
export function reconcileCharacters(remote: CloudCharacter[], accountId: string) {
    const state = useCharacterStore.getState()
    const previousAccount = state.cloudAccountId ?? localStorage.getItem(`hiveborn-cloud-character-account:${window.location.origin}`)
    const remaining = new Map(remote.map((character) => [character.id, character]))
    const characters: Character[] = []
    const ids: string[] = []
    const versions: number[] = []
    const bases: Character[] = []
    const archived = [...state.archivedCharacters]
    let currentCharacterIndex = 0
    const add = (character: Character, server?: CloudCharacter, base = character, version = server?.version ?? 0) => {
        characters.push(character)
        ids.push(server?.id ?? "")
        versions.push(version)
        bases.push(base)
    }
    const archiveRemote = (server: CloudCharacter) => {
        if (!archived.some((entry) => entry.accountId === accountId && entry.cloudId === server.id && sameCharacter(entry.character, server.data)))
            archived.push(archive(server, accountId))
    }
    for (const [index, character] of state.characters.entries()) {
        const server = remote.find(
            (entry) => entry.data.uuid === character.uuid || (previousAccount === accountId && entry.id === state.cloudCharacterIds[index]),
        )
        if (index === state.currentCharacterIndex) currentCharacterIndex = characters.length
        if (!server) {
            add(character)
            continue
        }
        remaining.delete(server.id)
        const local = { ...character, uuid: server.data.uuid }
        if (server.deletedAt) {
            archiveRemote(server)
            if (!sameCharacter(local, server.data)) add({ ...local, uuid: uuid() })
        } else if (sameCharacter(local, server.data)) {
            add(server.data, server, server.data)
        } else {
            const base = state.cloudCharacterBases[index]
            if (previousAccount === accountId && base && sameCharacter(base, server.data)) {
                // Only this browser changed. Its pending patch remains safe.
                add(local, server, server.data)
            } else {
                // Ambiguous or concurrent versions get separate identities.
                add({ ...local, uuid: uuid() })
                add(server.data, server, server.data)
            }
        }
    }
    for (const server of remaining.values()) {
        if (server.deletedAt) {
            archiveRemote(server)
            continue
        }
        const deletion = archived.find(
            (entry) =>
                !entry.synced &&
                (entry.accountId === accountId || entry.accountId === null) &&
                (entry.cloudId === server.id || entry.character.uuid === server.data.uuid),
        )
        if (deletion) {
            const deletionIndex = archived.indexOf(deletion)
            archived[deletionIndex] = { ...deletion, cloudId: server.id, accountId }
            if (!sameCharacter(deletion.character, server.data)) add({ ...server.data, uuid: uuid() })
        } else add(server.data, server, server.data)
    }
    if (!characters.length) add(getEmptyCharacter())
    currentCharacterIndex = Math.min(currentCharacterIndex, characters.length - 1)
    useCharacterStore.setState({
        characters,
        cloudCharacterIds: ids,
        cloudCharacterVersions: versions,
        cloudCharacterBases: bases,
        cloudAccountId: accountId,
        archivedCharacters: archived,
        currentCharacterIndex,
        ...characters[currentCharacterIndex],
    })
}

/** Apply a response by UUID, not array position: edits/deletes can happen during requests. */
export function acknowledgeCharacter(snapshot: Character, server: CloudCharacter, accountId: string) {
    const state = useCharacterStore.getState()
    const index = state.characters.findIndex((character) => character.uuid === snapshot.uuid)
    if (index < 0) {
        // A sheet deleted during upload still needs its newly assigned cloud ID
        // so the durable deletion queue can soft-delete the saved row.
        useCharacterStore.setState({
            archivedCharacters: state.archivedCharacters.map((entry) =>
                entry.character.uuid === snapshot.uuid && !entry.synced
                    ? { ...entry, character: { ...entry.character, uuid: server.data.uuid }, cloudId: server.id, accountId }
                    : entry,
            ),
        })
        return
    }
    const characters = [...state.characters]
    const ids = [...state.cloudCharacterIds]
    const versions = [...state.cloudCharacterVersions]
    const bases = [...state.cloudCharacterBases]
    characters[index] = { ...server.data, ...characterChanges(snapshot, characters[index]), uuid: server.data.uuid }
    ids[index] = server.id
    versions[index] = server.version
    bases[index] = server.data
    const archivedCharacters = [...state.archivedCharacters]
    if (server.conflict && !characters.some((character) => character.uuid === server.conflict!.data.uuid)) {
        if (server.conflict.deletedAt) archivedCharacters.push(archive(server.conflict, accountId))
        else {
            characters.push(server.conflict.data)
            ids.push(server.conflict.id)
            versions.push(server.conflict.version)
            bases.push(server.conflict.data)
        }
    }
    useCharacterStore.setState({
        characters,
        cloudCharacterIds: ids,
        cloudCharacterVersions: versions,
        cloudCharacterBases: bases,
        archivedCharacters,
        ...characters[state.currentCharacterIndex],
    })
}

export function acknowledgeDeletion(archiveId: string, server?: CloudCharacter) {
    const state = useCharacterStore.getState()
    const entry = state.archivedCharacters.find((item) => item.archiveId === archiveId)
    if (!entry) return
    const archivedCharacters = state.archivedCharacters.map((item) => (item.archiveId === archiveId ? { ...item, synced: true } : item))
    if (server && !sameCharacter(server.data, entry.character)) archivedCharacters.push(archive(server, entry.accountId!))
    useCharacterStore.setState({ archivedCharacters })
}
