import type { ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

const BLANK_LINE_SPACER = "\u00a0"

function Markdown({ children, className, inline = false }: { children: string; className?: string; inline?: boolean }) {
    const markdown = inline ? children : preserveExtraBlankLines(children)

    return (
        <div className={cn("markdown-content", inline && "markdown-content-inline", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ node: _node, ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
                    p: ({ node: _node, children, ...props }) =>
                        inline ? (
                            <span {...props}>{children}</span>
                        ) : isBlankLineSpacer(children) ? (
                            <p aria-hidden="true" className="markdown-blank-line" {...props}>
                                {children}
                            </p>
                        ) : (
                            <p {...props}>{children}</p>
                        ),
                }}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    )
}

const preserveExtraBlankLines = (markdown: string) => {
    return markdown.replace(/\n(?:[ \t]*\n){2,}/g, (blankLineRun) => {
        const newlineCount = blankLineRun.match(/\n/g)?.length ?? 0
        const spacerCount = Math.max(1, newlineCount - 2)
        return `\n\n${Array.from({ length: spacerCount }, () => BLANK_LINE_SPACER).join("\n\n")}\n\n`
    })
}

const isBlankLineSpacer = (children: ReactNode) => {
    const childList = Array.isArray(children) ? children : [children]
    return childList.length === 1 && childList[0] === BLANK_LINE_SPACER
}

export { Markdown }
