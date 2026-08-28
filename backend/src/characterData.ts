import { z } from "zod"

const resistances = ["blood", "mind", "echo", "fortune", "supplies"] as const
const skills = ["compel", "delve", "discern", "endure", "evade", "hunt", "kill", "mend", "sneak"] as const
const domains = ["cursed", "desolate", "haven", "occult", "religion", "technology", "warren", "wild"] as const

const text = z.string().max(100_000)
const skillSchema = z.object({ hasSkill: z.boolean(), knacks: text }).strict()
const domainSchema = z.object({ hasDomain: z.boolean(), knacks: text }).strict()

export const characterDataSchema = z
    .object({
        name: z.string().max(120),
        characterClass: z.string().max(120),
        calling: z.string().max(120),
        activeBeats: text,
        equipment: text,
        resources: text,
        abilities: text,
        fallout: text,
        domains: z.record(z.enum(domains), domainSchema),
        skills: z.record(z.enum(skills), skillSchema),
        protections: z.record(z.enum(resistances), z.number().int().min(0).max(5)),
        stress: z.record(z.enum(resistances), z.number().int().min(0).max(10)),
        lastStressResistance: z.enum(resistances),
    })
    .strict()

export type CharacterData = z.infer<typeof characterDataSchema>
