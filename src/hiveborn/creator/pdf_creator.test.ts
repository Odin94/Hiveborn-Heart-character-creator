/// <reference types="node" />
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs"
import { PDFDocument } from "pdf-lib"
import { afterEach, expect, it, vi } from "vitest"
import { getEmptyCharacter } from "../game_data/character"
import { generateCharacterPDF } from "./pdf_creator"
const font = readFileSync("src/assets/NotoSansSC-Regular.ttf")
const logo = readFileSync("src/assets/logo.png")
afterEach(() => vi.unstubAllGlobals())
it("exports CJK, accents and emoji without losing editable text, warning only about unsupported glyphs", async () => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => ({ ok: true, arrayBuffer: async () => Uint8Array.from(url.includes("Noto") ? font : logo).buffer })),
    )
    const character = { ...getEmptyCharacter(), name: "Élodie 李华 🦇", abilities: "Grüße and 中文", equipment: "🧶" }
    const missing = vi.fn()
    const bytes = await generateCharacterPDF(character, "light", missing)
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getForm().getTextField("name").getText()).toBe(character.name)
    expect(pdf.getForm().getTextField("abilities").getText()).toBe(character.abilities)
    expect(missing).toHaveBeenCalledWith(expect.arrayContaining(["🦇", "🧶"]))
    expect(missing.mock.calls[0][0]).not.toContain("李")
}, 15000)
it("concurrent exports keep fonts and forms scoped to each document", async () => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => ({ ok: true, arrayBuffer: async () => Uint8Array.from(url.includes("Noto") ? font : logo).buffer })),
    )
    const characters = ["Alice 李华", "Bob 张文"].map((name) => ({ ...getEmptyCharacter(), name }))
    const outputs = await Promise.all(characters.map((character) => generateCharacterPDF(character, "light")))
    for (const [index, bytes] of outputs.entries())
        expect((await PDFDocument.load(bytes)).getForm().getTextField("name").getText()).toBe(characters[index].name)
}, 15000)

it("retains a lightweight standard-font path for Latin exports", async () => {
    const fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => Uint8Array.from(logo).buffer }))
    vi.stubGlobal("fetch", fetch)
    const bytes = await generateCharacterPDF({ ...getEmptyCharacter(), name: "Élodie Grüße" }, "light")
    expect((await PDFDocument.load(bytes)).getForm().getTextField("name").getText()).toBe("Élodie Grüße")
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]).not.toEqual(expect.arrayContaining([expect.stringContaining("Noto")]))
})
it("embeds a valid TrueType font that Poppler can render and extract", async (context) => {
    if (spawnSync("pdftoppm", ["-v"]).error || spawnSync("pdftotext", ["-v"]).error) context.skip()
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => ({ ok: true, arrayBuffer: async () => Uint8Array.from(url.includes("Noto") ? font : logo).buffer })),
    )
    const bytes = await generateCharacterPDF({ ...getEmptyCharacter(), name: "李华 中文" }, "light")
    const directory = mkdtempSync(join(tmpdir(), "hiveborn-pdf-"))
    try {
        const path = join(directory, "sheet.pdf")
        writeFileSync(path, bytes)
        const rendered = spawnSync("pdftoppm", ["-f", "1", "-l", "1", "-scale-to", "1200", "-png", path, join(directory, "sheet")], { encoding: "utf8" })
        expect(rendered.status).toBe(0)
        expect(rendered.stderr).not.toMatch(/invalid|couldn.t create|syntax error/i)
        const extracted = spawnSync("pdftotext", [path, "-"], { encoding: "utf8" })
        expect(extracted.stdout).toContain("李华 中文")
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
}, 15000)

it("renders every CJK glyph rather than merely retaining invisible form text", async (context) => {
    if (spawnSync("pdftoppm", ["-v"]).error) context.skip()
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => ({ ok: true, arrayBuffer: async () => Uint8Array.from(url.includes("Noto") ? font : logo).buffer })),
    )
    const directory = mkdtempSync(join(tmpdir(), "hiveborn-glyphs-"))
    try {
        const crops: Uint8Array[] = []
        for (const [index, name] of ["李", "李华"].entries()) {
            const file = join(directory, `${index}.pdf`),
                output = join(directory, `${index}`)
            writeFileSync(file, await generateCharacterPDF({ ...getEmptyCharacter(), name }, "light"))
            const result = spawnSync(
                "pdftoppm",
                ["-f", "1", "-l", "1", "-singlefile", "-scale-to", "1200", "-x", "110", "-y", "200", "-W", "200", "-H", "26", "-png", file, output],
                { encoding: "utf8" },
            )
            expect(result.status).toBe(0)
            crops.push(readFileSync(`${output}.png`))
        }
        expect(crops[1]).not.toEqual(crops[0])
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
}, 15000)
