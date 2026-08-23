import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"
import type { CSSProperties, KeyboardEvent } from "react"
import { useMemo, useRef, useState } from "react"

export type ReferenceTag = {
    name: string
    aliases?: string[]
    meaning: string
}

type TagReferenceDialogProps = {
    title: string
    tags: ReferenceTag[]
    primaryText: string
    primarySourceLabel: string
    secondaryText?: string
    secondarySourceLabel?: string
}

export const TagReferenceDialog = ({ title, tags, primaryText, primarySourceLabel, secondaryText = "", secondarySourceLabel }: TagReferenceDialogProps) => {
    const [search, setSearch] = useState("")
    const searchInputRef = useRef<HTMLInputElement>(null)
    const searchableCharacterText = useMemo(
        () => ({
            primary: normalizeForTagSearch(primaryText),
            secondary: normalizeForTagSearch(secondaryText),
        }),
        [primaryText, secondaryText],
    )
    const normalizedSearch = search.trim().toLowerCase()

    const tagRows = useMemo(
        () =>
            tags.map((tag) => {
                const relevantSources = getRelevantSources(tag, searchableCharacterText, primarySourceLabel, secondarySourceLabel)
                return {
                    tag,
                    relevantSources,
                    isRelevant: relevantSources.length > 0,
                    searchBlob: `${tag.name} ${tag.aliases?.join(" ") ?? ""} ${tag.meaning}`.toLowerCase(),
                }
            }),
        [primarySourceLabel, secondarySourceLabel, searchableCharacterText, tags],
    )
    const filteredRows = tagRows.filter(({ searchBlob }) => searchBlob.includes(normalizedSearch))

    const redirectTypingToSearch = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
        if (!isSearchRedirectKey(event.key) || isEditableElement(event.target)) return

        event.preventDefault()
        searchInputRef.current?.focus()
        setSearch((currentSearch) => `${currentSearch}${event.key}`)
        requestAnimationFrame(() => {
            const input = searchInputRef.current
            if (!input) return

            input.setSelectionRange(input.value.length, input.value.length)
        })
    }

    return (
        <DialogContent
            aria-describedby={undefined}
            className="flex h-[min(48rem,calc(100dvh-1rem))] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden p-4 sm:max-h-[calc(100vh-2rem)] sm:p-6"
            onKeyDownCapture={redirectTypingToSearch}
        >
            <DialogHeader className="shrink-0">
                <DialogTitle>{title}</DialogTitle>
            </DialogHeader>

            <div className="tag-reference-search-wrap relative shrink-0">
                <Search className="tag-reference-search-icon pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-red-900/65" />
                <Input
                    ref={searchInputRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tags or meanings..."
                    className="h-11 rounded-md border border-red-900/30 pr-3 pl-12 text-base font-semibold"
                    aria-label={`Search ${title.toLowerCase()}`}
                />
            </div>

            <ScrollArea className="min-h-0 flex-1 pr-3">
                {filteredRows.length === 0 ? (
                    <div className="tag-reference-empty rounded-md border border-dashed border-red-900/30 p-6 text-center text-sm text-muted-foreground">
                        No tags match "{search}".
                    </div>
                ) : (
                    <div className="grid gap-2 pb-1">
                        {filteredRows.map(({ tag, relevantSources, isRelevant }, index) => (
                            <article
                                key={tag.name}
                                className={cn(
                                    "tag-reference-card rounded-md border p-3 text-left",
                                    isRelevant
                                        ? "border-red-900/60 bg-red-900/10 shadow-[0_0_0_1px_rgba(127,29,29,0.18),0_0_22px_rgba(127,29,29,0.13)]"
                                        : "border-red-900/15 bg-background",
                                )}
                                data-relevant={isRelevant}
                                style={{ "--tag-delay": `${Math.min(index, 12) * 22}ms` } as CSSProperties}
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-black tracking-wide text-red-900">{tag.name.toUpperCase()}</h3>
                                    {relevantSources.map((source) => (
                                        <span key={source} className="rounded-full bg-red-900 px-2 py-0.5 text-[0.68rem] font-bold text-white">
                                            {source}
                                        </span>
                                    ))}
                                </div>
                                <p className="mt-1 text-sm leading-snug text-red-950">{tag.meaning}</p>
                            </article>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </DialogContent>
    )
}

const getRelevantSources = (tag: ReferenceTag, text: { primary: string; secondary: string }, primarySourceLabel: string, secondarySourceLabel?: string) => {
    const tagRegex = getTagRegex(tag)
    const relevantSources = []
    if (tagRegex.test(text.primary)) relevantSources.push(primarySourceLabel)
    if (secondarySourceLabel && tagRegex.test(text.secondary)) relevantSources.push(secondarySourceLabel)
    return relevantSources
}

const normalizeForTagSearch = (text: string) => text.toLowerCase().replace(/[*_`[\]()]/g, " ")

const isSearchRedirectKey = (key: string) => key.length === 1 && /^[\p{L}\p{N}]$/u.test(key)

const isEditableElement = (target: EventTarget) => {
    if (!(target instanceof HTMLElement)) return false

    const tagName = target.tagName.toLowerCase()
    return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable
}

const getTagRegex = (tag: ReferenceTag) => {
    const patterns = [tag.name, ...(tag.aliases ?? [])].map(tagAliasToPattern)
    return new RegExp(`(^|[^a-z])(?:${patterns.join("|")})(?=$|[^a-z])`, "i")
}

const tagAliasToPattern = (alias: string) =>
    alias
        .trim()
        .toLowerCase()
        .split(/[\s-]+/)
        .map((part) => (part === "x" ? "[a-z0-9]+" : escapeRegex(part)))
        .join("[\\s\\-–—]+")

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
