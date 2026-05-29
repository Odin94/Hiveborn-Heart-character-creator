import { Checkbox } from "@/components/ui/checkbox"
import { NumberBy } from "@/hiveborn/utils"

export type ResistanceRowProps = NumberBy<["s"]>["s"]

const ResistanceRow = ({ n, setN }: ResistanceRowProps) => {
    return (
        <div className="flex min-w-0 flex-wrap gap-1 sm:block">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <Checkbox
                    key={i}
                    className="p-0 sm:mx-0.5"
                    checked={i <= n}
                    onCheckedChange={() => {
                        if (n === i) setN(0)
                        else setN(i)
                    }}
                />
            ))}
        </div>
    )
}

export default ResistanceRow
