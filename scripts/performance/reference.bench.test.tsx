import { act, Profiler } from "react"
import { createRoot } from "react-dom/client"
import { expect, test } from "vitest"
import { Dialog } from "@/components/ui/dialog"
import { TagReferenceDialog } from "@/hiveborn/character_sheet/components/shared/tag_reference_dialog"
import { equipmentTags } from "@/hiveborn/game_data/equipment_tags"

test("mounted equipment reference search audit", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    const root = createRoot(document.createElement("div"))
    const samples = []
    let duration = 0,
        commits = 0
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    try {
        await act(() =>
            root.render(
                <Profiler
                    id="reference"
                    onRender={(_, phase, value) => {
                        if (phase !== "mount") {
                            commits++
                            duration += value
                        }
                    }}
                >
                    <Dialog open>
                        <TagReferenceDialog title="EQUIPMENT TAGS" tags={equipmentTags} primaryText="Brutal lantern" primarySourceLabel="In use" />
                    </Dialog>
                </Profiler>,
            ),
        )
        for (let round = 0; round < 4; round++) {
            commits = 0
            duration = 0
            const start = performance.now()
            for (let index = 0; index < 10; index++)
                await act(() => {
                    const input = document.querySelector<HTMLInputElement>('input[placeholder="Search tags or meanings..."]')!
                    setter.call(input, index % 2 ? "brutal" : "block")
                    input.dispatchEvent(new Event("input", { bubbles: true }))
                })
            expect(document.querySelector('[role="dialog"]')?.textContent).toContain("BRUTAL")
            samples.push({ elapsedMs: performance.now() - start, renderMs: duration, commits })
        }
        console.log(
            JSON.stringify({
                benchmark: "equipment-reference-search",
                tags: equipmentTags.length,
                updatesPerSample: 10,
                samples: samples.slice(1),
                audit: "unchanged bounded local search",
            }),
        )
    } finally {
        await act(() => root.unmount())
    }
})
