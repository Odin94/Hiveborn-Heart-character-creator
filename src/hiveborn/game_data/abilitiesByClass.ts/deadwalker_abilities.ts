import { Ability } from "../abilities"
import { domain, noBonuses, pickFrom, protection, skill } from "./ability_utils"

export const deadwalkerAbilities: Ability[] = [
    {
        name: "Adept",
        description: "Get one of the skills domains: 'Compel', 'Delve', 'Discern', 'Endure', 'Evade', 'Hunt', 'Kill', 'Sneak'. Can be picked more than once.",
        type: "minor",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({ skills: ["compel", "delve", "discern", "endure", "evade", "hunt", "kill", "sneak"] }),
        // TODOdin: Make more-than-once selectable
    },
    {
        name: "Deathless",
        description: "Gain 'Endure' skill. Roll 'Endure' + 'Religion' to ignore effects of minor 'Blood' or 'Echo' fallout for this situation.",
        type: "minor",
        staticBonuses: skill("endure"),
        pickFrom: pickFrom({}),
    },
    {
        name: "Dirt under the Fingernails",
        description: "Gain 'Warren' domain. Dig through earth with bare hands as if you had a shovel.",
        type: "minor",
        staticBonuses: domain("warren"),
        pickFrom: pickFrom({}),
    },
    {
        name: "Explorer",
        description:
            "Get one of the following domains: 'Cursed', 'Desolate', 'Occult', 'Religion', 'Technology', 'Wild', 'Warren'. Can be picked more than once.",
        type: "minor",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({ domains: ["cursed", "desolate", "occult", "religion", "technology", "wild", "warren"] }),
        // TODOdin: Make more-than-once selectable
    },
    {
        name: "Grail Armour",
        description: "Gain +2 'Blood' protection.",
        type: "minor",
        staticBonuses: protection("blood", 2),
        pickFrom: pickFrom({}),
    },
    {
        name: "Grim Reaper",
        description: "Gain 'Kill' skill. Your death functions as 'Kill' D8, 'Ranged', 'One-Shot' weapon.",
        type: "minor",
        staticBonuses: skill("kill"),
        pickFrom: pickFrom({}),
    },
    {
        name: "Last Rites",
        description: "Gain 'Religion' domain. Ask the spirit of a recently dead person a single question before it fades away.",
        type: "minor",
        staticBonuses: domain("religion"),
        pickFrom: pickFrom({}),
    },
    {
        name: "Marked for Death",
        description: "Gain 'Hunt' skill. You can mark prey by observing them for 10 minutes. When hunting them, roll with 'Mastery'.",
        type: "minor",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({}),
    },
    {
        name: "Shadow",
        description: "Gain 'Sneak' skill. Blow out a lit candle to extinguish all light sources nearby.",
        type: "minor",
        staticBonuses: skill("sneak"),
        pickFrom: pickFrom({}),
    },
    {
        name: "Survivor",
        description: "Get +1 to one of the following protections: 'Blood', 'Echo', 'Fortune', 'Supplies'. Can be picked more than once.",
        type: "minor",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({ protections: ["blood", "echo", "fortune", "supplies"] }),
        // TODOdin: Make more-than-once selectable
    },
    {
        name: "Tattered Soul",
        description: "Gain 'Cursed' domain and +1 'Echo' protection.",
        type: "minor",
        staticBonuses: {
            domains: ["cursed"],
            protections: [{ resistance: "echo", amount: 1 }],
            skills: [],
        },
        pickFrom: pickFrom({}),
    },
    {
        name: "Walking Reliquary",
        description: "Gain +2 'Supplies' protection",
        type: "minor",
        staticBonuses: protection("supplies", 2),
        pickFrom: pickFrom({}),
    },
    // Major

    // Descent
    {
        name: "Descent",
        description:
            "When you are in the Grey, you may delve to one of the eight landmark Heavens (choose which one when taking this). The delve is 'Risky' unless you and your companions dress in ritual garb and make preparations to enter the target Heaven. Returning requires another delve.",
        type: "major",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({}),
    },
    {
        name: "Esoteric Cartographer",
        description: "Choose two additional heavens you can access from the Grey.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Descent",
        pickFrom: pickFrom({}),
    },
    {
        name: "Step Between",
        description:
            "You can leave a Heaven and arrive at a different landmark than the one you started at. Your exit point must be within the same tier and share a domain with the Heaven you're exiting. If you've never been there, the delve is 'Risky'.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Descent",
        pickFrom: pickFrom({}),
    },
    {
        name: "All Doors as One",
        description: "When you use 'Step Between', your destination point can be one tier above or below your current tier.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Descent",
        pickFrom: pickFrom({}),
    },
    // Echoes
    {
        name: "Echoes",
        description:
            "Roll 'Discern' + 'Domain' to witness ghostly recreations of the past in your current location, showing the most dramatic or interesting thing that occured recently.",
        type: "major",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({}),
    },
    {
        name: "Hidden Passageway",
        description: "One per delve, when using 'Echoes', it functions as a D8 boon.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Echoes",
        pickFrom: pickFrom({}),
    },
    {
        name: "Fragmentary Recollection",
        description:
            "When you use 'Echoes', you can speak with the echoes of people present. They're just momentary snapshots of psyches, with all limitations on cognition that entails.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Echoes",
        pickFrom: pickFrom({}),
    },
    {
        name: "Absorb Memories",
        description:
            "Once per session, when in a location with a domain you don't have, activate this power to gain access to that domnain until the end of the session.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Echoes",
        pickFrom: pickFrom({}),
    },
    // Invidious Spectre
    {
        name: "Invidious Spectre",
        description: "Any weapon you carry gains 'Conduit', meaning you can mark D4 stress to 'Mind' to roll with 'Mastery' on attacks for one situation.",
        type: "major",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({}),
    },
    {
        name: "Soothe",
        description: "Once per session, when you mark stress, add +1 to any protection until the end of the session.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Invidious Spectre",
        pickFrom: pickFrom({}),
    },
    {
        name: "Ghoulish Grasp",
        description: "Once per situation, a weapon you carry has 'Debilitating'.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Invidious Spectre",
        pickFrom: pickFrom({}),
    },
    {
        name: "Ethereal Touch",
        description: "If you mark stress to activate 'Conduit', your weapon also gains 'Piercing'.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Invidious Spectre",
        pickFrom: pickFrom({}),
    },
    // Reaper's Strike
    {
        name: "Reaper's Strike",
        description:
            "When attacking, you can choose to lose your 'Blood' protection for the attack before you roll. If you hit, add your 'Blood' protection value to the stress inflicted.",
        type: "major",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({}),
    },
    {
        name: "Inexorable",
        description:
            "If the first dice you roll to determine stress inflicted on an adversary shows 1 or 2, roll an additional dice of the same size and add the result to stress inflicted.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Reaper's Strike",
        pickFrom: pickFrom({}),
    },
    {
        name: "Bloodied but Unbroken",
        description: "When you have 4 of more stress marked to 'Blood' or are suffering from ongoing 'Blood' fallout, gain +2 'Blood' Protection",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Reaper's Strike",
        pickFrom: pickFrom({}),
    },
    {
        name: "Scything Blow",
        description: "Once per situation, treat your weapon as though it has the 'Spread' tag when you inflict stress to an adversary.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Reaper's Strike",
        pickFrom: pickFrom({}),
    },
    // Sudden Death
    {
        name: "Sudden Death",
        description: "'Enter the Grey' no longer takes 10 minutes, it is instantaneous. Bringing others along like this makes the action 'Risky'.",
        type: "major",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({}),
    },
    {
        name: "Liminal",
        description:
            "Gain +2 'Blood' Protection after entering the Grey. You can see and interact with people who are int he living world. You appear to them as a semi-ethereal phantom.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Sudden Death",
        pickFrom: pickFrom({}),
    },
    {
        name: "Entropy",
        description:
            "You hands become 'Kill' D8, 'Dangerous' weapons. You can rust and decay machines by touching them. Doing this under pressure requires a 'Kill' + 'Technology' check.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Sudden Death",
        pickFrom: pickFrom({}),
    },
    {
        name: "Blood Sacrifice",
        description:
            "Once per situation, when inflicting stress on an adversary that's roughly the same size as you in melee combat, you can transport both of you to the Grey.",
        type: "minor",
        staticBonuses: noBonuses(),
        parentName: "Sudden Death",
        pickFrom: pickFrom({}),
    },
    // Zenith
    {
        name: "Extinguish",
        description:
            "You can draw any person, entity, landmark or concept (except the Heart itself) into a physical vessel and kill it, destroying the concept and yourself in a final strike. The difficulty of the fight is determined by the GM.",
        type: "zenith",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({}),
    },
    {
        name: "Infernal Claws",
        description:
            "You can drag someone to hell or summon hell to a landmark, trapping the person or place in eternal torment. Doing this consumes your life essence and you die.",
        type: "zenith",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({}),
    },
    {
        name: "Sunder the Veil",
        description: "When you die, all nearby allies remove all ongoing fallout and stress, and they gain 'Mastery' on all rolls for the situation.",
        type: "zenith",
        staticBonuses: noBonuses(),
        pickFrom: pickFrom({}),
    },
]
