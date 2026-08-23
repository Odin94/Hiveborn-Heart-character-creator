import "./App.css"
import CharacterSheet from "./hiveborn/character_sheet/character_sheet"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { JSONDownloadButton, JSONUploadButton, PDFDownloadButton, ResetButton } from "./hiveborn/character_sheet/components/character_buttons"
import { Toaster } from "@/components/ui/sonner"
import { useUserUuid } from "@/lib/analytics"
import { useEffect } from "react"
import { usePostHog } from "posthog-js/react"
import CookieConsent from "./components/cookie-consent"
import DiceRoller from "./hiveborn/character_sheet/components/dice_roller/dice_roller"
import ThemeToggle from "./components/theme-toggle"

function App() {
    const posthog = usePostHog()
    const { userUuid, setUserUuid } = useUserUuid()
    useEffect(() => {
        if (!userUuid) {
            setUserUuid()
        }
    }, [userUuid, setUserUuid])

    if (userUuid) {
        posthog.identify(userUuid)
        posthog.capture("Pageview: Hiveborn", { userUuid })
    }

    return (
        <div className="relative min-h-screen bg-background pb-28 sm:pb-0">
            <CookieConsent variant="small" />
            <Toaster closeButton />
            <Dialog>
                <nav className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1 px-2 text-sm sm:contents sm:px-0">
                    <a href="https://odin-matthias.de/" target="_blank" className="underline sm:absolute sm:top-2 sm:left-8">
                        /Odin's Site/
                    </a>
                    <a href="https://github.com/Odin94/Hiveborn-Heart-character-creator" target="_blank" className="underline sm:absolute sm:top-2 sm:left-31">
                        /Source Code/
                    </a>
                    <a
                        href="https://rowanrookanddecard.com/product-category/game-systems/resistance/heart/"
                        target="_blank"
                        className="underline sm:absolute sm:top-2 sm:left-57"
                    >
                        /Heart/
                    </a>

                    <DialogTrigger className="link-like underline sm:absolute sm:top-2 sm:left-72">/Copyright/</DialogTrigger>
                    <div className="sm:absolute sm:top-1 sm:right-5">
                        <ThemeToggle />
                    </div>
                </nav>
                <div className="container mx-auto max-w-screen-xl text-foreground md:px-20">
                    <CharacterSheet />
                </div>
                <DiceRoller />

                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Copyright notice</DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm">
                            <p>
                                <em>Hiveborn</em> is an independent production by <em>Odin</em> and is not affiliated with Rowan, Rook and Decard. It is
                                published under the RR&D Community License. Heart is copyright Rowan, Rook and Decard.
                            </p>
                            <p className="mt-5">
                                You can find out more and support these games at{" "}
                                <a href="https://rowanrookanddecard.com" target="_blank">
                                    rowanrookanddecard.com
                                </a>
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>

            <div className="mt-4 flex flex-wrap justify-center gap-2 px-2 pb-4 sm:absolute sm:left-0 sm:mt-0 sm:ml-4 sm:h-10 sm:items-start sm:gap-8 sm:p-0">
                <PDFDownloadButton />
                <JSONDownloadButton />
                <JSONUploadButton />
                <ResetButton />

                {/* TODOdin: Add a button that opens a history pane that keeps character-states from the past (in case you accidentally overwrite) */}
            </div>
        </div>
    )
}

export default App
