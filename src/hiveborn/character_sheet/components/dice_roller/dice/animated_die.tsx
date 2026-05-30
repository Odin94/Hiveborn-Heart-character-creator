import { DieRoll } from "../types"
import D10Die from "./d10_die"
import D12Die from "./d12_die"
import D4Die from "./d4_die"
import D6Die from "./d6_die"
import D8Die from "./d8_die"

const AnimatedDie = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    if (die.sides === 4) return <D4Die die={die} rolling={rolling} index={index} />
    if (die.sides === 6) return <D6Die die={die} rolling={rolling} index={index} />
    if (die.sides === 8) return <D8Die die={die} rolling={rolling} index={index} />
    if (die.sides === 12) return <D12Die die={die} rolling={rolling} index={index} />
    return <D10Die die={die} rolling={rolling} index={index} />
}

export default AnimatedDie
