import { create } from "zustand"
import { persist } from "zustand/middleware"
import { Character, Domains, getEmptyCharacter, Skills } from "../game_data/character"
import { Resistance } from "../game_data/resistances"
import { createSelectors } from "../../lib/selectors"

export const protectionMaximum = 5

export type CharacterState = {
    characters: Character[]
    cloudCharacterIds: string[]
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

    addCharacter: (name?: string) => void
    removeCharacter: (index: number) => void
    setCurrentCharacter: (index: number) => void
    setCloudCharacters: (characters: Character[], ids: string[]) => void
    setCloudCharacterIds: (ids: string[]) => void
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

                const updateCurrentCharacter = (updates: Partial<Character>) => {
                    const state = get()
                    const newCharacters = [...state.characters]
                    const currentIndex = state.currentCharacterIndex

                    if (!newCharacters[currentIndex]) {
                        newCharacters[currentIndex] = getEmptyCharacter()
                    }

                    newCharacters[currentIndex] = { ...newCharacters[currentIndex], ...updates }

                    const updatedCharacter = newCharacters[currentIndex]
                    set({
                        characters: newCharacters,
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
                    })
                }

                return {
                    characters: [getEmptyCharacter()],
                    cloudCharacterIds: [],
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
                    setStress: (stress) => {
                        const currentStress = getCurrentCharacter().stress
                        const lastStressResistance = (Object.keys(stress) as Resistance[]).find((resistance) => stress[resistance] > currentStress[resistance])
                        updateCurrentCharacter({ stress, ...(lastStressResistance ? { lastStressResistance } : {}) })
                    },

                    addCharacter: () => {
                        const state = get()
                        const newCharacter = { ...getEmptyCharacter() }
                        set({
                            characters: [...state.characters, newCharacter],
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
                        const newIndex = Math.min(state.currentCharacterIndex, newCharacters.length - 1)
                        const character = newCharacters[newIndex] || getEmptyCharacter()
                        set({
                            characters: newCharacters,
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
                    setCloudCharacters: (characters, cloudCharacterIds) => {
                        const character = characters[0] || getEmptyCharacter()
                        set({
                            characters: characters.length ? characters : [getEmptyCharacter()],
                            cloudCharacterIds,
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
