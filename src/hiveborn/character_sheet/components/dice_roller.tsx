import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { type CSSProperties, type PointerEvent, useEffect, useMemo, useRef, useState } from "react"
import { useCharacterStore } from "../character_states"
import { RollRisk, useDiceRollerStore } from "../dice_roller_state"
import { domains } from "../../game_data/domains"
import { skills } from "../../game_data/skills"

type DieRoll = {
    id: number
    value: number
    sides: DieSize
    removed: boolean
}

type RollResult = {
    value: number
    title: string
    description: string
}

type RollerTab = "skill-domain" | "free-roll"
type DieSize = 4 | 6 | 8 | 10 | 12

const dieSizes: DieSize[] = [4, 6, 8, 10, 12]
const maxFreeDiceCount = 12

const rollerTabs: { value: RollerTab; label: string }[] = [
    { value: "skill-domain", label: "Skill/Domain" },
    { value: "free-roll", label: "Free Roll" },
]

const d10FaceCount = 10

const risks: { value: RollRisk; label: string }[] = [
    { value: "normal", label: "Normal" },
    { value: "risky", label: "Risky" },
    { value: "dangerous", label: "Dangerous" },
]

const getResult = (value: number): RollResult => {
    if (value === 1) {
        return { value, title: "Crit fail", description: "Fail & double stress" }
    }
    if (value <= 5) {
        return { value, title: "Failure", description: "Fail & stress" }
    }
    if (value <= 7) {
        return { value, title: "Success at cost", description: "Succeed & stress" }
    }
    if (value <= 9) {
        return { value, title: "Success", description: "Succeed & no stress" }
    }
    return { value, title: "Crit success", description: "Increase outgoing stress dice by 1 step" }
}

const getRemovedIndexes = (values: number[], risk: RollRisk) => {
    const removeCount = risk === "dangerous" ? 2 : risk === "risky" ? 1 : 0
    if (removeCount === 0) return new Set<number>()

    const indexesByHighest = values.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value || a.index - b.index)

    const maxRemovable = Math.max(0, values.length - 1)
    return new Set(indexesByHighest.slice(0, Math.min(removeCount, maxRemovable)).map(({ index }) => index))
}

const getD10DieTransform = (faceIndex: number) => {
    if (faceIndex % 2 === 0) {
        return `rotateX(-45deg) rotateY(${72 * (faceIndex / 2)}deg)`
    }

    return `rotateX(-225deg) rotateY(${-72 * ((faceIndex + 1) / 2)}deg)`
}

const getD10RollTransform = (faceIndex: number) => {
    if (faceIndex % 2 === 0) {
        return `rotateX(${675}deg) rotateY(${1080 + 72 * (faceIndex / 2)}deg) rotateZ(720deg)`
    }

    return `rotateX(${495}deg) rotateY(${-1080 - 72 * ((faceIndex + 1) / 2)}deg) rotateZ(720deg)`
}

const d4Transforms: Record<number, string> = {
    1: "rotateX(0deg) rotateY(0deg) rotateZ(0deg)",
    2: "rotateX(0deg) rotateY(120deg) rotateZ(0deg)",
    3: "rotateX(0deg) rotateY(240deg) rotateZ(0deg)",
    4: "rotateX(0deg) rotateY(60deg) rotateZ(0deg)",
}

const d6Transforms: Record<number, string> = {
    1: "rotateX(-18deg) rotateY(-24deg)",
    2: "rotateX(-18deg) rotateY(-114deg)",
    3: "rotateX(-108deg) rotateY(-24deg)",
    4: "rotateX(72deg) rotateY(-24deg)",
    5: "rotateX(-18deg) rotateY(66deg)",
    6: "rotateX(-18deg) rotateY(156deg)",
}

const d8Transforms: Record<number, string> = {
    1: "rotateX(-34deg) rotateY(45deg)",
    2: "rotateX(-34deg) rotateY(135deg)",
    3: "rotateX(-34deg) rotateY(225deg)",
    4: "rotateX(-34deg) rotateY(315deg)",
    5: "rotateX(-146deg) rotateY(45deg)",
    6: "rotateX(-146deg) rotateY(135deg)",
    7: "rotateX(-146deg) rotateY(225deg)",
    8: "rotateX(-146deg) rotateY(315deg)",
}

