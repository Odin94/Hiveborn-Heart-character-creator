# Hiveborn deep bug review — 2026-10-03

**All 7 findings are fixed and verified. The third independent review found no remaining actionable feedback.** Each report includes reproduction, observed impact, cause, a suggested fix, and a regression check.

Initial reviewed snapshot: `8a0544f`; final review baseline: `88c2eb0`. Final fixed app source: `396537f` (this closeout changes documentation only). The fixes are in the separate worktree on `fix/odin/review-bug-fixes`. The primary checkout's uncommitted architecture work was not reviewed or changed. Nothing was pushed and no PR was created.

## Findings

| ID                                                 | Severity | Status | Fixed behavior                                                                               |
| -------------------------------------------------- | -------- | ------ | -------------------------------------------------------------------------------------------- |
| [H01](H01-clean-remote-update-duplicates.md)       | High     | Fixed  | Clean cloud updates are adopted without duplicate sheets.                                    |
| [H02](H02-cancelled-class-removes-earned-skill.md) | High     | Fixed  | Cancel preserves the sheet; Apply preserves earned traits and creates one undo checkpoint.   |
| [H03](H03-delayed-stress-hits-wrong-character.md)  | High     | Fixed  | Delayed rolls follow the original UUID and cancel when that sheet is deleted.                |
| [H04](H04-cross-tab-storage-overwrite.md)          | High     | Fixed  | Concurrent browser edits, conflicts, failed writes, and recovery records remain recoverable. |
| [H05](H05-transient-outage-signs-out.md)           | Medium   | Fixed  | Temporary outages retain credentials and retry; stale responses cannot switch accounts.      |
| [H06](H06-websocket-token-in-logs.md)              | High     | Fixed  | Sockets authenticate through a message; request URLs and logs contain no bearer token.       |
| [H07](H07-pdf-unicode-fails.md)                    | Medium   | Fixed  | Unicode PDFs export successfully; unsupported glyphs warn while editable text stays intact.  |

## Verification and scope

Baseline: 34 frontend tests and 8 backend tests. Final fix validation includes 69 frontend tests and 9 backend tests. Frontend and backend production builds/typechecks pass. The clean larger-collection probe (21 sheets, 15,500 characters of notes per imported sheet, repeated edits) did not reproduce storage exhaustion or obvious editing delay.

All three apps were launched locally against disposable SQLite databases. Browser/API probes cover anonymous persistence, cross-tab editing, import/export, authenticated sync, conflicts, reload/recovery, character switching, and the reported interaction bugs. Default sheets were inspected at 390 × 844 with no horizontal overflow or page errors. The original passing test suite did not prevent these bugs. Final native-browser/API validation covered H01–H03 and H05–H07; the independent reviewer also verified H04 storage recovery and the real IndexedDB compaction fallback. PDF validation includes Poppler rendering, extracted text, and a rendered two-glyph comparison.

Progeny authentication verification uses fixture users at the WorkOS boundary; Hiveborn and CozyCrowns use their built-in local sign-in. Live WorkOS login, real multi-device networks, production data, and production latency were not tested. Fixtures and failure injection are identified in the individual reports. They do not change app source or reset any limits.

## Evidence

Shared [browser results](../../../evidence/browser-results.json), [screenshots](../../../evidence/), [check logs](../../../evidence/), and [reproduction scripts](../../../harness/) live outside the app repositories, under the common review directory. Scripts call actual stores/APIs to prepare some fixtures; the reports distinguish those from direct UI actions.

- [Original screenshot: primary reproduction](../../../evidence/hiveborn-class-cancel.png)
- [Original screenshot: second reproduction](../../../evidence/hiveborn-stress-wrong-character.png)

Final [fix evidence](../../../evidence/fixes/) includes the [class interaction](../../../evidence/fixes/hiveborn-class.json), [delayed stress roll](../../../evidence/fixes/hiveborn-stress.json), [clean remote update](../../../evidence/fixes/hiveborn-clean-remote.json), [outage recovery](../../../evidence/fixes/hiveborn-auth-outage.json), [WebSocket authentication](../../../evidence/fixes/hiveborn-websocket.json), [Unicode export](../../../evidence/fixes/hiveborn-pdf.json), and [rendered PDF](../../../evidence/fixes/hiveborn-unicode-pdf.png). Check logs are in the shared evidence directory under `hiveborn-round2-*`.

The initially reproduced [heavy-startup finding](resolved/H08-export-and-3d-code-block-startup.md) is **resolved by the newer performance commits** and excluded from the open count. Controlled cold load improved from 4.43 to 2.82 seconds under identical throttling.

## Review iterations

1. **Round 1 — four actionable findings.** The reviewer found copied writer IDs, journal-only startup recovery failure, quota-failed drafts overwritten by external hydration, and late authentication responses after another tab changes accounts. All four were fixed with focused regression tests in `469c848`; IndexedDB transactions also provide safe compaction when Web Locks are unavailable.
2. **Round 2 — one actionable finding.** The reviewer verified the four revisions, including the native IndexedDB fallback, then found invalid Markdown nesting in the class dialog. The paragraph wrapper was replaced with a div using the same classes in `396537f`.
3. **Round 3 — no actionable feedback.** The independent reviewer rechecked the cumulative implementation at `396537f`. Final validation passed 69 frontend tests and 9 backend tests, formatting/lint checks, typechecks, and production builds. The requested implementation/review loop is complete.

Unicode PDFs fully embed a compatible TrueType font to preserve composite CJK glyphs. These exports are larger (approximately 6.6 MB); ordinary Latin exports use lightweight standard fonts. Emoji or other glyphs absent from the embedded font produce a visible warning, and their original text remains in editable PDF fields.
