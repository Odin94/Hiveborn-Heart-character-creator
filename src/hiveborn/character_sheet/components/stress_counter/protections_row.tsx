import { Checkbox } from "@/components/ui/checkbox"
import { NumberBy } from "@/hiveborn/utils"
import { type CSSProperties } from "react"
import { useFillCascade } from "./use_fill_cascade"

type StressRowNumber = NumberBy<["s"]>["s"]

export type ProtectionsRowProps = Omit<StressRowNumber, "setN"> & {
    setN?: StressRowNumber["setN"]
    readOnly?: boolean
    label?: string
}

const ProtectionsRow = ({ n, setN, readOnly = false, label = "protection" }: ProtectionsRowProps) => {
    const fillDelay = useFillCascade(n, 36)

    return (
        <div className="protection-track" data-readonly={readOnly || undefined}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Checkbox
                    key={i}
                    className="protection-cell p-0 disabled:cursor-default disabled:opacity-100"
                    style={{ "--fill-delay": `${fillDelay(i)}ms` } as CSSProperties}
                    aria-label={`${label}: ${i} protection`}
                    checked={i <= n}
                    disabled={readOnly}
                    onCheckedChange={() => {
                        if (readOnly || !setN) return
                        if (n === i) setN(0)
                        else setN(i)
                    }}
                />
            ))}
        </div>
    )
}

export default ProtectionsRow
