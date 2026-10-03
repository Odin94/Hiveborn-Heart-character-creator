import { v4 as uuid, v5 as stableUuid } from "uuid"
import { toast } from "sonner"
import type { StateStorage } from "zustand/middleware"
import type { CharacterState } from "@/hiveborn/character_sheet/character_states"
import type { Character } from "@/hiveborn/game_data/character"

type SavedState = Partial<CharacterState> & { characters?: Character[] }
type Envelope = { state: SavedState; version?: number; writers?: Record<string, { revision: number; state: SavedState }> }
type Journal = { revision: number; base: SavedState; state: SavedState; version?: number }
let lastStorageWarning = 0
const storageFailure = () => {
    if (Date.now() - lastStorageWarning < 5000) return
    lastStorageWarning = Date.now()
    toast.error("Browser storage could not save this edit", {
        description: "Keep this tab open and export your character. Earlier saved data and recovery records remain intact.",
    })
}
const namespace = "e656ec6b-2691-4d76-8e5e-f45d1c7ed211"
const canonical = (value: unknown): unknown =>
    Array.isArray(value)
        ? value.map(canonical)
        : isObject(value)
          ? Object.fromEntries(
                Object.entries(value)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, entry]) => [key, canonical(entry)]),
            )
          : value
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)

/** Merge independent field edits; report overlapping edits without choosing away either draft. */
export function mergeCharacterFields(base: unknown, current: unknown, incoming: unknown): { value: unknown; conflict: boolean } {
    if (equal(incoming, base) || equal(incoming, current)) return { value: current, conflict: false }
    if (equal(current, base)) return { value: incoming, conflict: false }
    if (isObject(base) && isObject(current) && isObject(incoming)) {
        let conflict = false
        const value = { ...current }
        for (const key of new Set([...Object.keys(base), ...Object.keys(incoming)])) {
            const merged = mergeCharacterFields(base[key], current[key], incoming[key])
            value[key] = merged.value
            conflict ||= merged.conflict
        }
        return { value, conflict }
    }
    return { value: current, conflict: true }
}

export function mergeBrowserCharacters(base: SavedState, current: SavedState, incoming: SavedState, changeId: string): SavedState {
    if (equal(base, current)) return incoming
    // Legacy single-character storage is normalized by the existing migration first.
    if (!base.characters || !current.characters || !incoming.characters) return incoming
    let selectedUuid = incoming.characters[incoming.currentCharacterIndex ?? 0]?.uuid
    const characters = current.characters.map(copy)
    const ids = [...(current.cloudCharacterIds ?? [])]
    const versions = [...(current.cloudCharacterVersions ?? [])]
    const bases = [...(current.cloudCharacterBases ?? [])]
    const archives = [...(current.archivedCharacters ?? [])]
    for (const entry of incoming.archivedCharacters ?? []) {
        const index = archives.findIndex((item) => item.archiveId === entry.archiveId)
        if (index < 0) archives.push(copy(entry))
        else archives[index] = { ...archives[index], ...entry, synced: archives[index].synced || entry.synced }
    }
    const add = (character: Character, sourceIndex: number, fork = false) => {
        characters.push(copy(character))
        ids.push(fork ? "" : (incoming.cloudCharacterIds?.[sourceIndex] ?? ""))
        versions.push(fork ? 0 : (incoming.cloudCharacterVersions?.[sourceIndex] ?? 0))
        bases.push(copy(fork ? character : (incoming.cloudCharacterBases?.[sourceIndex] ?? character)))
    }
    for (const [sourceIndex, character] of incoming.characters.entries()) {
        const original = base.characters.find((item) => item.uuid === character.uuid)
        const index = characters.findIndex((item) => item.uuid === character.uuid)
        const removed = archives.some((entry) => entry.character.uuid === character.uuid)
        if (removed && !current.characters.some((entry) => entry.uuid === character.uuid)) {
            if (!original || !equal(original, character)) {
                const fork = { ...character, uuid: stableUuid(`${changeId}:${character.uuid}`, namespace) }
                if (!characters.some((entry) => entry.uuid === fork.uuid)) add(fork, sourceIndex, true)
                if (character.uuid === selectedUuid) selectedUuid = fork.uuid
            }
            continue
        }
        if (index < 0) {
            add(character, sourceIndex)
            continue
        }
        if (original) {
            const merged = mergeCharacterFields(original, characters[index], character)
            characters[index] = merged.value as Character
            if (merged.conflict) {
                const fork = { ...character, uuid: stableUuid(`${changeId}:${character.uuid}`, namespace) }
                if (!characters.some((entry) => entry.uuid === fork.uuid)) add(fork, sourceIndex, true)
                if (character.uuid === selectedUuid) selectedUuid = fork.uuid
            }
        } else if (!equal(characters[index], character)) {
            const fork = { ...character, uuid: stableUuid(`${changeId}:${character.uuid}`, namespace) }
            if (!characters.some((entry) => entry.uuid === fork.uuid)) add(fork, sourceIndex, true)
            if (character.uuid === selectedUuid) selectedUuid = fork.uuid
        }
        // Acknowledgements from another tab must not roll a revision backwards.
        if ((incoming.cloudCharacterVersions?.[sourceIndex] ?? 0) > (versions[index] ?? 0)) {
            ids[index] = incoming.cloudCharacterIds?.[sourceIndex] ?? ""
            versions[index] = incoming.cloudCharacterVersions?.[sourceIndex] ?? 0
            bases[index] = copy(incoming.cloudCharacterBases?.[sourceIndex] ?? character)
        }
    }
    // Absence alone is never deletion: only a durable matching archive is authoritative.
    for (let index = characters.length - 1; index >= 0; index--) {
        const character = characters[index]
        const deletedHere = base.characters.some((item) => item.uuid === character.uuid) && !incoming.characters.some((item) => item.uuid === character.uuid)
        if (deletedHere && archives.some((entry) => entry.character.uuid === character.uuid)) {
            const original = base.characters.find((item) => item.uuid === character.uuid)
            if (!equal(original, character)) {
                const fork = { ...character, uuid: stableUuid(`${changeId}:deleted:${character.uuid}`, namespace) }
                if (!characters.some((entry) => entry.uuid === fork.uuid)) add(fork, -1, true)
            }
            characters.splice(index, 1)
            ids.splice(index, 1)
            versions.splice(index, 1)
            bases.splice(index, 1)
        }
    }
    const index = characters.findIndex((character) => character.uuid === selectedUuid)
    const currentCharacterIndex = Math.max(0, index >= 0 ? index : Math.min(current.currentCharacterIndex ?? 0, characters.length - 1))
    return {
        ...current,
        ...incoming,
        characters,
        cloudCharacterIds: ids,
        cloudCharacterVersions: versions,
        cloudCharacterBases: bases,
        archivedCharacters: archives,
        currentCharacterIndex,
        ...characters[currentCharacterIndex],
    }
}

