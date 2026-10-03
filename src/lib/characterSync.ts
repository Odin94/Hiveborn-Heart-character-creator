import { v4 as uuid } from "uuid"
import { getEmptyCharacter, type Character } from "@/hiveborn/game_data/character"
import { useCharacterStore, type ArchivedCharacter, type CharacterState } from "@/hiveborn/character_sheet/character_states"
import type { CloudCharacter, api } from "./api"

/** Browser persistence keeps its historical schema; synchronization owns its metadata. */
export type CharacterReplica = {
    read: () => CharacterState
    write: (updates: Partial<CharacterState>) => void
    subscribe: (changed: () => void) => () => void
}
const browserReplica: CharacterReplica = {
    read: () => useCharacterStore.getState(),
    write: (updates) => useCharacterStore.getState().applySynchronizedState(updates),
    subscribe: (changed) => useCharacterStore.subscribe(changed),
}
export type CharacterTransport = Pick<typeof api, "characters" | "createCharacter" | "updateCharacter" | "deleteCharacter"> & {
    observe?: (refresh: () => void) => () => void
}

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
export function reconcileCharacters(remote: CloudCharacter[], accountId: string, replica = browserReplica) {
    const state = replica.read()
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
            } else if (previousAccount === accountId && base && sameCharacter(local, base)) {
                // A clean browser adopts the remote edit without creating a copy.
                add(server.data, server, server.data)
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
    replica.write({
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
export function acknowledgeCharacter(snapshot: Character, server: CloudCharacter, accountId: string, replica = browserReplica) {
    const state = replica.read()
    const index = state.characters.findIndex((character) => character.uuid === snapshot.uuid)
    if (index < 0) {
        // A sheet deleted during upload still needs its newly assigned cloud ID
        // so the durable deletion queue can soft-delete the saved row.
        replica.write({
            archivedCharacters: state.archivedCharacters.map((entry) =>
                entry.character.uuid === snapshot.uuid && !entry.synced && (entry.accountId === null || entry.accountId === accountId)
                    ? { ...entry, character: { ...entry.character, uuid: server.data.uuid }, cloudId: server.id, accountId }
                    : entry,
            ),
        })
        return
    }
    // Group events can arrive before an older HTTP acknowledgement.
    if (state.cloudCharacterIds[index] === server.id && state.cloudCharacterVersions[index] > server.version) return
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
    replica.write({
        characters,
        cloudCharacterIds: ids,
        cloudCharacterVersions: versions,
        cloudCharacterBases: bases,
        archivedCharacters,
        ...characters[state.currentCharacterIndex],
    })
}

export function acknowledgeDeletion(archiveId: string, server?: CloudCharacter, replica = browserReplica) {
    const state = replica.read()
    const entry = state.archivedCharacters.find((item) => item.archiveId === archiveId)
    if (!entry) return
    const archivedCharacters = state.archivedCharacters.map((item) => (item.archiveId === archiveId ? { ...item, synced: true } : item))
    if (server && !sameCharacter(server.data, entry.character)) archivedCharacters.push(archive(server, entry.accountId!))
    replica.write({ archivedCharacters })
}

/** Group WebSocket delivery uses the same replica and identity rules as HTTP sync. */
export function receiveRemoteCharacter(server: CloudCharacter, accountId: string, replica = browserReplica) {
    const state = replica.read()
    if (state.cloudAccountId !== accountId) return
    const index = state.cloudCharacterIds.indexOf(server.id)
    if (index < 0 || server.version <= state.cloudCharacterVersions[index]) return
    const local = state.characters[index]
    const base = state.cloudCharacterBases[index]
    if (!local || !base || !sameCharacter(local, base)) return
    acknowledgeCharacter(local, server, accountId, replica)
}

/** Starts one account-owned, serial, retrying queue. Stopping retires every response.
 * Browser edits/deletions remain durable independently of the account or transport.
 */
export function startCharacterSync(
    accountId: string,
    transport: CharacterTransport,
    options: {
        replica?: CharacterReplica
        onFailure?: (error: unknown, firstFailure: boolean) => void
    } = {},
) {
    const replica = options.replica ?? browserReplica
    let stopped = false
    let running = false
    let refresh = true
    let requested = false
    let failed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = (delay = 700) => {
        if (stopped) return
        requested = true
        clearTimeout(timer)
        timer = setTimeout(() => {
            timer = undefined
            if (running) return // finally schedules requests arriving during an upload.
            requested = false
            void sync()
        }, delay)
    }
    const sync = async () => {
        if (stopped || running) return
        running = true
        try {
            if (refresh) {
                refresh = false
                try {
                    const response = await transport.characters(true)
                    if (stopped) return
                    reconcileCharacters(response.characters, accountId, replica)
                } catch (error) {
                    refresh = true
                    throw error
                }
            }
            const snapshot = replica.read()
            for (const entry of snapshot.archivedCharacters) {
                if (stopped) return
                if (entry.synced || !entry.cloudId || entry.accountId !== accountId) continue
                try {
                    const response = await transport.deleteCharacter(entry.cloudId)
                    if (stopped) return
                    acknowledgeDeletion(entry.archiveId, response.character, replica)
                } catch (error) {
                    if ((error as { status?: number }).status !== 404) throw error
                    if (!stopped) acknowledgeDeletion(entry.archiveId, undefined, replica)
                }
            }
            for (const sheet of snapshot.characters) {
                if (stopped) return
                const state = replica.read()
                if (state.cloudAccountId !== accountId) return
                const index = state.characters.findIndex((character) => character.uuid === sheet.uuid)
                if (index < 0) continue
                const current = state.characters[index]
                const id = state.cloudCharacterIds[index]
                const base = state.cloudCharacterBases[index] ?? current
                const changes = characterChanges(base, current)
                if (id && !Object.keys(changes).length) continue
                try {
                    const saved = id
                        ? await transport.updateCharacter(id, { baseVersion: state.cloudCharacterVersions[index] || 1, baseData: base, changes })
                        : await transport.createCharacter(current)
                    if (stopped) {
                        // A delete made before logout still needs the saved identity for
                        // recovery on the next login; never apply a retired active response.
                        if (!replica.read().characters.some((character) => character.uuid === current.uuid))
                            acknowledgeCharacter(current, saved, accountId, replica)
                        return
                    }
                    acknowledgeCharacter(current, saved, accountId, replica)
                } catch (error) {
                    if ([404, 409].includes((error as { status?: number }).status ?? 0)) refresh = true
                    throw error
                }
            }
            failed = false
        } catch (error) {
            if (!stopped) {
                options.onFailure?.(error, !failed)
                failed = true
                schedule(2000)
            }
        } finally {
            running = false
            if (!stopped && requested && timer === undefined) schedule()
        }
    }
    const unsubscribe = replica.subscribe(() => schedule())
    const requestRefresh = () => {
        refresh = true
        schedule()
    }
    const stopObserving = transport.observe?.(requestRefresh)
    void sync()
    return {
        refresh: requestRefresh,
        stop: () => {
            if (stopped) return
            stopped = true
            unsubscribe()
            stopObserving?.()
            clearTimeout(timer)
        },
    }
}
