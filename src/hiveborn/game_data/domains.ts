import { FaRegMoon, FaTree } from "react-icons/fa6"
import { GiCursedStar, GiDesert } from "react-icons/gi"
import { GoGear } from "react-icons/go"
import { LuRat } from "react-icons/lu"
import { PiHouseLineLight } from "react-icons/pi"
import { TbCrystalBall } from "react-icons/tb"

import { ReactNode } from "react"

export const domains = ["cursed", "desolate", "haven", "occult", "religion", "technology", "warren", "wild"] as const
export type DomainKey = (typeof domains)[number]

export const domainDescriptions: Record<DomainKey, string> = {
    cursed: "Dangerous places marked by the Heart.",
    desolate: "Wastelands and abandoned towns.",
    haven: "Settlements where people live, work, and form communities.",
    occult: "Hidden knowledge and black magic.",
    religion: "Gods and things worshipped like gods.",
    technology: "Machines, buildings, and devices.",
    warren: "Cramped, dense corridors.",
    wild: "Wilderness, vegetation, and animals.",
}

export const isDomain = (maybeDomain: string | DomainKey): maybeDomain is DomainKey => {
    return domains.includes(maybeDomain as DomainKey)
}

export const iconByDomain: Record<DomainKey, ReactNode> = {
    cursed: GiCursedStar({}),
    desolate: GiDesert({}),
    haven: PiHouseLineLight({}),
    occult: TbCrystalBall({}),
    religion: FaRegMoon({}),
    technology: GoGear({}),
    warren: LuRat({}),
    wild: FaTree({}),
}
