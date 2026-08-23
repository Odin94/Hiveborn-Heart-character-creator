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
                <div className="container relative mx-auto max-w-screen-xl text-foreground lg:px-20">
                    <nav className="relative z-10 mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1 px-2 text-sm lg:absolute lg:top-2 lg:left-24 lg:mb-0 lg:flex-nowrap lg:justify-start lg:px-0">
                        <a href="https://odin-matthias.de/" target="_blank" className="underline">
                            /Odin's Site/
                        </a>
                        <a href="https://github.com/Odin94/Hiveborn-Heart-character-creator" target="_blank" className="underline">
                            /Source Code/
                        </a>
                        <a href="https://rowanrookanddecard.com/product-category/game-systems/resistance/heart/" target="_blank" className="underline">
                            /Heart/
                        </a>

                        <DialogTrigger className="link-like underline">/Copyright/</DialogTrigger>
                        <div className="lg:hidden">
                            <ThemeToggle />
                        </div>
                    </nav>
                    <CharacterSheet />
                </div>
                <div className="hidden lg:absolute lg:top-1 lg:right-5 lg:block">
                    <ThemeToggle />
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

            <div className="container mx-auto max-w-screen-xl lg:px-20">
                <div className="mt-0 flex flex-wrap justify-center gap-2 px-2 pb-4 lg:h-10 lg:justify-start lg:gap-8 lg:pl-4 lg:pb-0">
                    <PDFDownloadButton />
                    <JSONDownloadButton />
                    <JSONUploadButton />
                    <ResetButton />

                    {/* TODOdin: Add a button that opens a history pane that keeps character-states from the past (in case you accidentally overwrite) */}
                </div>
            </div>
        </div>
    )
}

export default App
