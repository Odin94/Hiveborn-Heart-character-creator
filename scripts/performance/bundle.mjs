import { readFileSync, readdirSync, statSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { join } from "node:path"

const directory = process.argv[2] ?? "dist"
const html = readFileSync(join(directory, "index.html"), "utf8")
const files = [...html.matchAll(/(?:src|href)="\/([^"]+\.js)"/g)].map((match) => match[1])
const entries = files.map((file) => {
    const content = readFileSync(join(directory, file))
    return { file, bytes: content.length, gzipBytes: gzipSync(content).length }
})
const totalJsBytes = readdirSync(join(directory, "assets"))
    .filter((file) => file.endsWith(".js"))
    .reduce((sum, file) => sum + statSync(join(directory, "assets", file)).size, 0)
console.log(
    JSON.stringify({
        benchmark: "production-initial-js",
        entries,
        initialBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
        initialGzipBytes: entries.reduce((sum, entry) => sum + entry.gzipBytes, 0),
        totalJsBytes,
    }),
)
