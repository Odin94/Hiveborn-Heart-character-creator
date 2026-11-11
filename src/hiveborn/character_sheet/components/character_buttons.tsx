import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Hint } from "@/components/ui/tooltip"
import { Character, characterSchema } from "@/hiveborn/game_data/character"
import { useUserUuid } from "@/lib/analytics"
import { useThemeStore } from "@/lib/theme"
import { Buffer } from "buffer"
import { ArchiveRestore, FileDown, FileJson, FileUp, History, RotateCcw, Upload } from "lucide-react"
import { useState } from "react"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"
import { useCharacterStore } from "../character_states"
import { usePostHog } from "posthog-js/react"

export const downloadJson = async (character: Character) => {
    try {
        const blob = new Blob([JSON.stringify(character, null, 2)], { type: "application/json" })
        const link = document.createElement("a")

        link.href = window.URL.createObjectURL(blob)
        link.download = `${character.name}_hiveborn.json`
        link.click()
    } catch (error) {
        console.error(error)
    }
}

export const getUploadFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = (error) => reject(error)
        reader.readAsDataURL(file)
    })
}

export const JSONDownloadButton = ({ className }: { className?: string }) => {
    const posthog = usePostHog()
    const getCharacterData = useCharacterStore.use.getCharacterData()
    const { userUuid } = useUserUuid()

    const handleDownload = async () => {
        try {
            await downloadJson(getCharacterData())
        } finally {
            posthog.capture("JSON Download", { userUuid })
        }
    }

    return (
        <Button variant="outline" className={className} onClick={handleDownload}>
            <FileJson /> Download JSON
        </Button>
    )
}

export const ResetButton = () => {
    const resetCharacter = useCharacterStore.use.resetCharacter()

    return (
        <ConfirmDialog
            trigger={
                <Button variant="ghost" className="text-muted-foreground hover:text-destructive">
                    <RotateCcw /> Reset Character
                </Button>
            }
            title="Reset character?"
            description="Your current character will be archived and a new empty sheet created. You can restore it from Deleted characters."
            confirmLabel="Reset"
            onConfirm={() => {
                resetCharacter()
                // No Undo here: restoring would leave the fresh blank sheet behind as a second tab.
                toast("Started a fresh sheet", { description: "The old one is under Deleted characters." })
            }}
        />
    )
}