let storageLockDatabase: Promise<IDBDatabase> | undefined
const withIndexedDBLock = (name: string, callback: () => void): Promise<void> => {
    storageLockDatabase ??= new Promise((resolve, reject) => {
        const request = indexedDB.open("hiveborn-character-storage-lock", 1)
        request.onupgradeneeded = () => request.result.createObjectStore("writes")
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => {
            storageLockDatabase = undefined
            reject(request.error)
        }
    })
    return storageLockDatabase.then(
        (database) =>
            new Promise<void>((resolve, reject) => {
                // Even without Web Locks, a readwrite transaction owns the object-store
                // lock across tabs until its synchronous localStorage transaction finishes.
                const transaction = database.transaction("writes", "readwrite")
                transaction.objectStore("writes").get(name).onsuccess = () => {
                    try {
                        callback()
                    } catch (error) {
                        transaction.abort()
                        reject(error)
                    }
                }
                transaction.oncomplete = () => resolve()
                transaction.onerror = () => reject(transaction.error)
                transaction.onabort = () => reject(transaction.error)
            }),
    )
}

/** One bounded durable journal per tab. Canonical write races can always replay a missed writer. */
// A new document always gets a new identity: Duplicate Tab copies sessionStorage.
export function browserWriterId(): string {
    return uuid()
}

