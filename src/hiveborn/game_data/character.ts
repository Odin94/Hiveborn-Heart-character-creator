import { z } from "zod"
import { callings } from "./callings"
import { characterClasses } from "./classes"
import { domains } from "./domains"
import { Resistance, resistances } from "./resistances"
import { skills } from "./skills"

export const skillSchema = z.object({
    hasSkill: z.boolean(),
    knacks: z.string(),
})

export const domainSchema = z.object({
    hasDomain: z.boolean(),
    knacks: z.string(),
})

export type Skill = z.infer<typeof skillSchema>
export type Skills = Record<string, Skill>
export type Domain = z.infer<typeof domainSchema>
export type Domains = Record<string, Domain>

export const knackPrompt = "<pick a knack>"

const addKnackPrompt = (knacks: string) => (knacks ? `${knacks}, ${knackPrompt}` : knackPrompt)

export const gainSkill = (skill: Skill): Skill => ({
    hasSkill: true,
    knacks: skill.hasSkill ? addKnackPrompt(skill.knacks) : skill.knacks,
})

export const gainDomain = (domain: Domain): Domain => ({
    hasDomain: true,
    knacks: domain.hasDomain ? addKnackPrompt(domain.knacks) : domain.knacks,
})

const ensureCompleteResistanceRecord = (val: Partial<Record<Resistance, number>>): Record<Resistance, number> => {
    const result: Record<Resistance, number> = {} as Record<Resistance, number>
    for (const resistance of resistances) {
        result[resistance] = val[resistance] ?? 0
    }
    return result
}

const ensureCompleteDomainRecord = (val: Partial<Domains>): Domains => {
    const result: Domains = {} as Domains
    for (const domain of domains) {
        result[domain] = val[domain] ?? { hasDomain: false, knacks: "" }
    }
    return result
}

const ensureCompleteSkillRecord = (val: Partial<Skills>): Skills => {
    const result: Skills = {} as Skills
    for (const skill of skills) {
        result[skill] = val[skill] ?? { hasSkill: false, knacks: "" }
    }
    return result
}

export const characterSchema = z.object({
    name: z.string(),
    characterClass: z.union([z.enum(characterClasses), z.string()]),
    calling: z.union([z.enum(callings), z.string()]),
    activeBeats: z.string(),
    equipment: z.string(),
    resources: z.string(),
    abilities: z.string(),
    fallout: z.string(),
    domains: z.record(z.enum(domains), domainSchema).transform(ensureCompleteDomainRecord),
    skills: z.record(z.enum(skills), skillSchema).transform(ensureCompleteSkillRecord),
    protections: z.record(z.enum(resistances), z.number()).transform(ensureCompleteResistanceRecord),
    stress: z.record(z.enum(resistances), z.number()).transform(ensureCompleteResistanceRecord),
})

export type Character = z.infer<typeof characterSchema>

export const getEmptyCharacter = (): Character => {
    const skills: Skills = {
        compel: {
            hasSkill: false,
            knacks: "",
        },
        delve: {
            hasSkill: false,
            knacks: "",
        },
        discern: {
            hasSkill: false,
            knacks: "",
        },
        endure: {
            hasSkill: false,
            knacks: "",
        },
        evade: {
            hasSkill: false,
            knacks: "",
        },
        hunt: {
            hasSkill: false,
            knacks: "",
        },
        kill: {
            hasSkill: false,
            knacks: "",
        },
        mend: {
            hasSkill: false,
            knacks: "",
        },
        sneak: {
            hasSkill: false,
            knacks: "",
        },
    }

    const domains: Domains = {
        cursed: {
            hasDomain: false,
            knacks: "",
        },
        desolate: {
            hasDomain: false,
            knacks: "",
        },
        haven: {
            hasDomain: false,
            knacks: "",
        },
        occult: {
            hasDomain: false,
            knacks: "",
        },
        religion: {
            hasDomain: false,
            knacks: "",
        },
        technology: {
            hasDomain: false,
            knacks: "",
        },
        warren: {
            hasDomain: false,
            knacks: "",
        },
        wild: {
            hasDomain: false,
            knacks: "",
        },
    }

    const protections: Record<Resistance, number> = {
        blood: 0,
        mind: 0,
        echo: 0,
        fortune: 0,
        supplies: 0,
    }

    const stress: Record<Resistance, number> = {
        blood: 0,
        mind: 0,
        echo: 0,
        fortune: 0,
        supplies: 0,
    }

    const emptyCharacter: Character = {
        name: "",
        characterClass: "",
        calling: "",
        activeBeats: "",
        equipment: "",
        resources: "",
        abilities: "",
        fallout: "",
        domains: domains,
        skills: skills,
        protections: protections,
        stress: stress,
    }

    return emptyCharacter
}
