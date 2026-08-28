import { Checkbox } from "@/components/ui/checkbox"
import { NumberBy } from "@/hiveborn/utils"

type StressRowNumber = NumberBy<["s"]>["s"]

export type ResistanceRowProps = Omit<StressRowNumber, "setN"> & {
    setN?: StressRowNumber["setN"]
    readOnly?: boolean
}

const ResistanceRow = ({ n, setN, readOnly = false }: ResistanceRowProps) => {
    return (
        <div className="flex min-w-0 flex-wrap gap-1 sm:block">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <Checkbox
                    key={i}
                    className="p-0 disabled:opacity-100 sm:mx-0.5"
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

export default ResistanceRow
