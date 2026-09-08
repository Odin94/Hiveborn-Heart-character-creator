import DarkLogo from "@/assets/logo-dark.png"
import LightLogo from "@/assets/logo-light.png"
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
        <div className="sheet-shell grid w-full grid-cols-1 gap-4 rounded-lg border p-3 sm:gap-6 sm:p-5 md:grid-cols-2 md:grid-rows-[280px_auto_500px_330px] lg:grid-rows-[170px_auto_500px_330px]">
            <div className="">
                <img
                    src={theme === "dark" ? DarkLogo : LightLogo}
                    alt="Decorative"
                    className="mx-auto w-full max-w-[350px] object-contain drop-shadow-[0_0.65rem_1rem_rgba(70,31,24,0.12)] sm:w-[350px] lg:w-full lg:max-w-[600px]"
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