const d12Transforms: Record<number, string> = {
    1: "rotateX(-16deg) rotateY(0deg)",
    2: "rotateX(-16deg) rotateY(72deg)",
    3: "rotateX(-16deg) rotateY(144deg)",
    4: "rotateX(-16deg) rotateY(216deg)",
    5: "rotateX(-16deg) rotateY(288deg)",
    6: "rotateX(-86deg) rotateY(36deg)",
    7: "rotateX(-86deg) rotateY(108deg)",
    8: "rotateX(-86deg) rotateY(180deg)",
    9: "rotateX(-86deg) rotateY(252deg)",
    10: "rotateX(-86deg) rotateY(324deg)",
    11: "rotateX(-156deg) rotateY(0deg)",
    12: "rotateX(24deg) rotateY(0deg)",
}

const createPendingDice = (count: number, sides: DieSize) =>
    Array.from({ length: count }, (_, index) => ({
        id: -(index + 1),
        value: sides,
        sides,
        removed: false,
    }))

const rollDice = (count: number, sides: DieSize, getRemovedIndexSet: (values: number[]) => Set<number> = () => new Set<number>()) => {
    const values = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
    const removedIndexes = getRemovedIndexSet(values)

    return values.map((value, index) => ({ id: Date.now() + index, value, sides, removed: removedIndexes.has(index) }))
}

const capitalize = (value: string) => `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`

const d4FaceNumbers = [
    [1, 2, 3],
    [1, 4, 2],
    [1, 3, 4],
    [4, 3, 2],
]

const d4OriginX = "105%"

const D4Die = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    const isRemoved = !rolling && die.removed
    const finalYaw = die.value === 1 ? 0 : die.value === 2 ? 120 : die.value === 3 ? 240 : 60

    return (
        <div className={cn("heart-d4-shell", isRemoved && "heart-d4-shell-removed")} style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}>
            <div
                className={cn("heart-d4", rolling && "heart-d4-rolling")}
                style={
                    {
                        "--target-transform": d4Transforms[die.value],
                        "--roll-transform": `rotateX(0deg) rotateY(${1080 + finalYaw}deg) rotateZ(0deg)`,
                        "--d4-origin-x": d4OriginX,
                    } as CSSProperties
                }
            >
                {d4FaceNumbers.map((numbers, face) => (
                    <figure key={face} className={`heart-d4-face heart-d4-face-${face + 1}`}>
                        {numbers.map((number, numberIndex) => (
                            <span key={`${number}-${numberIndex}`} className="heart-d4-number">
                                {number}
                            </span>
                        ))}
                    </figure>
                ))}
            </div>
        </div>
    )
}

const D6Die = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    const isRemoved = !rolling && die.removed

    return (
        <div className={cn("heart-d6-shell", isRemoved && "heart-d6-shell-removed")} style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}>
            <div
                className={cn("heart-d6", rolling && "heart-d6-rolling")}
                style={
                    {
                        "--target-transform": d6Transforms[die.value],
                        "--roll-transform": `rotateX(${720 + die.value * 91}deg) rotateY(${900 + die.value * 67}deg) rotateZ(720deg)`,
                    } as CSSProperties
                }
            >
                {Array.from({ length: 6 }).map((_, face) => (
                    <figure key={face} className={`heart-d6-face heart-d6-face-${face + 1}`}>
                        <span>{face + 1}</span>
                    </figure>
                ))}
            </div>
        </div>
    )
}

const D8Die = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    const isRemoved = !rolling && die.removed

    return (
        <div className={cn("heart-d8-shell", isRemoved && "heart-d8-shell-removed")} style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}>
            <div
                className={cn("heart-d8", rolling && "heart-d8-rolling")}
                style={
                    {
                        "--target-transform": d8Transforms[die.value],
                        "--roll-transform": `rotateX(${720 + die.value * 53}deg) rotateY(${1080 + die.value * 71}deg) rotateZ(720deg)`,
                    } as CSSProperties
                }
            >
                {Array.from({ length: 8 }).map((_, face) => (
                    <figure key={face} className={`heart-d8-face heart-d8-face-${face + 1}`}>
                        <span>{face + 1}</span>
                    </figure>
                ))}
            </div>
        </div>
    )
}