export const JSONUploadButton = () => {
    const posthog = usePostHog()
    const [file, setFile] = useState<File>()
    const importCharacter = useCharacterStore.use.importCharacter()
    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        accept: {
            "application/json": [".json"],
        },
        maxFiles: 1,
        onDrop: (acceptedFiles, rejectedFiles) => {
            if (rejectedFiles.length > 0) {
                return
            }
            if (acceptedFiles.length > 0) {
                setFile(acceptedFiles[0])
            }
        },
    })

    const dropzoneState = isDragReject ? "reject" : isDragActive ? "active" : file ? "ready" : "idle"

    const getDropzoneText = () => {
        if (isDragReject) {
            return <p className="text-center font-semibold text-destructive">Only JSON files are accepted</p>
        }
        if (isDragActive) {
            return <p className="text-center font-semibold text-heart">Drop the JSON file here…</p>
        }
        if (file) {
            return (
                <p className="text-center">
                    <span className="text-muted-foreground">Selected</span> <span className="font-semibold">{file.name}</span>
                </p>
            )
        }
        return (
            <p className="text-center">
                <span className="font-semibold">Drop a JSON file here</span>
                <span className="block text-muted-foreground">or click to choose one</span>
            </p>
        )
    }

    const { userUuid } = useUserUuid()

    const loadCharacter = async (loadedFile: File | undefined) => {
        if (!loadedFile) return

        const fileData = await getUploadFile(loadedFile)
        let jsonObject
        try {
            const base64 = fileData.split(",")[1]
            if (!base64) throw new Error("The file could not be read properly")
            const fileString = Buffer.from(base64, "base64").toString()
            jsonObject = JSON.parse(fileString)
        } catch (e) {
            toast.error("Invalid file format", {
                description: e instanceof Error ? e.message : "The file is not valid JSON",
                duration: 8000,
                dismissible: true,
                richColors: true,
            })
            return
        } finally {
            posthog.capture("Character loaded", { userUuid })
        }

        console.log({ loadedCharacter: jsonObject })

        const character = characterSchema.safeParse(jsonObject)
        if (!character.success) {
            const errorSummary = character.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n")
            toast.error("Invalid character data", {
                description: errorSummary,
                duration: 8000,
                dismissible: true,
                richColors: true,
            })
            return
        }

        importCharacter(character.data)
        setFile(undefined)
        toast.success("Character loaded successfully", {
            duration: 5000,
            dismissible: true,
        })
    }

    return (
        <Dialog
            onOpenChange={(open) => {
                if (!open) setFile(undefined)
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload />
                    Load Character
                </Button>
            </DialogTrigger>
            <DialogContent
                onPaste={(event) => {
                    const pasted = Array.from(event.clipboardData.files).find((entry) => entry.name.toLowerCase().endsWith(".json"))
                    if (pasted) setFile(pasted)
                }}
            >
                <DialogHeader>
                    <DialogTitle>Load from JSON file</DialogTitle>
                    <DialogDescription>This adds the imported character. If its saved version differs, both copies are kept.</DialogDescription>
                </DialogHeader>
                <div {...getRootProps()} className="sheet-dropzone" data-state={dropzoneState}>
                    <input {...getInputProps()} accept=".json" />
                    <FileUp className="size-6 text-heart" aria-hidden="true" />
                    <div className="text-sm">{getDropzoneText()}</div>
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" onClick={() => setFile(undefined)}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <Hint label="Choose a JSON file first" wrap disabled={Boolean(file)}>
                        <DialogClose asChild>
                            <Button onClick={() => loadCharacter(file)} disabled={!file}>
                                Load file
                            </Button>
                        </DialogClose>
                    </Hint>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export const PDFDownloadButton = ({ className }: { className?: string }) => {
    const posthog = usePostHog()
    const getCharacterData = useCharacterStore.use.getCharacterData()
    const theme = useThemeStore((state) => state.theme)
    const { userUuid } = useUserUuid()

    const [exporting, setExporting] = useState(false)
    const handleDownload = async () => {
        if (exporting) return
        setExporting(true)
        const character = getCharacterData()

        try {
            const { generateCharacterPDF } = await import("@/hiveborn/creator/pdf_creator")
            const pdfBytes = await generateCharacterPDF(character, theme, (glyphs) =>
                toast.warning("Some PDF glyphs are unavailable", {
                    description: `The PDF font cannot display ${glyphs.join(" ")}. Original text is preserved in its editable fields.`,
                }),
            )

            const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" })
            const link = document.createElement("a")
            link.href = window.URL.createObjectURL(blob)
            link.download = `${character.name}_hiveborn.pdf`
            link.click()
            window.setTimeout(() => window.URL.revokeObjectURL(link.href), 1000)
        } catch (error) {
            console.log({ error })
            toast.error("Failed to generate PDF", {
                description: error instanceof Error ? error.message : "An unknown error occurred",
                duration: 5000,
                dismissible: true,
            })
        } finally {
            setExporting(false)
            posthog.capture("PDF Download", { userUuid })
        }
    }

    return (
        <Button className={className} onClick={handleDownload} disabled={exporting} aria-busy={exporting}>
            <FileDown />
            {exporting ? "Generating PDF…" : "Download PDF"}
        </Button>
    )
}

export const DeletedCharactersButton = () => {
    const archived = useCharacterStore.use.archivedCharacters()
    const restore = useCharacterStore.use.restoreCharacter()
    const newestFirst = [...archived].reverse()
    const restoreEntry = (archiveId: string) => {
        restore(archiveId)
        toast.success("Restored as a new character")
    }

    return (
        <Dialog>
            <Hint label="No deleted characters yet" wrap disabled={archived.length > 0}>
                <DialogTrigger asChild>
                    <Button variant="ghost" disabled={!archived.length}>
                        <History /> Deleted characters <span className="text-muted-foreground tabular-nums">({archived.length})</span>
                    </Button>
                </DialogTrigger>
            </Hint>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Deleted characters</DialogTitle>
                    <DialogDescription>Deleted and reset sheets stay saved. Restore creates a separate active copy.</DialogDescription>
                </DialogHeader>
                <ul className="-mx-2 max-h-[min(28rem,60dvh)] overflow-y-auto">
                    {newestFirst.map((entry) => (
                        <ContextMenu key={entry.archiveId}>
                            <ContextMenuTrigger asChild>
                                <li className="flex flex-col gap-3 rounded-md px-2 py-3 transition-colors duration-150 hover:bg-accent/60 sm:flex-row sm:items-center sm:justify-between [&+li]:border-t [&+li]:border-border/70">
                                    <div className="min-w-0 text-left">
                                        <p className="truncate font-display text-lg leading-tight font-bold">{entry.character.name || "Unnamed hiveborn"}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {[entry.character.characterClass, entry.character.calling].filter(Boolean).join(" · ")}
                                            {entry.character.characterClass || entry.character.calling ? " — " : ""}
                                            {new Date(entry.deletedAt).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        <Button variant="secondary" size="sm" onClick={() => void downloadJson(entry.character)}>
                                            <FileJson /> Download JSON
                                        </Button>
                                        <Button size="sm" onClick={() => restoreEntry(entry.archiveId)}>
                                            <ArchiveRestore /> Restore
                                        </Button>
                                    </div>
                                </li>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                                <ContextMenuItem onSelect={() => restoreEntry(entry.archiveId)}>
                                    <ArchiveRestore /> Restore
                                </ContextMenuItem>
                                <ContextMenuItem onSelect={() => void downloadJson(entry.character)}>
                                    <FileJson /> Download JSON
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    ))}
                </ul>
            </DialogContent>
        </Dialog>
    )
}
