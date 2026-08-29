import { ReactNode } from "react"
import { FaMagnifyingGlass } from "react-icons/fa6"
import { GiBowArrow, GiBrickWall, GiNinjaHeroicStance } from "react-icons/gi"
import { LuSpeech } from "react-icons/lu"
import { MdHealing } from "react-icons/md"
import { PiShovel, PiSneakerMove } from "react-icons/pi"
import { RiKnifeBloodLine } from "react-icons/ri"

export const skills = ["compel", "delve", "discern", "endure", "evade", "hunt", "kill", "mend", "sneak"] as const
export type SkillKey = (typeof skills)[number]

export const skillDescriptions: Record<SkillKey, string> = {
    compel: "Get someone to do what you want through threats, lies, flattery, or reason.",
    delve: "Press into dangerous or unknown territory.",
    discern: "Understand the world using information you can access.",
    endure: "Resist the Heart's effects on body and mind.",
    evade: "Escape someone or something that is tracking you down.",
    hunt: "Track down someone or something trying to escape you.",
    kill: "Fight or destroy things",
    mend: "Repair what is broken, or build something new.",
    sneak: "Hide yourself or something from others' attention.",
}

export const isSkill = (maybeSkill: string | SkillKey): maybeSkill is SkillKey => {
    return skills.includes(maybeSkill as SkillKey)
}

export const iconBySkill: Record<SkillKey, string | ReactNode> = {
    kill: RiKnifeBloodLine({}),
    hunt: GiBowArrow({}),
    mend: MdHealing({}),
    compel: LuSpeech({}),
    delve: PiShovel({}),
    discern: FaMagnifyingGlass({}),
    endure: GiBrickWall({}),
    evade: PiSneakerMove({}),
    sneak: GiNinjaHeroicStance({}),
}
