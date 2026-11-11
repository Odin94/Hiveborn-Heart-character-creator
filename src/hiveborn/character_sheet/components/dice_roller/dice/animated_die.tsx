import { type DieProps } from "../types"
import D10Die from "./d10_die"
import D12Die from "./d12_die"
import D4Die from "./d4_die"
import D6Die from "./d6_die"
import D8Die from "./d8_die"

const AnimatedDie = (props: DieProps) => {
    if (props.die.sides === 4) return <D4Die {...props} />
    if (props.die.sides === 6) return <D6Die {...props} />
    if (props.die.sides === 8) return <D8Die {...props} />
    if (props.die.sides === 12) return <D12Die {...props} />
    return <D10Die {...props} />
}

export default AnimatedDie
