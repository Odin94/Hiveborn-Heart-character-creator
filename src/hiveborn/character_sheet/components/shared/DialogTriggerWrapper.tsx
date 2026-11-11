import { DialogTrigger } from "@/components/ui/dialog"
import { Hint } from "@/components/ui/tooltip"
import { SectionAction, HiveCellPlus } from "./sheet_section"

/** The hive-cell "pick from the rulebook" button that sits in a section band. */
export const DialogTriggerWrapper = ({ label = "Choose from the rulebook" }: { label?: string }) => {
    return (
        <SectionAction>
            <Hint label={label}>
                <DialogTrigger aria-label={label} className="sheet-band-action">
                    <HiveCellPlus />
                </DialogTrigger>
            </Hint>
        </SectionAction>
    )
}
