import { create } from "zustand"
import { v4 as uuid } from "uuid"
import { persist } from "zustand/middleware"
import { Character, Domains, getEmptyCharacter, Skills } from "../game_data/character"
import { Resistance } from "../game_data/resistances"
import { createSelectors } from "../../lib/selectors"

export const protectionMaximum = 5
const UNDO_CHECKPOINT_DEBOUNCE_MS = 750
const textCharacterFields = ["name", "characterClass", "calling", "activeBeats", "equipment", "resources", "abilities", "fallout"] as const

const cloneCharacter = (character: Character) => structuredClone(character)
type TextCharacterField = (typeof textCharacterFields)[number]
type CharacterHistoryEntry = {
    characters: Character[]
    cloudCharacterIds: string[]
    cloudCharacterVersions: number[]
    cloudCharacterBases: Character[]
    currentCharacterIndex: number
}

export type ArchivedCharacter = {
    archiveId: string
    character: Character
    deletedAt: string
    cloudId: string
    accountId: string | null
    synced: boolean
}

export type CharacterState = {
    archivedCharacters: ArchivedCharacter[]
    cloudAccountId: string | null
    importCharacter: (character: Character) => void
    restoreCharacter: (archiveId: string) => void
    resetCharacter: () => void
    characters: Character[]
    /** Local snapshots for a bounded, offline-friendly undo action. */
    characterHistory: CharacterHistoryEntry[]
    cloudCharacterIds: string[]
    cloudCharacterVersions: number[]
    /** Last server-confirmed data, used to make conflict-safe field patches. */
    cloudCharacterBases: Character[]
    currentCharacterIndex: number

    name: string
    characterClass: string
    calling: string
    activeBeats: string
    equipment: string
    resources: string
    abilities: string
    fallout: string
    skills: Skills
    domains: Domains
    protections: Record<Resistance, number>
    stress: Record<Resistance, number>

    setName: (name: string) => void
    setCharacterClass: (characterClass: string) => void
    setCalling: (calling: string) => void
    setActiveBeats: (activeBeats: string) => void
    setEquipment: (equipment: string) => void
    setResources: (resources: string) => void
    setAbilities: (abilities: string) => void
    setFallout: (fallout: string) => void
    setSkills: (skills: Skills) => void
    setDomains: (domains: Domains) => void
    setProtections: (protections: Record<Resistance, number>) => void
    setStress: (stress: Record<Resistance, number>) => void
    setStressForCharacter: (index: number, stress: Record<Resistance, number>) => void

    addCharacter: (name?: string) => void
    removeCharacter: (index: number) => void
    setCurrentCharacter: (index: number) => void
    setCloudCharacters: (characters: Character[], ids: string[], versions: number[]) => void
    setCloudCharacterIds: (ids: string[]) => void
    applyRemoteCloudCharacter: (id: string, character: Character, version: number) => void
    completeCloudCharacterSync: (id: string, snapshot: Character, character: Character, version: number) => void
    undoCharacterChange: () => void
    getCharacterData: () => Character
}

