import { useNavigate, useParams } from "@tanstack/react-router"
import { useAppAuth } from "@/App"
import { Button } from "@/components/ui/button"
import { lazy, Suspense } from "react"

const GroupOverview = lazy(() => import("@/hiveborn/play_mode/group_overview"))

export function PlayModePage({ groupId }: { groupId?: string }) {
    const auth = useAppAuth()
    const navigate = useNavigate()
    if (!auth.user) {
        return (
            <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
                <div>
                    <h1 className="text-2xl font-bold">Sign in to enter Play Mode</h1>
                    <p className="mt-2 text-muted-foreground">Play groups and shared sheets require an account.</p>
                    <Button className="mt-4" onClick={() => void navigate({ to: "/" })}>
                        Back to character sheets
                    </Button>
                </div>
            </main>
        )
    }
    return (
        <Suspense fallback={<div className="grid min-h-screen place-items-center text-muted-foreground">Loading play groups…</div>}>
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
