import DarkLogo from "@/assets/logo-dark.png"
import LightLogo from "@/assets/logo-light.png"
import { SigilDivider } from "@/components/ui/sigil"
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

/**
 * The delver's dossier. Layout:
 *  - phone: one column, identity → stress → skills → beats → gear → abilities → fallout
 *  - tablet: identity and stress stacked, skills/domains side by side, gear and abilities/fallout in pairs
 *  - desktop: identity | stress header, then [skills, beats, gear] | [abilities, fallout]
 */
const CharacterSheet = () => {
    const removeCharacter = useCharacterStore.use.removeCharacter()
    const theme = useThemeStore((state) => state.theme)

    return (
        <div className="w-full">
            <CharacterTabs onDeleteCharacter={removeCharacter} />

            <div className="dossier w-full p-4 sm:p-6 lg:p-8">
                <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-10">
                    <div className="flex min-w-0 flex-col gap-4">
                        <img src={theme === "dark" ? DarkLogo : LightLogo} alt="" aria-hidden="true" className="dossier-mark" />
                        <NameClassCalling />
                    </div>
                    <div className="dossier-stress panel-plate min-w-0 p-3 text-left sm:p-5">
                        <StressCounter />
                    </div>
                </header>

                <SigilDivider className="my-6 sm:my-8" />

                <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
                    <div className="flex min-w-0 flex-col gap-6">
                        <SkillsDomains />
                        <ActiveBeats />
                        <div className="grid gap-6 md:grid-cols-2 md:gap-4">
                            <Equipment />
                            <Resources />
                        </div>
                    </div>
                    <div className="grid min-w-0 gap-6 md:grid-cols-2 md:gap-4 lg:flex lg:flex-col lg:gap-6">
                        <Abilities className="md:h-full lg:h-auto lg:flex-1" />
                        <div className="dossier-fallout min-w-0 text-left">
                            <Fallout />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CharacterSheet