const D10Die = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    const faceIndex = die.value === 10 ? 0 : die.value
    const isRemoved = !rolling && die.removed

    return (
        <div className={cn("heart-d10-shell", isRemoved && "heart-d10-shell-removed")} style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}>
            <div
                className={cn("heart-d10", rolling && "heart-d10-rolling")}
                data-face={faceIndex}
                style={
                    {
                        "--target-transform": getD10DieTransform(faceIndex),
                        "--roll-transform": getD10RollTransform(faceIndex),
                    } as CSSProperties
                }
            >
                {Array.from({ length: d10FaceCount }).map((_, face) => (
                    <figure key={face} className={`heart-d10-face heart-d10-face-${face}`}>
                        <span>{face === 0 ? 10 : face}</span>
                    </figure>
                ))}
            </div>
        </div>
    )
}

const D12Die = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    const isRemoved = !rolling && die.removed

    return (
        <div className={cn("heart-d12-shell", isRemoved && "heart-d12-shell-removed")} style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}>
            <div
                className={cn("heart-d12", rolling && "heart-d12-rolling")}
                style={
                    {
                        "--target-transform": d12Transforms[die.value],
                        "--roll-transform": `rotateX(${720 + die.value * 31}deg) rotateY(${1080 + die.value * 59}deg) rotateZ(720deg)`,
                    } as CSSProperties
                }
            >
                {Array.from({ length: 12 }).map((_, face) => (
                    <figure key={face} className={`heart-d12-face heart-d12-face-${face + 1}`}>
                        <span>{face + 1}</span>
                    </figure>
                ))}
            </div>
        </div>
    )
}

const AnimatedDie = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    if (die.sides === 4) return <D4Die die={die} rolling={rolling} index={index} />
    if (die.sides === 6) return <D6Die die={die} rolling={rolling} index={index} />
    if (die.sides === 8) return <D8Die die={die} rolling={rolling} index={index} />
    if (die.sides === 12) return <D12Die die={die} rolling={rolling} index={index} />
    return <D10Die die={die} rolling={rolling} index={index} />
}

