import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
const build = process.argv[2]
if (!build) throw new Error("Pass production build directory containing .vite/manifest.json")
const manifest = JSON.parse(readFileSync(join(build, ".vite/manifest.json"), "utf8"))
const closure = (entries) => {
    const seen = new Set()
    const visit = (key) => {
        if (seen.has(key)) return
        seen.add(key)
        for (const dependency of manifest[key].imports ?? []) visit(dependency)
    }
    for (const entry of entries) visit(entry)
    const files = [...seen].map((key) => manifest[key].file).filter((file) => file.endsWith(".js"))
    return { rawJsBytes: files.reduce((sum, file) => sum + statSync(join(build, file)).size, 0), files }
}
const split = Boolean(manifest["src/pages/character-sheet.tsx"])
const page = (entry) => closure(["index.html", ...entry])
console.log(
    JSON.stringify(
        {
            build,
            common: page([]),
            routes: {
                "/": page(split ? ["src/pages/character-sheet.tsx"] : []),
                "/auth/callback": page(split ? ["src/pages/auth-callback.tsx"] : []),
                "/play-anonymous-guard": page(split ? ["src/pages/play-mode.tsx"] : []),
                "/play": page(split ? ["src/pages/play-mode.tsx", "src/hiveborn/play_mode/group_overview.tsx"] : ["src/hiveborn/play_mode/group_overview.tsx"]),
                "/play/$groupId": page(
                    split ? ["src/pages/play-mode.tsx", "src/hiveborn/play_mode/group_overview.tsx"] : ["src/hiveborn/play_mode/group_overview.tsx"],
                ),
            },
        },
        null,
        2,
    ),
)
