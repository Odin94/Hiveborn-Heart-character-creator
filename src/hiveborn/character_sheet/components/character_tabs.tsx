import { useIsLargeScreen } from "@/hooks/useIsLargeScreen"
import { useCharacterStore } from "../character_states"
import { Character } from "../../game_data/character"
import { ChevronDown, Dices, Plus, X } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useDiceRollerStore } from "../dice_roller_state"

interface CharacterTabsProps {
    onDeleteCharacter: (index: number) => void
}

const CharacterTabs = ({ onDeleteCharacter }: CharacterTabsProps) => {
    const { characters, currentCharacterIndex, setCurrentCharacter, addCharacter } = useCharacterStore()
    const setDiceRollerOpen = useDiceRollerStore.use.setOpen()
    const isLargeScreen = useIsLargeScreen()
    const [isMobileTabsVisible, setIsMobileTabsVisible] = useState(false)
    const [deletingIndex, setDeletingIndex] = useState<number | null>(null)

    const handleDeleteCharacter = (index: number) => {
        if (deletingIndex === index && characters.length > 1) {
            onDeleteCharacter(index)
            setDeletingIndex(null)
        }
    }

    const handleOpenDeleteDialog = (index: number) => {
        setDeletingIndex(index)
    }

    const renderCharacterTab = (character: Character, index: number) => {
        const characterName = character?.name || ""
        const displayName = characterName.split(" ")[0] || `Character ${index + 1}`
        const truncatedName = displayName.length > 13 ? displayName.substring(0, 11) + "..." : displayName

        return (
            <div
                key={index}
                className={`relative group flex w-40 cursor-pointer items-center gap-2 rounded-r-lg border border-primary/15 py-3 pl-6 shadow-lg transition-[margin,transform,box-shadow,background-color] duration-200 ease-out hover:duration-150 animate-in slide-in-from-left-4 fade-in ${
                    currentCharacterIndex === index
                        ? "bg-secondary text-secondary-foreground shadow-primary/10"
                        : "bg-card/80 text-secondary-foreground/80 hover:bg-secondary/60"
                }
                ${isLargeScreen ? "-ml-2.5 hover:ml-0" : "rounded-l-lg"}
                `}
                onClick={() => setCurrentCharacter(index)}
                style={{
                    transition: "margin 200ms ease-out, transform 150ms ease-out, box-shadow 150ms ease-out",
                }}
            >
                <span className={`text-sm font-medium whitespace-nowrap`}>{truncatedName}</span>
                {characters.length > 1 && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenDeleteDialog(index)
                                }}
                                className={`${
                                    isLargeScreen ? "opacity-0" : "opacity-100"
                                } group-hover:opacity-100 rounded p-1 ml-2 transition-[background-color,opacity,transform] duration-150 hover:bg-red-500 hover:text-white active:scale-[.97]`}
                            >
                                <X size={12} />
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Delete Character?</DialogTitle>
                                <DialogDescription>Are you sure you want to delete "{displayName}"? This action cannot be undone.</DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="secondary">Cancel</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                    <Button variant="destructive" onClick={() => handleDeleteCharacter(index)}>
                                        Delete Character
                                    </Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        )
    }

    const renderAddCharacterButton = () => {
        return (
            <div className="mt-3 flex w-40 justify-center transition-all duration-200">
                <div
                    className="relative group flex size-10 cursor-pointer items-center justify-center rounded-full border border-primary/15 bg-card/80 text-muted-foreground shadow-sm transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:bg-secondary hover:shadow-md active:scale-[.97]"
                    onClick={() => addCharacter()}
                >
                    <Plus size={16} />
                </div>
            </div>
        )
    }

    const renderDiceRollerButton = () => {
        return (
            <div className="mt-3 flex w-40 justify-center transition-all duration-200">
                <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-10 rounded-full shadow-lg"
                    title="Open dice roller"
                    aria-label="Open dice roller"
                    onClick={() => setDiceRollerOpen(true)}
                >
                    <Dices size={18} />
                </Button>
            </div>
        )
    }

    return (
        <>
            {/* Desktop version - Left side (screens >= 2100px) */}
            {isLargeScreen && (
                <div className="fixed left-0 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-1 transition-all duration-200">
                    {characters.map(renderCharacterTab)}

                    {renderAddCharacterButton()}
                    {renderDiceRollerButton()}
                </div>
            )}

            {/* Mobile/Tablet version - Bottom (screens < 2100px) */}
            {!isLargeScreen && (
                <div className="mt-5 flex flex-col">
                    <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-12 rounded-full shadow-xl sm:hidden"
                        title="Open dice roller"
                        aria-label="Open dice roller"
                        onClick={() => setDiceRollerOpen(true)}
                    >
                        <Dices size={20} />
                    </Button>
                    {/* Caret button - always visible at bottom */}
                    <div className="flex justify-center py-4">
                        <button
                            onClick={() => setIsMobileTabsVisible(!isMobileTabsVisible)}
                            className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-primary/15 bg-card/90 text-muted-foreground shadow-lg transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:bg-secondary active:scale-[.97]"
                        >
                            <ChevronDown size={16} className={`transition-transform duration-200 ${isMobileTabsVisible ? "rotate-180" : ""}`} />
                        </button>
                    </div>

                    {/* Bottom bar - slides up/down */}
                    <div
                        className={`overflow-hidden transition-[max-height,opacity] duration-200 ${
                            isMobileTabsVisible ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                        }`}
                    >
                        <div className="bg-card/90 backdrop-blur-sm border-t border-border rounded-lg">
                            <div className="flex flex-col items-center gap-3 p-4">
                                <div className="flex flex-wrap items-center justify-center gap-2">{characters.map(renderCharacterTab)}</div>

                                {renderAddCharacterButton()}
                                {renderDiceRollerButton()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default CharacterTabs
