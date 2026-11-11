import { useNavigate, useParams } from "@tanstack/react-router"
import { ArrowLeft, LogIn } from "lucide-react"
import { useAppAuth } from "@/App"
import { Button } from "@/components/ui/button"
import { HeartSigil } from "@/components/ui/sigil"
import { PlayModeSkeleton } from "@/hiveborn/play_mode/play_skeleton"
import { lazy, Suspense } from "react"

const GroupOverview = lazy(() => import("@/hiveborn/play_mode/group_overview"))

export function PlayModePage({ groupId }: { groupId?: string }) {
    const auth = useAppAuth()
    const navigate = useNavigate()
    // Session check in flight: hold the table's shape rather than flashing the sign-in prompt.
    if (!auth.user && auth.loading) return <PlayModeSkeleton />
    if (!auth.user) {
        return (
            <main className="grid min-h-(--page-min-h) place-items-center px-(--gutter) py-10 pb-safe">
                <section className="panel-plate flex w-full max-w-md flex-col items-center gap-5 px-6 py-9 text-center sm:px-10">
                    <HeartSigil className="size-11 text-heart" />
                    <div className="space-y-2">
                        <h1 className="title-display">Sign in to enter Play Mode</h1>
                        <p className="text-muted-foreground">Play groups and shared sheets require an account.</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                        <Button onClick={auth.login}>
                            <LogIn /> Sign in
                        </Button>
                        <Button variant="ghost" onClick={() => void navigate({ to: "/" })}>
                            <ArrowLeft /> Back to character sheets
                        </Button>
                    </div>
                </section>
            </main>
        )
    }
    return (
        <Suspense fallback={<PlayModeSkeleton />}>
            <GroupOverview
                user={auth.user}
                selectedGroupId={groupId}
                onClose={() => void navigate({ to: "/" })}
                onSelectGroup={(id) => void navigate({ to: "/play/$groupId", params: { groupId: id } })}
            />
        </Suspense>
    )
}

export function PlayGroupPage() {
    const { groupId } = useParams({ from: "/play/$groupId" })
    return <PlayModePage groupId={groupId} />
}
