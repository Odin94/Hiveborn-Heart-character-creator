import { Button } from "@/components/ui/button"
import { HeartSigil } from "@/components/ui/sigil"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Hint } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Dices, GripHorizontal, X } from "lucide-react"
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
import { getRollOutcome } from "./outcome"
import { getRollRevealMs } from "./reduced_motion"
import { DieRoll, DieSize, RollerTab, RollResult } from "./types"

const rollAnimationMs = 1600
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
    const cloudCharacterId = useCharacterStore((state) => state.cloudCharacterIds[state.currentCharacterIndex])
    const characterName = useCharacterStore((state) => state.characters[state.currentCharacterIndex]?.name || `Character ${state.currentCharacterIndex + 1}`)
    const activeGroupId = usePlayModeStore((state) => state.activeGroupId)
    const activeGroupName = usePlayModeStore((state) => state.activeGroupName)
    const activeGroupCharacterIds = usePlayModeStore((state) => state.activeGroupCharacterIds)
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
    const rollButtonRef = useRef<HTMLButtonElement>(null)
    // Stay mounted briefly after closing so the panel can animate out.
    const [present, setPresent] = useState(isOpen)
    if (isOpen && !present) setPresent(true)
    const trainedSkills = useMemo(() => skills.filter((skill) => characterSkills[skill]?.hasSkill), [characterSkills])
    const trainedDomains = useMemo(() => domains.filter((domain) => characterDomains[domain]?.hasDomain), [characterDomains])
    const canShareRoll = Boolean(activeGroupId && cloudCharacterId && activeGroupCharacterIds.includes(cloudCharacterId))

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
            // Radix layers (select menus, tooltips) consume Escape first and mark it handled.
            if (event.key === "Escape" && !event.defaultPrevented) setOpen(false)
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
            rollButtonRef.current?.focus({ preventScroll: true })
        }

        if (!isOpen) {
            setRolling(false)
            setResult(null)
            if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current)
            const exitTimer = window.setTimeout(() => setPresent(false), 160)
            return () => window.clearTimeout(exitTimer)
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
            if (shareRolls && canShareRoll && activeGroupId && cloudCharacterId) {
                const label = [selectedSkill, selectedDomain].filter(Boolean).join(" + ") || "Heart roll"
                void api
                    .shareRoll(activeGroupId, {
                        characterId: cloudCharacterId,
                        label,
                        dice: `${diceCount}d10`,
                        result: String(resultValue),
                    })
                    .catch(() => toast.error("Could not share this roll with the group"))
            }
        }, getRollRevealMs(rollAnimationMs))
    }

    const handleFreeRoll = () => {
        if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current)

        const nextDice = rollDice(freeDiceCount, freeDieSize)
        setDice(nextDice)
        setResult(null)
        setRolling(true)
        rollTimeoutRef.current = window.setTimeout(() => {
            setRolling(false)
            if (shareRolls && canShareRoll && activeGroupId && cloudCharacterId)
                void api
                    .shareRoll(activeGroupId, {
                        characterId: cloudCharacterId,
                        label: "Free roll",
                        dice: `${freeDiceCount}d${freeDieSize}`,
                        result: nextDice.map((die) => die.value).join(", "),
                    })
                    .catch(() => toast.error("Could not share this roll with the group"))
        }, getRollRevealMs(rollAnimationMs))
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

    if (!isOpen && !present) return null

    const hasRolled = !rolling && dice.some((die) => die.id > 0)
    const featuredIndex = result ? dice.findIndex((die) => !die.removed && die.value === result.value) : -1
    const freeRollValues = activeTab === "free-roll" && hasRolled ? dice.map((die) => die.value) : null
    const shareReason = canShareRoll
        ? ""
        : !activeGroupId
          ? " — choose a play group first."
          : !cloudCharacterId
            ? " — wait for this sheet to sync, then add it to the group."
            : " — add this sheet to the active group first."

    return (
        <div
            role="dialog"
            aria-modal="false"
            aria-labelledby="dice-roller-title"
            // Not data-state: descendants style themselves with in-data-[state=open]
            data-roller-state={isOpen ? "open" : "closed"}
            className="hiveborn-dice-roller fixed top-1/2 left-1/2 z-(--z-modal) flex w-[min(42rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border-strong/60 bg-popover text-left text-popover-foreground"
            style={
                {
                    "--dice-drag-x": `${dragOffset.x}px`,
                    "--dice-drag-y": `${dragOffset.y}px`,
                } as CSSProperties
            }
        >
            <div
                className="dice-roller-handle flex shrink-0 cursor-default touch-auto items-center gap-3 border-b border-border px-4 py-3 select-none sm:cursor-grab sm:touch-none sm:px-5"
                onPointerDown={handleDragStart}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
            >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground [box-shadow:inset_0_1px_0_oklch(1_0_0/0.16),var(--elev-xs)]">
                    <HeartSigil className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 id="dice-roller-title" className="font-display text-xl leading-tight font-bold">
                        Heart Dice Roller
                    </h2>
                    <p className="text-sm font-semibold text-heart tabular-nums">
                        {activeTab === "skill-domain" ? `${diceCount}d10 pool` : `${freeDiceCount}d${freeDieSize} free roll`}
                    </p>
                </div>
                <GripHorizontal className="hidden size-5 shrink-0 text-muted-foreground/50 sm:block" aria-hidden="true" />
                <Hint label="Close (Esc)">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Close dice roller"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => setOpen(false)}
                    >
                        <X />
                    </Button>
                </Hint>
            </div>

            <div className="scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-4 pb-4 sm:px-5">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RollerTab)} className="gap-4">
                    <TabSwitcher rolling={rolling} />
                    <TabsContent value="skill-domain">
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
                    </TabsContent>
                    <TabsContent value="free-roll">
                        <FreeRollControls
                            freeDiceCount={freeDiceCount}
                            freeDieSize={freeDieSize}
                            rolling={rolling}
                            setFreeDiceCount={setFreeDiceCount}
                            setFreeDieSize={setFreeDieSize}
                        />
                    </TabsContent>
                </Tabs>

                <div className="dice-altar" data-outcome={result && !rolling ? getRollOutcome(result.value) : undefined}>
                    <DiceScene dice={dice} rolling={rolling} featuredIndex={featuredIndex} />
                    {activeTab === "skill-domain" ? (
                        <RollResultPanel rolling={rolling} result={result} />
                    ) : (
                        <div className="roll-readout" data-outcome={freeRollValues ? "free" : rolling ? "rolling" : "idle"}>
                            <div className="roll-readout-body" aria-live="polite">
                                {rolling ? (
                                    <div className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground" aria-label="Rolling dice">
                                        <HeartSigil className="hb-heartbeat size-5 text-heart" />
                                        Rolling…
                                    </div>
                                ) : freeRollValues ? (
                                    <div className="roll-readout-result">
                                        <span className="roll-readout-value">{freeRollValues.reduce((sum, value) => sum + value, 0)}</span>
                                        <div className="min-w-0">
                                            <p className="roll-readout-title">Total</p>
                                            <p className="roll-readout-description tabular-nums">{freeRollValues.join(" · ")}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm font-semibold text-muted-foreground">Ready</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="dice-roller-footer grid shrink-0 gap-3 border-t border-border px-4 pt-3 sm:px-5">
                <label
                    className={cn(
                        "flex items-start gap-2.5 text-sm leading-snug",
                        canShareRoll ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground",
                    )}
                >
                    <Checkbox className="mt-0.5" checked={shareRolls} onCheckedChange={(checked) => setShareRolls(checked === true)} disabled={!canShareRoll} />
                    <span>
                        {canShareRoll ? `Share as ${characterName} in ${activeGroupName ?? "your active group"}` : "Share this roll with my group"}
                        <span className="text-muted-foreground">{shareReason}</span>
                    </span>
                </label>

                <Button ref={rollButtonRef} type="button" size="lg" className="dice-roll-button h-13 w-full" disabled={rolling} onClick={handleRoll}>
                    <Dices className="size-5!" aria-hidden="true" />
                    {rolling ? "Rolling…" : "Roll"}
                </Button>
            </div>
        </div>
    )
}

export default DiceRoller
