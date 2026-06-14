export type EquipmentTag = {
    name: string
    aliases?: string[]
    meaning: string
}

export const equipmentTags: EquipmentTag[] = [
    {
        name: "Block",
        meaning: "+1 Blood protection while carrying the item.",
    },
    {
        name: "Bloodbound",
        meaning: "Mark D4 Blood stress to roll with mastery when using the equipment for the rest of the situation.",
    },
    {
        name: "Brutal",
        meaning: "When rolling stress against an adversary, roll one extra stress die and keep the highest. Multiple instances add more dice.",
    },
    {
        name: "Conduit",
        meaning: "Mark D4 Mind stress to roll with mastery when using the equipment for the rest of the situation.",
    },
    {
        name: "Dangerous",
        meaning: "When the item inflicts stress and rolls its maximum value, mark D6 Blood stress.",
    },
    {
        name: "Debilitating",
        meaning: "Once per situation, after this item inflicts stress, the next attack against those targets is rolled with mastery.",
    },
    {
        name: "Degenerating",
        meaning:
            "After taking damage from this weapon, roll Endure plus the relevant domain at situation end. Failure marks D6 stress; partial success marks D4.",
    },
    {
        name: "Distressing",
        meaning: "When the item inflicts stress and rolls its maximum value, mark D6 Mind stress.",
    },
    {
        name: "Double-Barreled",
        aliases: ["Double Barreled"],
        meaning: "As Reload, except it can be used twice before it needs reloading.",
    },
    {
        name: "Expensive",
        meaning: "When the item inflicts stress and rolls its maximum value, mark D6 Supplies stress.",
    },
    {
        name: "Extreme Range",
        meaning: "The item can be used at extreme range.",
    },
    {
        name: "Limited X",
        aliases: ["Limited"],
        meaning: "The item can be used X times before it gives out.",
    },
    {
        name: "Loud",
        meaning: "When the item inflicts stress and rolls its maximum value, mark D6 Fortune stress.",
    },
    {
        name: "Obscuring",
        meaning: "The bearer and nearby allies reduce incoming and outgoing ranged weapon stress by one die step.",
    },
    {
        name: "One-Shot",
        aliases: ["One Shot"],
        meaning: "The item takes so long to prepare that it can only be used once per situation.",
    },
    {
        name: "Piercing",
        meaning: "Blood Protection cannot reduce this equipment's stress, and adversaries do not benefit from protection.",
    },
    {
        name: "Point-Blank",
        aliases: ["Point Blank"],
        meaning: "As Ranged. At very close range, increase stress by one die step; at long enough distance, reduce it by one die step.",
    },
    {
        name: "Potent",
        meaning: "When rolling stress removed from yourself or an ally, roll one extra die and keep the highest. Multiple instances add more dice.",
    },
    {
        name: "Ranged",
        meaning: "The equipment can be used at range.",
    },
    {
        name: "Reload",
        meaning: "The equipment must be reloaded between uses, creating an opening for enemies to close in or flee.",
    },
    {
        name: "Smoke",
        meaning: "As Obscuring, but only around the area where the item was used and only when it is used.",
    },
    {
        name: "Spread",
        meaning: "On a successful use, nearby targets must avoid the blast or mark stress too; partial success reduces the stress die by one step.",
    },
    {
        name: "Tiring",
        meaning: "When an action using this equipment fails, reduce its stress die by one step for the rest of the situation.",
    },
    {
        name: "Trusty",
        meaning: "When rolling stress marked against a delve with this item, roll one extra die and keep the highest. Multiple instances add more dice.",
    },
    {
        name: "Unreliable",
        meaning: "When an action using this equipment fails, it cannot be used again for the rest of the landmark or journey.",
    },
    {
        name: "Wyrd",
        meaning: "When the item inflicts stress and rolls its maximum value, mark D6 Echo stress.",
    },
]
