# H07 — Valid Unicode character text prevents PDF export

Severity: **Medium**. Confirmed using the actual browser PDF generator at `8a0544f`.

Status: **Fixed and independently reviewed**. Final app source: `396537f`.

Revalidated on committed revision `88c2eb0` after incorporating the newer local performance work. Uncommitted architecture changes in the primary checkout were outside this review.

## Reproduction and evidence

Export a character named `Delver 🦇` or `李华`. `generateCharacterPDF` throws `Failed to generate PDF: WinAnsi cannot encode` and returns no PDF. The control name `Élodie` succeeds and produces a 137,817-byte PDF.

Evidence: `hiveborn-pdf-unicode.js` and `browser-results.json:H07pdf`. The same failure can arise from equipment, abilities, fallout, or other free-text fields; the browser editor and JSON export accept this text.

## Cause

`src/hiveborn/creator/pdf_creator.ts` embeds the standard Helvetica fonts and creates form appearances with them. These use WinAnsi and cannot encode CJK characters or emoji. Catching the exception only reports the failed export.

## Suggested fix

Embed a licensed Unicode font with fontkit, and use it for text fields and all appearances. Decide how unsupported emoji/glyphs are represented, and communicate any substitution instead of silently removing text. Keep the font objects scoped to each export.

Regression: export supported accents, CJK, and emoji in each free-text section; inspect the resulting text/appearance and ensure an unsupported glyph cannot abort the entire export.

## Implemented fix

PDF exports use document-scoped fonts and a bundled licensed Noto CJK font for text outside WinAnsi. Standard Latin exports retain the lightweight Helvetica path. Unicode bytes are cached, loaded only during export, and fully embedded to preserve composite CJK glyphs. Unsupported glyphs visibly warn; their original text remains in editable form fields. Concurrent exports no longer share mutable font instances. Regression: `src/hiveborn/creator/pdf_creator.test.ts`.

Regression tests and local browser/API validation pass. The third independent review found no remaining actionable feedback; the [review index](README.md) records the complete iteration history and evidence.
