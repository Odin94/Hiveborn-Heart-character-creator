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
    removed: boolean
}

type RollResult = {
    value: number
    title: string
    description: string
}

const faceCount = 10

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

const getDieTransform = (faceIndex: number) => {
    if (faceIndex % 2 === 0) {
        return `rotateX(-45deg) rotateY(${72 * (faceIndex / 2)}deg)`
    }

    return `rotateX(-225deg) rotateY(${-72 * ((faceIndex + 1) / 2)}deg)`
}

const getRollTransform = (faceIndex: number) => {
    if (faceIndex % 2 === 0) {
        return `rotateX(${675}deg) rotateY(${1080 + 72 * (faceIndex / 2)}deg) rotateZ(720deg)`
    }

    return `rotateX(${495}deg) rotateY(${-1080 - 72 * ((faceIndex + 1) / 2)}deg) rotateZ(720deg)`
}

const capitalize = (value: string) => `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`

const DiceScene = ({ dice, rolling }: { dice: DieRoll[]; rolling: boolean }) => {
    return (
        <div className="heart-dice-stage" aria-label="Animated 3D dice roll">
            <div className={cn("heart-dice-row", dice.length > 2 && "heart-dice-row-compact")}>
                {dice.map((die, index) => {
                    const faceIndex = die.value === 10 ? 0 : die.value
                    const isRemoved = !rolling && die.removed

                    return (
                        <div
                            key={die.id}
                            className={cn("heart-d10-shell", isRemoved && "heart-d10-shell-removed")}
                            style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}
                        >
                            <div
                                className={cn("heart-d10", rolling && "heart-d10-rolling")}
                                data-face={faceIndex}
                                style={
                                    {
                                        "--target-transform": getDieTransform(faceIndex),
                                        "--roll-transform": getRollTransform(faceIndex),
                                    } as CSSProperties
                                }
                            >
                                {Array.from({ length: faceCount }).map((_, face) => (
                                    <figure key={face} className={`heart-d10-face heart-d10-face-${face}`}>
                                        <span>{face === 0 ? 10 : face}</span>
                                    </figure>
                                ))}
                            </div>
                        </div>
                    )
                })}
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
    const [dice, setDice] = useState<DieRoll[]>([{ id: 0, value: 10, removed: false }])
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
        setDice(
            Array.from({ length: diceCount }, (_, index) => ({
                id: -(index + 1),
                value: 10,
                removed: false,
            })),
        )
        setResult(null)
    }, [diceCount])

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
        if (!isOpen) {
            setRolling(false)
            setResult(null)
            if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current)
        }
    }, [isOpen])

    const handleRoll = () => {
        if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current)

        const values = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 10) + 1)
        const removedIndexes = getRemovedIndexes(values, risk)
        const nextDice = values.map((value, index) => ({ id: Date.now() + index, value, removed: removedIndexes.has(index) }))
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
                    <p className="text-sm text-red-900/70">{diceCount}d10 pool</p>
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

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="grid gap-1 text-sm font-semibold">
                    Skill
                    <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs"
                        value={selectedSkill}
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
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs"
                        value={selectedDomain}
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
                    <Checkbox checked={hasMastery} onCheckedChange={(checked) => setHasMastery(checked === true)} />
                    Mastery
                </label>
            </div>

            <div className="my-4 grid grid-cols-3 overflow-hidden rounded-md border border-red-900/20">
                {risks.map((riskOption) => (
                    <button
                        key={riskOption.value}
                        type="button"
                        className={cn(
                            "h-10 border-r border-red-900/15 text-sm font-semibold last:border-r-0",
                            risk === riskOption.value ? "bg-red-900 text-white" : "bg-background text-red-900 hover:bg-red-50",
                        )}
                        onClick={() => setRisk(riskOption.value)}
                    >
                        {riskOption.label}
                    </button>
                ))}
            </div>

            <Button type="button" size="lg" className="h-14 w-full text-lg font-black tracking-wide" disabled={rolling} onClick={handleRoll}>
                ROLL
            </Button>

            <div className="mt-4">
                <DiceScene dice={dice} rolling={rolling} />
            </div>

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
        </div>
    )
}

export default DiceRoller