const DiceScene = ({ dice, rolling }: { dice: DieRoll[]; rolling: boolean }) => {
    return (
        <div className="heart-dice-stage" aria-label="Animated 3D dice roll">
            <div className={cn("heart-dice-row", dice.length > 2 && "heart-dice-row-compact", dice.length > 4 && "heart-dice-row-many")}>
                {dice.map((die, index) => (
                    <AnimatedDie key={die.id} die={die} rolling={rolling} index={index} />
                ))}
            </div>
        </div>
    )
}

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
    const [activeTab, setActiveTab] = useState<RollerTab>("skill-domain")
    const [dice, setDice] = useState<DieRoll[]>([{ id: 0, value: 10, sides: 10, removed: false }])
    const [freeDiceCount, setFreeDiceCount] = useState(3)
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
        }, 1600)
    }

    const handleFreeRoll = () => {
        if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current)

        setDice(rollDice(freeDiceCount, freeDieSize))
        setResult(null)
        setRolling(true)
        rollTimeoutRef.current = window.setTimeout(() => {
            setRolling(false)
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
            className="hiveborn-dice-roller fixed left-1/2 top-1/2 z-[70] w-[min(720px,calc(100vw-2rem))] rounded-lg border border-red-900/25 bg-background p-5 text-left text-red-950 shadow-2xl"
            style={
                {
                    "--dice-drag-x": `${dragOffset.x}px`,
                    "--dice-drag-y": `${dragOffset.y}px`,
                } as CSSProperties
            }
        >
            <div
                className="mb-4 flex cursor-move touch-none items-start justify-between gap-4 border-b border-red-900/10 pb-3"
                onPointerDown={handleDragStart}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
            >
                <div>
                    <h2 id="dice-roller-title" className="text-xl font-bold">
                        Heart Dice Roller
                    </h2>
                    <p className="text-sm text-red-900/70">
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

            <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-md border border-red-900/20">
                {rollerTabs.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        className={cn(
                            "h-10 border-r border-red-900/15 text-sm font-semibold last:border-r-0 disabled:cursor-not-allowed disabled:opacity-60",
                            activeTab === tab.value ? "bg-red-900 text-white" : "bg-background text-red-900 hover:bg-red-50",
                        )}
                        disabled={rolling}
                        onClick={() => setActiveTab(tab.value)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === "skill-domain" ? (
                <>
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                        <label className="grid gap-1 text-sm font-semibold">
                            Skill
                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                                value={selectedSkill}
                                disabled={rolling}
                                onChange={(event) => setSelectedSkill(event.target.value as typeof selectedSkill)}
                            >
                                <option value="">No relevant skill</option>
                                {trainedSkills.map((skill) => (
                                    <option key={skill} value={skill}>
                                        {capitalize(skill)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="grid gap-1 text-sm font-semibold">
                            Domain
                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                                value={selectedDomain}
                                disabled={rolling}
                                onChange={(event) => setSelectedDomain(event.target.value as typeof selectedDomain)}
                            >
                                <option value="">No relevant domain</option>
                                {trainedDomains.map((domain) => (
                                    <option key={domain} value={domain}>
                                        {capitalize(domain)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex items-end gap-2 pb-2 text-sm font-semibold">
                            <Checkbox checked={hasMastery} disabled={rolling} onCheckedChange={(checked) => setHasMastery(checked === true)} />
                            Mastery
                        </label>
                    </div>

                    <div className="my-4 grid grid-cols-3 overflow-hidden rounded-md border border-red-900/20">
                        {risks.map((riskOption) => (
                            <button
                                key={riskOption.value}
                                type="button"
                                className={cn(
                                    "h-10 border-r border-red-900/15 text-sm font-semibold last:border-r-0 disabled:cursor-not-allowed disabled:opacity-60",
                                    risk === riskOption.value ? "bg-red-900 text-white" : "bg-background text-red-900 hover:bg-red-50",
                                )}
                                disabled={rolling}
                                onClick={() => setRisk(riskOption.value)}
                            >
                                {riskOption.label}
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold">
                        Dice
                        <input
                            type="number"
                            min={1}
                            max={maxFreeDiceCount}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                            value={freeDiceCount}
                            disabled={rolling}
                            onChange={(event) => {
                                const nextCount = Math.min(maxFreeDiceCount, Math.max(1, Number(event.target.value) || 1))
                                setFreeDiceCount(nextCount)
                            }}
                        />
                    </label>

                    <label className="grid gap-1 text-sm font-semibold">
                        Size
                        <select
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                            value={freeDieSize}
                            disabled={rolling}
                            onChange={(event) => setFreeDieSize(Number(event.target.value) as DieSize)}
                        >
                            {dieSizes.map((dieSize) => (
                                <option key={dieSize} value={dieSize}>
                                    d{dieSize}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            )}

            <Button type="button" size="lg" className="h-14 w-full text-lg font-black tracking-wide" disabled={rolling} onClick={handleRoll}>
                ROLL
            </Button>

            <div className="mt-4">
                <DiceScene dice={dice} rolling={rolling} />
            </div>

            {activeTab === "skill-domain" && (
                <div className="mt-4 flex h-32 items-center justify-center overflow-hidden rounded-md border border-red-900/20 bg-red-50/70 p-4 text-center">
                    {rolling ? (
                        <div className="heart-loading-dots" aria-label="Rolling dice">
                            <span />
                            <span />
                            <span />
                        </div>
                    ) : result ? (
                        <div className="grid gap-1">
                            <div className="text-5xl font-black leading-none">{result.value}</div>
                            <div className="text-xl font-bold">{result.title}</div>
                            <div className="text-sm font-semibold text-red-900/75">{result.description}</div>
                        </div>
                    ) : (
                        <div className="flex h-16 items-center justify-center text-sm font-semibold text-red-900/60">Ready</div>
                    )}
                </div>
            )}
        </div>
    )
}

export default DiceRoller
