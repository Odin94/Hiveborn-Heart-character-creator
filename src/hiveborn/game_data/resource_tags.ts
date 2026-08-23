export type ResourceTag = {
    name: string
    aliases?: string[]
    meaning: string
}

export const resourceTags: ResourceTag[] = [
    {
        name: "Harmful",
        meaning: "The resource can harm whoever carries it through magic, illness, or strange energies.",
    },
    {
        name: "Fragile",
        meaning: "The resource will be destroyed if it is dropped or damaged.",
    },
    {
        name: "Awkward",
        meaning: "The resource is heavy, bulky, or otherwise difficult to carry.",
    },
    {
        name: "Deteriorating",
        meaning: "The resource is breaking down, rotting, or rusting and needs to reach a new owner quickly.",
    },
    {
        name: "Taboo",
        meaning: "Most haunts will not accept the resource for barter.",
    },
    {
        name: "Volatile",
        meaning: "The resource may explode if it is mistreated.",
    },
    {
        name: "Mobile",
        meaning: "If the resource is left unattended, it will leave on its own.",
    },
    {
        name: "Beacon",
        meaning: "The resource attracts something dangerous toward its position.",
    },
    {
        name: "Niche",
        meaning: "The resource is only valuable to a very selective group of people.",
    },
    {
        name: "Scarce",
        meaning: "The resource usually comes only from specific actions taken to acquire it.",
    },
]
