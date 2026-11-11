import { useCharacterStore } from "../character_states"
import { useShallow } from "zustand/react/shallow"
import { BookOpen, Dices, FileJson, PencilLine, Plus, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button, TrashButton } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Hint } from "@/components/ui/tooltip"
import { HeartSigil } from "@/components/ui/sigil"
import { useDiceRollerStore } from "../dice_roller_state"
import { downloadJson } from "./character_buttons"
import { CHARACTER_NAME_INPUT_ID } from "./name_class_calling"

interface CharacterTabsProps {
    onDeleteCharacter: (index: number) => void
}

const tabLabel = (name: string, index: number) => name.trim() || `Character ${index + 1}`

const focusNameInput = () => {
    const input = document.getElementById(CHARACTER_NAME_INPUT_ID)
    if (input instanceof HTMLInputElement) {
        input.focus()
        input.select()
    }
}

/**
 * Folder tabs along the top edge of the dossier: one per character, a context
 * menu for the common actions, and a subtle trash button with a confirmation.
 */
const CharacterTabs = ({ onDeleteCharacter }: CharacterTabsProps) => {
    // Tabs only display identities and names; sheet text/stress edits don't change them.
    const names = useCharacterStore(useShallow((state) => state.characters.map((character) => character.name)))
    const ids = useCharacterStore(useShallow((state) => state.characters.map((character) => character.uuid)))
    const currentCharacterIndex = useCharacterStore.use.currentCharacterIndex()
    const setCurrentCharacter = useCharacterStore.use.setCurrentCharacter()
    const addCharacter = useCharacterStore.use.addCharacter()
    const restoreCharacter = useCharacterStore.use.restoreCharacter()
    // Remember the target by UUID so a sync landing while the dialog is open can't shift it.
    const [deleteTarget, setDeleteTarget] = useState<{ uuid: string; label: string } | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const pendingNameFocus = useRef(false)
    const stripRef = useRef<HTMLElement>(null)

    // Keep the open folder in view when the strip scrolls sideways (phones, many characters).
    useEffect(() => {
        const strip = stripRef.current
        const active = strip?.querySelector<HTMLElement>("[data-active]")
        if (!strip || !active) return
        const overflowLeft = active.offsetLeft - strip.scrollLeft - 12
        const overflowRight = active.offsetLeft + active.offsetWidth - (strip.scrollLeft + strip.clientWidth) + 48
        if (overflowLeft < 0) strip.scrollBy({ left: overflowLeft })
        else if (overflowRight > 0) strip.scrollBy({ left: overflowRight })
    }, [currentCharacterIndex, names.length])
    const canDelete = names.length > 1

    const askDelete = (index: number) => {
        setDeleteTarget({ uuid: ids[index] ?? "", label: tabLabel(names[index] ?? "", index) })
        setConfirmOpen(true)
    }

    const confirmDelete = () => {
        if (!deleteTarget) return
        const state = useCharacterStore.getState()
        const index = state.characters.findIndex((character) => character.uuid === deleteTarget.uuid)
        if (index < 0 || state.characters.length <= 1) return
        const name = deleteTarget.label
        onDeleteCharacter(index)
        const archived = useCharacterStore.getState().archivedCharacters
        const archiveId = archived[archived.length - 1]?.archiveId
        toast(`Deleted ${name}`, {
            description: "Kept under Deleted characters.",
            action: archiveId
                ? {
                      label: "Undo",
                      onClick: () => restoreCharacter(archiveId),
                  }
                : undefined,
        })
    }

    const rename = (index: number) => {
        setCurrentCharacter(index)
        pendingNameFocus.current = true
    }

    return (
        <>
            <nav ref={stripRef} aria-label="Characters" className="dossier-tabs scrollbar-none">
                {names.map((name, index) => {
                    const label = tabLabel(name, index)
                    const isActive = index === currentCharacterIndex
                    return (
                        <ContextMenu key={ids[index] ?? index}>
                            <ContextMenuTrigger asChild>
                                <div className="dossier-tab group" data-active={isActive ? "" : undefined}>
                                    <button
                                        type="button"
                                        className="dossier-tab-button"
                                        aria-current={isActive ? "true" : undefined}
                                        onClick={() => setCurrentCharacter(index)}
                                    >
                                        {isActive ? <HeartSigil className="size-4 text-heart" /> : null}
                                        <span className="truncate">{label}</span>
                                    </button>
                                    {canDelete ? (
                                        <Hint label="Delete character">
                                            <TrashButton
                                                size="icon-xs"
                                                aria-label={`Delete ${label}`}
                                                className="dossier-tab-trash"
                                                onClick={() => askDelete(index)}
                                            />
                                        </Hint>
                                    ) : null}
                                </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent
                                onCloseAutoFocus={(event) => {
                                    if (!pendingNameFocus.current) return
                                    pendingNameFocus.current = false
                                    event.preventDefault()
                                    focusNameInput()
                                }}
                            >
                                {!isActive ? (
                                    <ContextMenuItem onSelect={() => setCurrentCharacter(index)}>
                                        <BookOpen /> Open sheet
                                    </ContextMenuItem>
                                ) : null}
                                <ContextMenuItem onSelect={() => rename(index)}>
                                    <PencilLine /> Rename
                                </ContextMenuItem>
                                <ContextMenuItem
                                    onSelect={() => {
                                        const character = useCharacterStore.getState().characters[index]
                                        if (character) void downloadJson(character)
                                    }}
                                >
                                    <FileJson /> Download JSON
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onSelect={() => addCharacter()}>
                                    <Plus /> New character
                                </ContextMenuItem>
                                {canDelete ? (
                                    <>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem variant="destructive" onSelect={() => askDelete(index)}>
                                            <Trash2 /> Delete…
                                        </ContextMenuItem>
                                    </>
                                ) : null}
                            </ContextMenuContent>
                        </ContextMenu>
                    )
                })}

                <Hint label="New character">
                    <Button variant="ghost" size="icon-sm" aria-label="New character" className="dossier-tab-add" onClick={() => addCharacter()}>
                        <Plus />
                    </Button>
                </Hint>
            </nav>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title={`Delete ${deleteTarget?.label ?? "character"}?`}
                description="You can restore it from Deleted characters."
                confirmLabel="Delete"
                onConfirm={confirmDelete}
            />
        </>
    )
}

/** Floating dice roller button, docked bottom-right above the safe area. */
export const DiceRollerDockButton = () => {
    const setDiceRollerOpen = useDiceRollerStore.use.setOpen()
    return (
        <div className="bottom-safe fixed right-4 z-(--z-dock) sm:right-6">
            <Hint label="Dice roller" side="left">
                <Button
                    type="button"
                    size="icon"
                    aria-label="Open dice roller"
                    className="dice-dock size-12 rounded-xl"
                    onClick={() => setDiceRollerOpen(true)}
                >
                    <Dices className="size-6" />
                </Button>
            </Hint>
        </div>
    )
}

export default CharacterTabs
