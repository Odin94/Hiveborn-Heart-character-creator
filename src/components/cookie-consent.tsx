import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Cookie } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import * as React from "react"

type CookieConsentProps = {
    variant: "small" | "mini"
    demo?: boolean
    onAcceptCallback?: () => void
    onDeclineCallback?: () => void
} & React.HTMLAttributes<HTMLDivElement>

const LEARN_MORE_HREF = "https://odin-matthias.de/datenschutzerklaerung"

const CookieHeader = () => <span>Collect your Cookie ('Technology', D12)!</span>

const CookieBody = () => (
    <div className="text-left text-muted-foreground">
        I use cookies to get better insights on usage patterns, which helps me improve Hiveborn for everyone.
        <br /> More info:{" "}
        <a href={LEARN_MORE_HREF} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:no-underline">
            privacy policy
        </a>
        .
    </div>
)

const CookieConsent = React.forwardRef<HTMLDivElement, CookieConsentProps>(
    ({ variant = "small", demo = false, onAcceptCallback = () => {}, onDeclineCallback = () => {}, className, ...props }, ref) => {
        const posthog = usePostHog()
        const [isOpen, setIsOpen] = React.useState(false)
        const [hide, setHide] = React.useState(false)

        const handleAccept = React.useCallback(() => {
            setIsOpen(false)
            setTimeout(() => {
                setHide(true)
            }, 180)
            try {
                posthog.opt_in_capturing()
            } catch (error) {
                console.warn("PostHog opt_in_capturing failed:", error)
            }
            onAcceptCallback()
        }, [onAcceptCallback, posthog])

        const handleDecline = React.useCallback(() => {
            setIsOpen(false)
            setTimeout(() => {
                setHide(true)
            }, 180)
            try {
                posthog.opt_out_capturing()
            } catch (error) {
                console.warn("PostHog opt_out_capturing failed:", error)
            }
            onDeclineCallback()
        }, [onDeclineCallback, posthog])

        React.useEffect(() => {
            try {
                if (demo) {
                    setIsOpen(true)
                    return
                }

                const consentStatus = posthog.get_explicit_consent_status()
                if (consentStatus === "pending") {
                    setIsOpen(true)
                } else {
                    setIsOpen(false)
                    setTimeout(() => {
                        setHide(true)
                    }, 180)
                }
            } catch (error) {
                console.warn("Cookie consent error:", error)
            }
        }, [demo, posthog])

        if (hide) return null

        const containerClasses = cn(
            "fixed z-(--z-overlay) transition-[transform,opacity] duration-200",
            !isOpen ? "translate-y-4 opacity-0 ease-in pointer-events-none" : "translate-y-0 opacity-100 ease-out",
            className,
        )

        const commonWrapperProps = {
            ref,
            role: "region",
            "aria-label": "Cookie consent",
            className: cn(
                containerClasses,
                variant === "mini"
                    ? "inset-x-3 bottom-safe sm:right-auto sm:left-4 sm:w-full sm:max-w-3xl"
                    : "inset-x-3 bottom-safe sm:right-auto sm:left-4 sm:w-[24rem]",
            ),
            ...props,
        }

        if (variant === "small") {
            return (
                <div {...commonWrapperProps}>
                    <Card variant="plate" className="gap-3 py-4">
                        <CardHeader className="flex flex-row items-center justify-between gap-3 px-4">
                            <CardTitle className="text-lg">
                                <CookieHeader />
                            </CardTitle>
                            <Cookie className="size-5 shrink-0 text-heart" aria-hidden="true" />
                        </CardHeader>
                        <CardContent className="px-4">
                            <CardDescription className="text-sm leading-relaxed">
                                <CookieBody />
                            </CardDescription>
                        </CardContent>
                        <CardFooter className="gap-2 px-4">
                            <Button onClick={handleDecline} variant="secondary" size="sm" className="flex-1">
                                Decline
                            </Button>
                            <Button onClick={handleAccept} size="sm" className="flex-1">
                                Accept
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )
        }

        if (variant === "mini") {
            return (
                <div {...commonWrapperProps}>
                    <Card variant="plate" className="py-3">
                        <CardContent className="grid gap-3 px-4 sm:flex sm:items-center">
                            <CardDescription className="flex-1 text-xs sm:text-sm">
                                <CookieBody />
                            </CardDescription>
                            <div className="flex items-center justify-end gap-2">
                                <Button onClick={handleDecline} size="xs" variant="secondary">
                                    Decline
                                </Button>
                                <Button onClick={handleAccept} size="xs">
                                    Accept
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )
        }
    },
)

CookieConsent.displayName = "CookieConsent"
export { CookieConsent }
export default CookieConsent
