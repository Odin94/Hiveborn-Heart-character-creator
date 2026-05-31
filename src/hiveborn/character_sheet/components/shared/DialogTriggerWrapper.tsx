import { DialogTrigger } from "@/components/ui/dialog"
import { Hexagon } from "lucide-react"

export const DialogTriggerWrapper = () => {
    return (
        <DialogTrigger className="absolute top-1/2 right-3 -translate-y-1/2 hover:bg-red-800 sm:right-7">
            <Hexagon className="inline w-7 h-7 p-1" />
        </DialogTrigger>
    )
}
