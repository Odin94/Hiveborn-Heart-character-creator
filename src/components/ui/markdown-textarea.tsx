import * as React from "react"

import { cn } from "@/lib/utils"
import { Markdown } from "./markdown"
import { Textarea, textareaClassName } from "./textarea"

type MarkdownTextareaProps = Omit<React.ComponentProps<"textarea">, "value"> & {
    value: string
}

function MarkdownTextarea({ className, value, onBlur, onFocus, placeholder, disabled, ...props }: MarkdownTextareaProps) {
    const [editing, setEditing] = React.useState(false)
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const selectionOffsetRef = React.useRef<number | null>(null)
    const valueLengthRef = React.useRef(value.length)

    valueLengthRef.current = value.length

    React.useLayoutEffect(() => {
        if (!editing) return

        const textarea = textareaRef.current
        if (!textarea) return

        textarea.focus()

        const selectionOffset = selectionOffsetRef.current ?? valueLengthRef.current
        textarea.setSelectionRange(selectionOffset, selectionOffset)
        selectionOffsetRef.current = null
    }, [editing])

    if (editing && !disabled) {
        return (
            <Textarea
                ref={textareaRef}
                className={className}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                onBlur={(event) => {
                    setEditing(false)
                    onBlur?.(event)
                }}
                onFocus={onFocus}
                {...props}
            />
        )
    }

    return (
        <div
            role="textbox"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            data-slot="markdown-textarea-preview"
            className={cn(
                textareaClassName,
                "block overflow-auto text-left whitespace-normal",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-text",
                value.trim() === "" && "text-muted-foreground",
                className,
            )}
            onPointerDown={
                disabled
                    ? undefined
                    : (event) => {
                          event.preventDefault()
                          const renderedOffset = getRenderedOffsetFromPoint(event.currentTarget, event.clientX, event.clientY)
                          selectionOffsetRef.current = renderedOffset === null ? value.length : getMarkdownSourceOffset(value, renderedOffset)
                          setEditing(true)
                      }
            }
            onFocus={
                disabled
                    ? undefined
                    : () => {
                          selectionOffsetRef.current = value.length
                          setEditing(true)
                      }
            }
        >
            {value.trim() === "" ? placeholder || "" : <Markdown>{value}</Markdown>}
        </div>
    )
}

const getRenderedOffsetFromPoint = (element: HTMLElement, x: number, y: number) => {
    const documentWithCaret = element.ownerDocument as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
        caretRangeFromPoint?: (x: number, y: number) => Range | null
    }
    const caretPosition = documentWithCaret.caretPositionFromPoint?.(x, y)
    const caretNode = caretPosition?.offsetNode
    const caretOffset = caretPosition?.offset
    const range = documentWithCaret.caretRangeFromPoint?.(x, y)
    const rangeNode = range?.startContainer
    const node = caretNode ?? rangeNode
    const offset = caretOffset ?? range?.startOffset

    if (!node || offset === undefined || !element.contains(node)) return null

    const offsetRange = element.ownerDocument.createRange()
    offsetRange.selectNodeContents(element)
    offsetRange.setEnd(node, offset)
    return offsetRange.toString().length
}

const getMarkdownSourceOffset = (markdown: string, renderedOffset: number) => {
    let sourceOffset = 0
    let visibleOffset = 0

    while (sourceOffset < markdown.length) {
        const skippedLinePrefix = getSkippableLinePrefixLength(markdown, sourceOffset)
        if (skippedLinePrefix > 0) {
            sourceOffset += skippedLinePrefix
            continue
        }

        const skippedInlineSyntax = getSkippableInlineSyntaxLength(markdown, sourceOffset)
        if (skippedInlineSyntax > 0) {
            sourceOffset += skippedInlineSyntax
            continue
        }

        if (visibleOffset >= renderedOffset) return sourceOffset

        const blankLineRun = getBlankLineRun(markdown, sourceOffset)
        if (blankLineRun) {
            if (visibleOffset + blankLineRun.spacerCount >= renderedOffset) return blankLineRun.sourceOffset

            sourceOffset = blankLineRun.sourceOffset
            visibleOffset += blankLineRun.spacerCount
            continue
        }

        sourceOffset += 1
        visibleOffset += 1
    }

    return markdown.length
}

const getSkippableLinePrefixLength = (markdown: string, offset: number) => {
    if (offset > 0 && markdown[offset - 1] !== "\n") return 0

    const lineStart = markdown.slice(offset)
    const linePrefix = /^(#{1,6}\s+|[ \t]*[-*+]\s+|[ \t]*\d+[.)]\s+|[ \t]*>\s?)/.exec(lineStart)
    if (!linePrefix) return 0

    return linePrefix[0].length
}

const getSkippableInlineSyntaxLength = (markdown: string, offset: number) => {
    const sourceFromOffset = markdown.slice(offset)

    if (sourceFromOffset.startsWith("\\") && sourceFromOffset.length > 1) return 1
    if (sourceFromOffset.startsWith("**") || sourceFromOffset.startsWith("__") || sourceFromOffset.startsWith("~~")) return 2
    if (sourceFromOffset.startsWith("*") || sourceFromOffset.startsWith("_") || sourceFromOffset.startsWith("`")) return 1
    if (sourceFromOffset.startsWith("[") || sourceFromOffset.startsWith("![")) return sourceFromOffset.startsWith("![") ? 2 : 1

    const linkDestinationMatch = /^\]\([^)]+\)/.exec(sourceFromOffset)
    if (linkDestinationMatch) return linkDestinationMatch[0].length

    return 0
}

const getBlankLineRun = (markdown: string, offset: number) => {
    const blankLineRun = /^(?:\n[ \t]*){2,}/.exec(markdown.slice(offset))
    if (!blankLineRun) return null

    const newlineCount = blankLineRun[0].match(/\n/g)?.length ?? 0
    return {
        sourceOffset: offset + blankLineRun[0].length,
        spacerCount: Math.max(0, newlineCount - 2),
    }
}

export { MarkdownTextarea }
