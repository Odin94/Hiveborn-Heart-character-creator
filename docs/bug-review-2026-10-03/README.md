# Hiveborn deep bug review — 2026-10-03

**7 confirmed open findings: 5 high and 2 medium.** Each report includes reproduction, observed impact, cause, a suggested fix, and a regression check.

Initial committed snapshot: `8a0544f`. Final revalidation: `545bb09` plus documentation-only review commits. The separate worktree is on `chore/odin/deep-bug-review`. The primary checkout's uncommitted architecture work was not reviewed or changed. Nothing was pushed and no PR was created.

## Findings

| ID                                                 | Severity | Observed bug                                                             |
| -------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| [H01](H01-clean-remote-update-duplicates.md)       | High     | A clean remote update creates and uploads a duplicate sheet              |
| [H02](H02-cancelled-class-removes-earned-skill.md) | High     | Cancelled class setup can remove an independently earned skill           |
| [H03](H03-delayed-stress-hits-wrong-character.md)  | High     | A delayed stress roll can damage the wrong character                     |
| [H04](H04-cross-tab-storage-overwrite.md)          | High     | Editing in a second tab silently overwrites the first tab's browser data |
| [H05](H05-transient-outage-signs-out.md)           | Medium   | A temporary authentication outage permanently signs the user out         |
| [H06](H06-websocket-token-in-logs.md)              | High     | WebSocket authentication tokens are logged in request URLs               |
| [H07](H07-pdf-unicode-fails.md)                    | Medium   | Valid Unicode character text prevents PDF export                         |

## Verification and scope

Frontend: 30 tests; backend: 7 tests. Frontend and backend production builds/typechecks pass. The clean larger-collection probe (21 sheets, 15,500 characters of notes per imported sheet, repeated edits) did not reproduce storage exhaustion or obvious editing delay.

All three apps were launched locally against disposable SQLite databases. Browser/API probes cover anonymous persistence, cross-tab editing, import/export, authenticated sync, conflicts, reload/recovery, character switching, and the reported interaction bugs. Default sheets were inspected at 390 × 844 with no horizontal overflow or page errors. Passing existing tests did not prevent the reported bugs.

Progeny authentication verification uses fixture users at the WorkOS boundary; Hiveborn and CozyCrowns use their built-in local sign-in. Live WorkOS login, real multi-device networks, production data, and production latency were not tested. Fixtures and failure injection are identified in the individual reports. They do not change app source or reset any limits.

## Evidence

Shared [browser results](../../../evidence/browser-results.json), [screenshots](../../../evidence/), [check logs](../../../evidence/), and [reproduction scripts](../../../harness/) live outside the app repositories, under the common review directory. Scripts call actual stores/APIs to prepare some fixtures; the reports distinguish those from direct UI actions.

- [Screenshot: primary reproduction](../../../evidence/hiveborn-class-cancel.png)
- [Screenshot: second reproduction](../../../evidence/hiveborn-stress-wrong-character.png)

The initially reproduced [heavy-startup finding](resolved/H08-export-and-3d-code-block-startup.md) is **resolved by the newer performance commits** and excluded from the open count. Controlled cold load improved from 4.43 to 2.82 seconds under identical throttling.
