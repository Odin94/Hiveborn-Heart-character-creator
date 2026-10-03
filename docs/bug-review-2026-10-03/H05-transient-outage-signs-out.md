# H05 — A temporary authentication outage permanently signs the user out

Severity: **Medium**. Confirmed in the running browser at `8a0544f`.

Status: **Fixed and independently reviewed**. Final app source: `396537f`.

Revalidated on committed revision `88c2eb0` after incorporating the newer local performance work. Uncommitted architecture changes in the primary checkout were outside this review.

## Reproduction and evidence

Sign in through the actual local test sign-in control. Make the next `/auth/me` response return 503, then reload. The valid `hiveborn-auth-token` is removed from browser storage. Restore normal responses and reload again: the app still displays Sign in and cloud sync does not resume.

The test injects only the transient 503 response; login and the recovery request path use the actual app. Local characters remain available. Evidence: `hiveborn-auth-outage.js`, `browser-results.json:H05auth`, and `hiveborn-outage-signout.png`.

## Cause

`src/hooks/useAuth.ts:refresh` catches every failure and calls `tokenStorage.remove()`. It makes no distinction between an invalid session and a service/network failure. Clearing the token turns a recoverable outage into a permanent loss of the authenticated session.

## Suggested fix

Remove a session only on a confirmed authentication rejection. Keep credentials on timeouts, offline errors, and 5xx responses; expose a reconnecting state and retry when connectivity returns. Avoid repeated destructive actions during initialization.

Regression: valid token plus 503, request failure, and later success must retain authentication and resume sync. A genuine invalid-session response must still clear authentication.

## Implemented fix

Retryable failures retain credentials and confirmed users; initialization stays pending until a definitive result. Reconnect and timed retry recover automatically. Only HTTP 401 invalidates a session. Session-generation guards reject responses after logout or a token/account change, including changes in another tab. Verified rotation retains the same session generation and cannot restore an obsolete session. External authentication changes refresh the account while cloud sync pauses during initialization. Backend provider failures return retryable responses. Regression: `src/hooks/useAuth.test.tsx`.

Regression tests and local browser/API validation pass. The third independent review found no remaining actionable feedback; the [review index](README.md) records the complete iteration history and evidence.
