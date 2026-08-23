import Logo from "@/assets/logo.png"
import DarkLogo from "@/assets/logo-dark.png"
import { useThemeStore } from "@/lib/theme"
import Abilities from "./components/abilities"
import ActiveBeats from "./components/active_beats"
import CharacterTabs from "./components/character_tabs"
import Equipment from "./components/equipment"
import Fallout from "./components/fallout"
import NameClassCalling from "./components/name_class_calling"
import Resources from "./components/resources"
import SkillsDomains from "./components/skills_domains"
import StressCounter from "./components/stress_counter/stress_counter"
import { useCharacterStore } from "./character_states"

const CharacterSheet = () => {
    const { removeCharacter } = useCharacterStore()
    const theme = useThemeStore((state) => state.theme)

    return (
        <div className="grid grid-cols-1 grid-rows-none gap-4 w-full p-3 border-1 rounded-sm sm:grid-rows-[110px_300px_200px_330px] sm:gap-6 sm:p-5 lg:grid-cols-2 lg:grid-rows-[170px_90px_500px_330px]">
            <div className="">
                <img
                    src={theme === "dark" ? DarkLogo : Logo}
                    alt="Decorative"
                    className="mx-auto w-full max-w-[350px] object-contain sm:w-[350px] lg:w-full lg:max-w-[600px]"
                />
            </div>

            <div className="">
                <StressCounter />
            </div>
            <div className="">
                <NameClassCalling />
            </div>
            <div className="row-span-2">
                <Abilities />
            </div>

            <div className="">
                {/* If you need more space for these, consider switching places of skills & fallout*/}
                {/* TODOdin: Add a button to open a big modal with the text-area from these in case you have an overflow, because scrolling is not fun */}
                <ActiveBeats />
                <Equipment />
                <Resources />
            </div>
            <div className="">
                <SkillsDomains />
            </div>
            <div className="">
                <Fallout />
            </div>

            <CharacterTabs onDeleteCharacter={removeCharacter} />
        </div>
    )
}

export default CharacterSheet