export const useCharacterStore = createSelectors(
    create<CharacterState>()(
        persist(
            (set, get) => {
                let latestTextCheckpoint: { index: number; field: TextCharacterField; changedAt: number } | null = null
                const characterSnapshot = (state: CharacterState): CharacterHistoryEntry => ({
                    characters: state.characters.map(cloneCharacter),
                    cloudCharacterIds: [...state.cloudCharacterIds],
                    cloudCharacterVersions: [...state.cloudCharacterVersions],
                    cloudCharacterBases: state.cloudCharacterBases.map(cloneCharacter),
                    currentCharacterIndex: state.currentCharacterIndex,
                })
                const getCurrentCharacter = () => {
                    const state = get()
                    return state.characters[state.currentCharacterIndex] || getEmptyCharacter()
                }

                const getTextField = (updates: Partial<Character>): TextCharacterField | undefined => {
                    const fields = Object.keys(updates) as Array<keyof Character>
                    const field = fields[0]
                    return fields.length === 1 && textCharacterFields.includes(field as TextCharacterField) ? (field as TextCharacterField) : undefined
                }

                const updateHistory = (state: CharacterState, index: number, updates: Partial<Character>) => {
                    const field = getTextField(updates)
                    const changedAt = Date.now()
                    const continuesTextEdit =
                        field &&
                        latestTextCheckpoint?.index === index &&
                        latestTextCheckpoint.field === field &&
                        changedAt - latestTextCheckpoint.changedAt < UNDO_CHECKPOINT_DEBOUNCE_MS

                    latestTextCheckpoint = field ? { index, field, changedAt } : null
                    return continuesTextEdit ? state.characterHistory : [...state.characterHistory, characterSnapshot(state)].slice(-12)
                }

                const updateCharacter = (index: number, updates: Partial<Character>) => {
                    const state = get()
                    const newCharacters = [...state.characters]

                    if (!newCharacters[index]) {
                        newCharacters[index] = getEmptyCharacter()
                    }

                    const currentCharacter = newCharacters[index]!
                    if (Object.entries(updates).every(([field, value]) => Object.is(currentCharacter[field as keyof Character], value))) return

                    newCharacters[index] = { ...currentCharacter, ...updates }

                    const updatedCharacter = newCharacters[index]
                    set({
                        characters: newCharacters,
                        characterHistory: updateHistory(state, index, updates),
                        ...(index === state.currentCharacterIndex
                            ? {
                                  name: updatedCharacter.name,
                                  characterClass: updatedCharacter.characterClass,
                                  calling: updatedCharacter.calling,
                                  activeBeats: updatedCharacter.activeBeats,
                                  equipment: updatedCharacter.equipment,
                                  resources: updatedCharacter.resources,
                                  abilities: updatedCharacter.abilities,
                                  fallout: updatedCharacter.fallout,
                                  skills: updatedCharacter.skills,
                                  domains: updatedCharacter.domains,
                                  protections: updatedCharacter.protections,
                                  stress: updatedCharacter.stress,
                              }
                            : {}),
                    })
                }

                const updateCurrentCharacter = (updates: Partial<Character>) => updateCharacter(get().currentCharacterIndex, updates)

                const initialCharacter = getEmptyCharacter()
                return {
                    archivedCharacters: [],
                    cloudAccountId: null,
                    importCharacter: (character) => {
                        const state = get()
                        const existing = state.characters.findIndex((entry) => entry.uuid === character.uuid)
                        if (existing >= 0 && JSON.stringify(state.characters[existing]) === JSON.stringify(character)) {
                            state.setCurrentCharacter(existing)
                            return
                        }
                        const archivedIdentity = state.archivedCharacters.some((entry) => entry.character.uuid === character.uuid)
                        const next = cloneCharacter({ ...character, uuid: existing >= 0 || archivedIdentity ? uuid() : character.uuid })
                        set({
                            characters: [...state.characters, next],
                            cloudCharacterIds: [...state.cloudCharacterIds, ""],
                            cloudCharacterVersions: [...state.cloudCharacterVersions, 0],
                            cloudCharacterBases: [...state.cloudCharacterBases, cloneCharacter(next)],
                        })
                        get().setCurrentCharacter(get().characters.length - 1)
                    },
                    restoreCharacter: (archiveId) => {
                        const entry = get().archivedCharacters.find((item) => item.archiveId === archiveId)
                        if (entry) get().importCharacter({ ...cloneCharacter(entry.character), uuid: uuid() })
                    },
                    resetCharacter: () => {
                        get().removeCharacter(get().currentCharacterIndex)
                        get().addCharacter()
                    },
                    characters: [initialCharacter],
                    characterHistory: [],
                    cloudCharacterIds: [""],
                    cloudCharacterVersions: [0],
                    cloudCharacterBases: [cloneCharacter(initialCharacter)],
                    currentCharacterIndex: 0,

                    name: getEmptyCharacter().name,
                    characterClass: getEmptyCharacter().characterClass,
                    calling: getEmptyCharacter().calling,
                    activeBeats: getEmptyCharacter().activeBeats,
                    equipment: getEmptyCharacter().equipment,
                    resources: getEmptyCharacter().resources,
                    abilities: getEmptyCharacter().abilities,
                    fallout: getEmptyCharacter().fallout,
                    skills: getEmptyCharacter().skills,
                    domains: getEmptyCharacter().domains,
                    protections: getEmptyCharacter().protections,
                    stress: getEmptyCharacter().stress,

                    setName: (name) => updateCurrentCharacter({ name }),
                    setCharacterClass: (characterClass) => updateCurrentCharacter({ characterClass }),
                    setCalling: (calling) => updateCurrentCharacter({ calling }),
                    setActiveBeats: (activeBeats) => updateCurrentCharacter({ activeBeats }),
                    setEquipment: (equipment) => updateCurrentCharacter({ equipment }),
                    setResources: (resources) => updateCurrentCharacter({ resources }),
                    setAbilities: (abilities) => updateCurrentCharacter({ abilities }),
                    setFallout: (fallout) => updateCurrentCharacter({ fallout }),
                    setSkills: (skills) => updateCurrentCharacter({ skills }),
                    setDomains: (domains) => updateCurrentCharacter({ domains }),
                    setProtections: (protections) => updateCurrentCharacter({ protections }),
                    setStressForCharacter: (index, stress) => {
                        const currentStress = get().characters[index]?.stress ?? getEmptyCharacter().stress
                        const lastStressResistance = (Object.keys(stress) as Resistance[]).find((resistance) => stress[resistance] > currentStress[resistance])
                        updateCharacter(index, { stress, ...(lastStressResistance ? { lastStressResistance } : {}) })
                    },
                    setStress: (stress) => get().setStressForCharacter(get().currentCharacterIndex, stress),

                    addCharacter: () => {
                        const state = get()
                        const newCharacter = { ...getEmptyCharacter() }
                        latestTextCheckpoint = null
                        set({
                            characters: [...state.characters, newCharacter],
                            characterHistory: [...state.characterHistory, characterSnapshot(state)].slice(-12),
                            cloudCharacterIds: [...state.cloudCharacterIds, ""],
                            cloudCharacterVersions: [...state.cloudCharacterVersions, 0],
                            cloudCharacterBases: [...state.cloudCharacterBases, cloneCharacter(newCharacter)],
                            currentCharacterIndex: state.characters.length,
                            name: newCharacter.name,
                            characterClass: newCharacter.characterClass,
                            calling: newCharacter.calling,
                            activeBeats: newCharacter.activeBeats,
                            equipment: newCharacter.equipment,
                            resources: newCharacter.resources,
                            abilities: newCharacter.abilities,
                            fallout: newCharacter.fallout,
                            skills: newCharacter.skills,
                            domains: newCharacter.domains,
                            protections: newCharacter.protections,
                            stress: newCharacter.stress,
                        })
                    },
                    removeCharacter: (index) => {
                        const state = get()
                        if (!state.characters[index]) return
                        const archivedCharacters = [
                            ...state.archivedCharacters,
                            {
                                archiveId: uuid(),
                                character: cloneCharacter(state.characters[index]),
                                deletedAt: new Date().toISOString(),
                                cloudId: state.cloudCharacterIds[index] || "",
                                accountId: state.cloudAccountId,
                                synced: false,
                            },
                        ]
                        const newCharacters = state.characters.filter((_, i) => i !== index)
                        const newCloudCharacterIds = state.cloudCharacterIds.filter((_, i) => i !== index)
                        const activeUuid = state.characters[state.currentCharacterIndex]?.uuid
                        const selectedIndex = newCharacters.findIndex((character) => character.uuid === activeUuid)
                        const newIndex = selectedIndex >= 0 ? selectedIndex : Math.min(state.currentCharacterIndex, newCharacters.length - 1)
                        const character = newCharacters[newIndex] || getEmptyCharacter()
                        latestTextCheckpoint = null
                        set({
                            characters: newCharacters,
                            archivedCharacters,
                            characterHistory: [...state.characterHistory, characterSnapshot(state)].slice(-12),
                            cloudCharacterIds: newCloudCharacterIds,
                            cloudCharacterVersions: state.cloudCharacterVersions.filter((_, i) => i !== index),
                            cloudCharacterBases: state.cloudCharacterBases.filter((_, i) => i !== index),
                            currentCharacterIndex: Math.max(0, newIndex),
                            name: character.name,
                            characterClass: character.characterClass,
                            calling: character.calling,
                            activeBeats: character.activeBeats,
                            equipment: character.equipment,
                            resources: character.resources,
                            abilities: character.abilities,
                            fallout: character.fallout,
                            skills: character.skills,
                            domains: character.domains,
                            protections: character.protections,
                            stress: character.stress,
                        })
                    },
                    setCurrentCharacter: (index) => {
                        const state = get()
                        if (index >= 0 && index < state.characters.length) {
                            const character = state.characters[index] || getEmptyCharacter()
                            latestTextCheckpoint = null
                            set({
                                currentCharacterIndex: index,
                                name: character.name,
                                characterClass: character.characterClass,
                                calling: character.calling,
                                activeBeats: character.activeBeats,
                                equipment: character.equipment,
                                resources: character.resources,
                                abilities: character.abilities,
                                fallout: character.fallout,
                                skills: character.skills,
                                domains: character.domains,
                                protections: character.protections,
                                stress: character.stress,
                            })
                        }
                    },
                    setCloudCharacters: (characters, cloudCharacterIds, cloudCharacterVersions) => {
                        const nextCharacters = characters.length ? characters.map(cloneCharacter) : [getEmptyCharacter()]
                        const character = nextCharacters[0]!
                        latestTextCheckpoint = null
                        set({
                            characters: nextCharacters,
                            characterHistory: [],
                            cloudCharacterIds: characters.length ? cloudCharacterIds : [""],
                            cloudCharacterVersions: characters.length ? cloudCharacterVersions : [0],
                            cloudCharacterBases: nextCharacters.map(cloneCharacter),
                            currentCharacterIndex: 0,
                            name: character.name,
                            characterClass: character.characterClass,
                            calling: character.calling,
                            activeBeats: character.activeBeats,
                            equipment: character.equipment,
                            resources: character.resources,
                            abilities: character.abilities,
                            fallout: character.fallout,
                            skills: character.skills,
                            domains: character.domains,
                            protections: character.protections,
                            stress: character.stress,
                        })
                    },
                    setCloudCharacterIds: (cloudCharacterIds) => set({ cloudCharacterIds }),
                    applyRemoteCloudCharacter: (id, remoteCharacter, version) => {
                        const state = get()
                        const index = state.cloudCharacterIds.indexOf(id)
                        if (index < 0) return
                        const localCharacter = state.characters[index]
                        const baseCharacter = state.cloudCharacterBases[index]
                        // Preserve an edit that has not reached the server yet. The sync layer
                        // will rebase its field-level patch against this newer server version.
                        if (!localCharacter || !baseCharacter || JSON.stringify(localCharacter) !== JSON.stringify(baseCharacter)) return

                        const characters = [...state.characters]
                        const cloudCharacterBases = [...state.cloudCharacterBases]
                        const cloudCharacterVersions = [...state.cloudCharacterVersions]
                        characters[index] = cloneCharacter(remoteCharacter)
                        cloudCharacterBases[index] = cloneCharacter(remoteCharacter)
                        cloudCharacterVersions[index] = version
                        const isCurrentCharacter = index === state.currentCharacterIndex
                        latestTextCheckpoint = null
                        set({
                            characters,
                            cloudCharacterBases,
                            cloudCharacterVersions,
                            ...(isCurrentCharacter
                                ? {
                                      name: remoteCharacter.name,
                                      characterClass: remoteCharacter.characterClass,
                                      calling: remoteCharacter.calling,
                                      activeBeats: remoteCharacter.activeBeats,
                                      equipment: remoteCharacter.equipment,
                                      resources: remoteCharacter.resources,
                                      abilities: remoteCharacter.abilities,
                                      fallout: remoteCharacter.fallout,
                                      skills: remoteCharacter.skills,
                                      domains: remoteCharacter.domains,
                                      protections: remoteCharacter.protections,
                                      stress: remoteCharacter.stress,
                                  }
                                : {}),
                        })
                    },
                    completeCloudCharacterSync: (id, snapshot, remoteCharacter, version) => {
                        const state = get()
                        const index = state.cloudCharacterIds.indexOf(id)
                        if (index < 0) return
                        const characters = [...state.characters]
                        const cloudCharacterBases = [...state.cloudCharacterBases]
                        const cloudCharacterVersions = [...state.cloudCharacterVersions]
                        const shouldApplyServerData = JSON.stringify(characters[index]) === JSON.stringify(snapshot)
                        if (shouldApplyServerData) characters[index] = cloneCharacter(remoteCharacter)
                        cloudCharacterBases[index] = cloneCharacter(remoteCharacter)
                        cloudCharacterVersions[index] = version
                        const isCurrentCharacter = index === state.currentCharacterIndex
                        const currentCharacter = characters[index] || getEmptyCharacter()
                        latestTextCheckpoint = null
                        set({
                            characters,
                            cloudCharacterBases,
                            cloudCharacterVersions,
                            ...(isCurrentCharacter
                                ? {
                                      name: currentCharacter.name,
                                      characterClass: currentCharacter.characterClass,
                                      calling: currentCharacter.calling,
                                      activeBeats: currentCharacter.activeBeats,
                                      equipment: currentCharacter.equipment,
                                      resources: currentCharacter.resources,
                                      abilities: currentCharacter.abilities,
                                      fallout: currentCharacter.fallout,
                                      skills: currentCharacter.skills,
                                      domains: currentCharacter.domains,
                                      protections: currentCharacter.protections,
                                      stress: currentCharacter.stress,
                                  }
                                : {}),
                        })
                    },
                    undoCharacterChange: () => {
                        const state = get()
                        const previousState = state.characterHistory[state.characterHistory.length - 1]
                        if (!previousState) return
                        const restored = previousState.characters.map((character) => ({
                            ...cloneCharacter(character),
                            uuid: state.archivedCharacters.some((entry) => entry.character.uuid === character.uuid) ? uuid() : character.uuid,
                        }))
                        const index = Math.min(previousState.currentCharacterIndex, restored.length - 1)
                        const character = restored[index] || getEmptyCharacter()
                        latestTextCheckpoint = null
                        set({
                            archivedCharacters: [
                                ...state.archivedCharacters,
                                ...state.characters
                                    .filter((character) => !previousState.characters.some((previous) => JSON.stringify(previous) === JSON.stringify(character)))
                                    .map((character) => {
                                        const removed = !restored.some((previous) => previous.uuid === character.uuid)
                                        const cloudId = state.cloudCharacterIds[state.characters.findIndex((entry) => entry.uuid === character.uuid)] || ""
                                        return {
                                            archiveId: uuid(),
                                            character: cloneCharacter(character),
                                            deletedAt: new Date().toISOString(),
                                            cloudId: removed ? cloudId : "",
                                            accountId: removed ? state.cloudAccountId : null,
                                            synced: !removed,
                                        }
                                    }),
                            ],
                            characters: restored,
                            characterHistory: state.characterHistory.slice(0, -1),
                            cloudCharacterIds: previousState.cloudCharacterIds.map((id, index) =>
                                restored[index]?.uuid === previousState.characters[index]?.uuid ? id : "",
                            ),
                            cloudCharacterVersions: [...previousState.cloudCharacterVersions],
                            cloudCharacterBases: previousState.cloudCharacterBases.map(cloneCharacter),
                            currentCharacterIndex: Math.max(0, index),
                            name: character.name,
                            characterClass: character.characterClass,
                            calling: character.calling,
                            activeBeats: character.activeBeats,
                            equipment: character.equipment,
                            resources: character.resources,
                            abilities: character.abilities,
                            fallout: character.fallout,
                            skills: character.skills,
                            domains: character.domains,
                            protections: character.protections,
                            stress: character.stress,
                        })
                    },
                    getCharacterData: () => getCurrentCharacter(),
                }
            },
            {
                name: "hiveborn-character-storage",
                version: 1,
                migrate: (persisted) => persisted as CharacterState,
                merge: (persisted, current) => {
                    const saved = persisted as Partial<CharacterState> | undefined
                    if (!saved) return current
                    const seen = new Set<string>()
                    const empty = getEmptyCharacter()
                    const legacyCharacter = {
                        ...empty,
                        ...Object.fromEntries(
                            Object.keys(empty)
                                .filter((key) => key in saved)
                                .map((key) => [key, saved[key as keyof CharacterState]]),
                        ),
                    } as Character
                    const characters = (saved.characters ?? ("name" in saved ? [legacyCharacter] : current.characters)).map((character) => {
                        const id = character.uuid && !seen.has(character.uuid) ? character.uuid : uuid()
                        seen.add(id)
                        return { ...getEmptyCharacter(), ...character, uuid: id }
                    })
                    const currentCharacterIndex = Math.max(0, Math.min(saved.currentCharacterIndex ?? 0, characters.length - 1))
                    return {
                        ...current,
                        ...saved,
                        cloudAccountId: saved.cloudAccountId ?? localStorage.getItem(`hiveborn-cloud-character-account:${window.location.origin}`),
                        characters,
                        currentCharacterIndex,
                        cloudCharacterBases: characters.map((character, index) => ({
                            ...(saved.cloudCharacterBases?.[index] ?? character),
                            uuid: character.uuid,
                        })),
                        archivedCharacters: (saved.archivedCharacters ?? []).map((entry) => ({
                            ...entry,
                            character: { ...entry.character, uuid: entry.character.uuid || uuid() },
                        })),
                        ...(characters[currentCharacterIndex] ?? getEmptyCharacter()),
                    }
                },
                // History is an in-session safety net, not durable character data. Keeping
                // it out of localStorage prevents a long editing session from exhausting it.
                partialize: ({ characterHistory: _characterHistory, ...state }) => state,
            },
        ),
    ),
)

export const useMultiCharacter = () => {
    const { characters, currentCharacterIndex, addCharacter, removeCharacter, setCurrentCharacter } = useCharacterStore()

    return {
        characters,
        currentCharacterIndex,
        createCharacter: addCharacter,
        deleteCharacter: removeCharacter,
        setActiveCharacter: setCurrentCharacter,
        getActiveCharacter: () => characters[currentCharacterIndex] || null,
        getAllCharacters: () => characters,
    }
}
