import { create } from "zustand"
import { persist } from "zustand/middleware"
import { Character, Domains, getEmptyCharacter, Skills } from "../game_data/character"
import { Resistance } from "../game_data/resistances"
import { createSelectors } from "../../lib/selectors"

export const protectionMaximum = 5

export type CharacterState = {
    characters: Character[]
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
    getCharacterData: () => Character
}

export const useCharacterStore = createSelectors(
    create<CharacterState>()(
        persist(
            (set, get) => {
                const getCurrentCharacter = () => {
                    const state = get()
                    return state.characters[state.currentCharacterIndex] || getEmptyCharacter()
                }

                const updateCharacter = (index: number, updates: Partial<Character>) => {
                    const state = get()
                    const newCharacters = [...state.characters]

                    if (!newCharacters[index]) {
                        newCharacters[index] = getEmptyCharacter()
                    }

                    newCharacters[index] = { ...newCharacters[index], ...updates }

                    const updatedCharacter = newCharacters[index]
                    set({
                        characters: newCharacters,
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

                return {
                    characters: [getEmptyCharacter()],
                    cloudCharacterIds: [""],
                    cloudCharacterVersions: [0],
                    cloudCharacterBases: [getEmptyCharacter()],
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
                        set({
                            characters: [...state.characters, newCharacter],
                            cloudCharacterIds: [...state.cloudCharacterIds, ""],
                            cloudCharacterVersions: [...state.cloudCharacterVersions, 0],
                            cloudCharacterBases: [...state.cloudCharacterBases, newCharacter],
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
                        const newCharacters = state.characters.filter((_, i) => i !== index)
                        const newCloudCharacterIds = state.cloudCharacterIds.filter((_, i) => i !== index)
                        const newIndex = Math.min(state.currentCharacterIndex, newCharacters.length - 1)
                        const character = newCharacters[newIndex] || getEmptyCharacter()
                        set({
                            characters: newCharacters,
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
                        const character = characters[0] || getEmptyCharacter()
                        set({
                            characters: characters.length ? characters : [getEmptyCharacter()],
                            cloudCharacterIds,
                            cloudCharacterVersions,
                            cloudCharacterBases: characters,
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
                        characters[index] = remoteCharacter
                        cloudCharacterBases[index] = remoteCharacter
                        cloudCharacterVersions[index] = version
                        const isCurrentCharacter = index === state.currentCharacterIndex
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
                        if (shouldApplyServerData) characters[index] = remoteCharacter
                        cloudCharacterBases[index] = remoteCharacter
                        cloudCharacterVersions[index] = version
                        const isCurrentCharacter = index === state.currentCharacterIndex
                        const currentCharacter = characters[index] || getEmptyCharacter()
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
                    getCharacterData: () => getCurrentCharacter(),
                }
            },
            {
                name: "hiveborn-character-storage",
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