export function createDurableCharacterStorage(storage: Storage, writerId = browserWriterId(), onExternalChange?: () => void): StateStorage {
    let previous: SavedState | undefined
    let revision = 0
    let volatileDraft: { base: SavedState; state: SavedState } | undefined
    const prefix = "hiveborn-character-journal:"
    const read = (name: string): Envelope | null => {
        const raw = storage.getItem(name)
        let document: Envelope | null = null
        try {
            const parsed = raw ? (JSON.parse(raw) as Envelope) : null
            if (parsed && isObject(parsed.state) && (!parsed.state.characters || Array.isArray(parsed.state.characters))) document = parsed
        } catch {
            console.warn("Recovering a malformed Hiveborn canonical storage record from journals")
        }
        const journals: [string, Journal][] = []
        for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index)
            if (key?.startsWith(prefix)) {
                try {
                    const journal = JSON.parse(storage.getItem(key)!) as Journal
                    if (
                        Number.isInteger(journal.revision) &&
                        journal.revision > 0 &&
                        isObject(journal.base) &&
                        isObject(journal.state) &&
                        Array.isArray(journal.state.characters)
                    )
                        journals.push([key.slice(prefix.length), journal])
                } catch {
                    // Isolate a malformed recovery record; keep its original bytes for recovery.
                    console.warn("Ignored a malformed Hiveborn character recovery journal")
                }
            }
        }
        const recoveringCanonical = !document
        if (!document && journals.length) {
            const initial = journals[0][1]
            document = { version: initial.version ?? 1, state: initial.base, writers: {} }
        }
        if (!document && volatileDraft) document = { version: 1, state: volatileDraft.base, writers: {} }
        if (!document) return null
        document.writers ??= {}
        if (recoveringCanonical && journals.length) {
            const initialBase = journals[0][1].base
            for (const [writer, journal] of journals)
                document.state = mergeBrowserCharacters(initialBase, document.state, journal.base, `${writer}:recovered-base`)
        }
        for (const [writer, journal] of journals.sort(([a], [b]) => a.localeCompare(b))) {
            const seen = document.writers[writer]
            if ((seen?.revision ?? 0) >= journal.revision) continue
            document.state = mergeBrowserCharacters(seen?.state ?? journal.base, document.state, journal.state, `${writer}:${journal.revision}`)
            document.writers[writer] = { revision: journal.revision, state: journal.state }
        }
        if (volatileDraft) document.state = mergeBrowserCharacters(volatileDraft.base, document.state, volatileDraft.state, `${writerId}:volatile`)
        return document
    }
    return {
        getItem: (name) => {
            const document = read(name)
            previous = document?.state
            return document ? JSON.stringify(document) : null
        },
        setItem: (name, raw) => {
            const incoming = JSON.parse(raw) as Envelope
            const base = volatileDraft?.base ?? previous ?? { characters: [] }
            let existing: Journal | undefined
            try {
                existing = JSON.parse(storage.getItem(`${prefix}${writerId}`) ?? "null") ?? undefined
            } catch {
                /* Keep canonical data intact. */
            }
            revision = Math.max(revision, existing?.revision ?? 0) + 1
            const journal: Journal = { revision, base: existing?.base ?? base, state: incoming.state, version: incoming.version }
            // Write our own recovery copy first. No other tab can overwrite its key.
            try {
                storage.setItem(`${prefix}${writerId}`, JSON.stringify(journal))
            } catch {
                volatileDraft = { base: volatileDraft?.base ?? base, state: copy(incoming.state) }
                storageFailure()
                return
            }
            volatileDraft = undefined
            previous = copy(incoming.state)
            const persist = (compact: boolean) => {
                const recovered = read(name)
                const document = recovered ?? { ...incoming, writers: { [writerId]: { revision: journal.revision, state: incoming.state } } }
                document.version = incoming.version
                const priorRaw = storage.getItem(name)
                if (priorRaw) {
                    let valid = false
                    try {
                        const prior = JSON.parse(priorRaw) as Envelope
                        valid = isObject(prior.state) && (!prior.state.characters || Array.isArray(prior.state.characters))
                    } catch {
                        /* Preserve damaged bytes before replacement. */
                    }
                    if (!valid) storage.setItem(`${name}:damaged:${stableUuid(priorRaw, namespace)}`, priorRaw)
                }
                storage.setItem(name, JSON.stringify(document))
                if (compact) {
                    // Web Locks serialize canonical writes. Remove only the exact acknowledged
                    // revision; a new edit may already have replaced this tab's journal.
                    for (const [writer, acknowledgement] of Object.entries(document.writers ?? {})) {
                        const key = `${prefix}${writer}`
                        const record = storage.getItem(key)
                        if (!record) {
                            delete document.writers![writer]
                            continue
                        }
                        try {
                            if ((JSON.parse(record) as Journal).revision === acknowledgement.revision) {
                                storage.removeItem(key)
                                delete document.writers![writer]
                            }
                        } catch {
                            /* Corrupt originals remain available for recovery. */
                        }
                    }
                    storage.setItem(name, JSON.stringify(document))
                }
                if (!equal(document.state, incoming.state)) onExternalChange?.()
            }
            if (typeof navigator !== "undefined" && navigator.locks) {
                // A journal survives reload/crash before this queued transaction runs.
                return navigator.locks.request(name, () => persist(true)).catch(storageFailure)
            }
            if (typeof indexedDB !== "undefined")
                return withIndexedDBLock(name, () => persist(true)).catch(() => {
                    try {
                        persist(false)
                    } catch {
                        storageFailure()
                    }
                })
            // If both coordination APIs are unavailable, retain recovery journals
            // rather than prune a writer another tab may still need.
            try {
                persist(false)
            } catch {
                storageFailure()
            }
        },
        removeItem: (name) => storage.removeItem(name),
    }
}
