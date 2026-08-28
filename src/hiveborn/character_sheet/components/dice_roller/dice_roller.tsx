import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { type CSSProperties, type PointerEvent, useEffect, useMemo, useRef, useState } from "react"
import { useCharacterStore } from "../../character_states"
import { useDiceRollerStore } from "../../dice_roller_state"
import { domains } from "../../../game_data/domains"
import { skills } from "../../../game_data/skills"
import FreeRollControls from "./controls/free_roll_controls"
import RollResultPanel from "./controls/roll_result_panel"
import SkillDomainControls from "./controls/skill_domain_controls"
import TabSwitcher from "./controls/tab_switcher"
import DiceScene from "./dice_scene"
import { createPendingDice, getRemovedIndexes, getResult, rollDice } from "./roll_utils"
import { DieRoll, DieSize, RollerTab, RollResult } from "./types"
import { Checkbox } from "@/components/ui/checkbox"
import { usePlayModeStore } from "@/lib/playMode"
import { api } from "@/lib/api"
import { toast } from "sonner"

const DiceRoller = () => {
    const isOpen = useDiceRollerStore.use.isOpen()
    const selectedSkill = useDiceRollerStore.use.selectedSkill()
    const selectedDomain = useDiceRollerStore.use.selectedDomain()
    const hasMastery = useDiceRollerStore.use.hasMastery()
    const risk = useDiceRollerStore.use.risk()
    const setOpen = useDiceRollerStore.use.setOpen()
    const setSelectedSkill = useDiceRollerStore.use.setSelectedSkill()
    const setSelectedDomain = useDiceRollerStore.use.setSelectedDomain()
    const setHasMastery = useDiceRollerStore.use.setHasMastery()
    const setRisk = useDiceRollerStore.use.setRisk()
    const characterSkills = useCharacterStore.use.skills()
    const characterDomains = useCharacterStore.use.domains()
    const characterName = useCharacterStore.use.name()
    const activeGroupId = usePlayModeStore((state) => state.activeGroupId)
    const shareRolls = usePlayModeStore((state) => state.shareRolls)
    const setShareRolls = usePlayModeStore((state) => state.setShareRolls)
    const [activeTab, setActiveTab] = useState<RollerTab>("skill-domain")
    const [dice, setDice] = useState<DieRoll[]>([{ id: 0, value: 10, sides: 10, removed: false }])
    const [freeDiceCount, setFreeDiceCount] = useState(1)
    const [freeDieSize, setFreeDieSize] = useState<DieSize>(6)
    const [rolling, setRolling] = useState(false)
    const [result, setResult] = useState<RollResult | null>(null)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const dragRef = useRef<{ pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)
    const rollTimeoutRef = useRef<number | undefined>(undefined)
    const trainedSkills = useMemo(() => skills.filter((skill) => characterSkills[skill]?.hasSkill), [characterSkills])
    const trainedDomains = useMemo(() => domains.filter((domain) => characterDomains[domain]?.hasDomain), [characterDomains])

    const diceCount = useMemo(() => {
        const skillDie = selectedSkill && characterSkills[selectedSkill]?.hasSkill ? 1 : 0
        const domainDie = selectedDomain && characterDomains[selectedDomain]?.hasDomain ? 1 : 0
        return Math.min(4, 1 + skillDie + domainDie + (hasMastery ? 1 : 0))
    }, [characterDomains, characterSkills, hasMastery, selectedDomain, selectedSkill])

    useEffect(() => {
        if (activeTab !== "skill-domain") return

        setDice(createPendingDice(diceCount, 10))
        setResult(null)
    }, [activeTab, diceCount])

    useEffect(() => {
        if (activeTab !== "free-roll") return

        setDice(createPendingDice(freeDiceCount, freeDieSize))
        setResult(null)
    }, [activeTab, freeDiceCount, freeDieSize])

    useEffect(() => {
        if (selectedSkill && !characterSkills[selectedSkill]?.hasSkill) {
            setSelectedSkill("")
        }
    }, [characterSkills, selectedSkill, setSelectedSkill])

    useEffect(() => {
        if (selectedDomain && !characterDomains[selectedDomain]?.hasDomain) {
            setSelectedDomain("")
        }
    }, [characterDomains, selectedDomain, setSelectedDomain])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false)
        }

        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown)
        }

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
        }
    }, [isOpen, setOpen])

    useEffect(() => {
        if (isOpen) {
            setActiveTab("skill-domain")
        }

        if (!isOpen) {
            setRolling(false)
            setResult(null)
            if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current)
        }
    }, [isOpen])

    const handleSkillRoll = () => {
        if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current)

        const nextDice = rollDice(diceCount, 10, (values) => getRemovedIndexes(values, risk))
        const keptValues = nextDice.filter((die) => !die.removed).map((die) => die.value)
        const resultValue = Math.max(...keptValues)

        setDice(nextDice)
        setResult(null)
        setRolling(true)
        rollTimeoutRef.current = window.setTimeout(() => {
            setRolling(false)
            setResult(getResult(resultValue))
            if (activeGroupId && shareRolls) {
                const label = [selectedSkill, selectedDomain].filter(Boolean).join(" + ") || "Heart roll"
                void api
                    .shareRoll(activeGroupId, {
                        characterName: characterName || "Unnamed hiveborn",
                        label,
                        dice: `${diceCount}d10`,
                        result: String(resultValue),
                    })
                    .catch(() => toast.error("Could not share this roll with the group"))
            }
        }, 1600)
    }

    const handleFreeRoll = () => {
        if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current)

        const nextDice = rollDice(freeDiceCount, freeDieSize)
        setDice(nextDice)
        setResult(null)
        setRolling(true)
        rollTimeoutRef.current = window.setTimeout(() => {
            setRolling(false)
            if (activeGroupId && shareRolls)
                void api
                    .shareRoll(activeGroupId, {
                        characterName: characterName || "Unnamed hiveborn",
                        label: "Free roll",
                        dice: `${freeDiceCount}d${freeDieSize}`,
                        result: nextDice.map((die) => die.value).join(", "),
                    })
                    .catch(() => toast.error("Could not share this roll with the group"))
        }, 1600)
    }

    const handleRoll = () => {
        if (activeTab === "skill-domain") {
            handleSkillRoll()
            return
        }

        handleFreeRoll()
    }

    const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
        if (window.matchMedia("(max-width: 639px)").matches) return
        if (event.button !== 0) return
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: dragOffset.x,
            offsetY: dragOffset.y,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
        if (window.matchMedia("(max-width: 639px)").matches) return
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        setDragOffset({
            x: drag.offsetX + event.clientX - drag.startX,
            y: drag.offsetY + event.clientY - drag.startY,
        })
    }

    const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null
        }
    }

    if (!isOpen) return null

    return (
        <div
            role="dialog"
            aria-modal="false"
            aria-labelledby="dice-roller-title"
            className="hiveborn-dice-roller fixed left-1/2 top-1/2 z-[70] w-[min(720px,calc(100vw-2rem))] rounded-lg border border-primary/25 bg-background p-5 text-left text-foreground shadow-2xl"
            style={
                {
                    "--dice-drag-x": `${dragOffset.x}px`,
                    "--dice-drag-y": `${dragOffset.y}px`,
                } as CSSProperties
            }
        >
            <div
                className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex cursor-default touch-auto items-start justify-between gap-4 border-b border-primary/15 bg-background px-5 pt-5 pb-3 sm:cursor-move sm:touch-none"
                onPointerDown={handleDragStart}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
            >
                <div>
                    <h2 id="dice-roller-title" className="text-xl font-bold">
                        Heart Dice Roller
                    </h2>
                    <p className="text-sm text-primary/80">
                        {activeTab === "skill-domain" ? `${diceCount}d10 pool` : `${freeDiceCount}d${freeDieSize} free roll`}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer"
                    aria-label="Close dice roller"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setOpen(false)}
                >
                    <X />
                </Button>
            </div>

            <TabSwitcher activeTab={activeTab} rolling={rolling} setActiveTab={setActiveTab} />

            {activeTab === "skill-domain" ? (
                <SkillDomainControls
                    trainedSkills={trainedSkills}
                    trainedDomains={trainedDomains}
                    selectedSkill={selectedSkill}
                    selectedDomain={selectedDomain}
                    hasMastery={hasMastery}
                    risk={risk}
                    rolling={rolling}
                    setSelectedSkill={setSelectedSkill}
                    setSelectedDomain={setSelectedDomain}
                    setHasMastery={setHasMastery}
                    setRisk={setRisk}
                />
            ) : (
                <FreeRollControls
                    freeDiceCount={freeDiceCount}
                    freeDieSize={freeDieSize}
                    rolling={rolling}
                    setFreeDiceCount={setFreeDiceCount}
                    setFreeDieSize={setFreeDieSize}
                />
            )}

            <label className="mt-4 flex cursor-pointer items-center gap-2 rounded border border-primary/20 p-3 text-sm">
                <Checkbox checked={shareRolls} onCheckedChange={(checked) => setShareRolls(checked === true)} disabled={!activeGroupId} />
                <span>Share this roll with my group{!activeGroupId ? " (choose a play group first)" : ""}</span>
            </label>

            <Button type="button" size="lg" className="mt-2 h-14 w-full text-lg font-black tracking-wide" disabled={rolling} onClick={handleRoll}>
                ROLL
            </Button>

            <div className="mt-4">
                <DiceScene dice={dice} rolling={rolling} />
            </div>

            {activeTab === "skill-domain" && <RollResultPanel rolling={rolling} result={result} />}
        </div>
    )
}

export default DiceRoller
