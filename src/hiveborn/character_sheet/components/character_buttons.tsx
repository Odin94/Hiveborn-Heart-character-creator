import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { generateCharacterPDF } from "@/hiveborn/creator/pdf_creator"
import { Character, characterSchema } from "@/hiveborn/game_data/character"
import { useUserUuid } from "@/lib/analytics"
import { useThemeStore } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { Buffer } from "buffer"
import { FileDown, Upload } from "lucide-react"
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

const growDownClass = "transition-all duration-200 ease-in-out sm:hover:h-[calc(2rem+15px)]"

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
        <Button className={cn("rounded-t-none", growDownClass, className)} onClick={handleDownload}>
            Download JSON
        </Button>
    )
}

export const ResetButton = () => {
    const resetCharacter = useCharacterStore.use.resetCharacter()

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className={cn("rounded-t-none", growDownClass)}>🔥 Reset Character</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reset Character?</DialogTitle>
                    <DialogDescription>
                        Your current character will be archived and a new empty sheet created. You can restore it from Deleted characters.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 flex justify-end">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" onClick={() => {}}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <DialogClose asChild>
                        <Button className="ml-3" type="button" onClick={resetCharacter}>
                            Reset Character
                        </Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
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

    const getDropzoneClassName = () => {
        if (isDragReject) {
            return "border-red-500 bg-red-50"
        }
        if (isDragActive) {
            return "border-blue-500 bg-blue-50"
        }
        if (file) {
            return "border-green-500 bg-green-50"
        }
        return "border-gray-300 hover:border-gray-400"
    }

    const getDropzoneText = () => {
        if (isDragReject) {
            return <p className="text-center text-red-500">Only JSON files are accepted</p>
        }
        if (isDragActive) {
            return <p className="text-center">Drop the JSON file here...</p>
        }
        if (file) {
            return <p className="text-center">Selected: {file.name}</p>
        }
        return <p className="text-center">Drag & drop a JSON file here, or click to select</p>
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
                <Button className={cn("rounded-t-none", growDownClass)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Load Character
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Load from json file</DialogTitle>
                    <DialogDescription>This adds the imported character. If its saved version differs, both copies are kept.</DialogDescription>
                </DialogHeader>
                <div>
                    <div
                        {...getRootProps()}
                        className={`text-sm w-full sm:w-[70%] border-2 border-dashed rounded-md p-2 cursor-pointer transition-colors ${getDropzoneClassName()}`}
                    >
                        <input {...getInputProps()} accept=".json" />
                        {getDropzoneText()}
                    </div>
                </div>

                <div className="mt-2 gap-3 flex justify-end">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" onClick={() => setFile(undefined)}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <DialogClose asChild>
                        <Button onClick={() => loadCharacter(file)} disabled={!file}>
                            Load file
                        </Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export const PDFDownloadButton = ({ className }: { className?: string }) => {
    const posthog = usePostHog()
    const getCharacterData = useCharacterStore.use.getCharacterData()
    const theme = useThemeStore((state) => state.theme)
    const { userUuid } = useUserUuid()

    const handleDownload = async () => {
        const character = getCharacterData()

        try {
            const pdfBytes = await generateCharacterPDF(character, theme)

            const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" })
            const link = document.createElement("a")
            link.href = window.URL.createObjectURL(blob)
            link.download = `${character.name}_hiveborn.pdf`
            link.click()
        } catch (error) {
            console.log({ error })
            toast.error("Failed to generate PDF", {
                description: error instanceof Error ? error.message : "An unknown error occurred",
                duration: 5000,
                dismissible: true,
            })
        } finally {
            posthog.capture("PDF Download", { userUuid })
        }
    }

    return (
        <Button className={cn("rounded-t-none", growDownClass, className)} onClick={handleDownload}>
            <FileDown className="mr-2 h-4 w-4" />
            Download PDF
        </Button>
    )
}

export const DeletedCharactersButton = () => {
    const archived = useCharacterStore.use.archivedCharacters()
    const restore = useCharacterStore.use.restoreCharacter()
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="secondary" className="rounded-t-none" disabled={!archived.length}>
                    Deleted characters ({archived.length})
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Deleted characters</DialogTitle>
                    <DialogDescription>Deleted and reset sheets stay saved. Restore creates a separate active copy.</DialogDescription>
                </DialogHeader>
                <div className="max-h-96 space-y-3 overflow-y-auto">
                    {archived.map((entry) => (
                        <div key={entry.archiveId} className="flex items-center justify-between gap-3 border-b pb-3">
                            <div>
                                <p>{entry.character.name || "Unnamed hiveborn"}</p>
                                <p className="text-sm text-muted-foreground">{new Date(entry.deletedAt).toLocaleString()}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => void downloadJson(entry.character)}>
                                    Download JSON
                                </Button>
                                <Button
                                    onClick={() => {
                                        restore(entry.archiveId)
                                        toast.success("Restored as a new character")
                                    }}
                                >
                                    Restore
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
