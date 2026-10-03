# H06 — WebSocket authentication tokens are logged in request URLs

Severity: **High**. Confirmed with a disposable local token at `8a0544f`; production logging exposure follows from the same configuration and has not been inspected in production.

Status: **Fixed and independently reviewed**. Final app source: `396537f`.

Revalidated on committed revision `88c2eb0` after incorporating the newer local performance work. Uncommitted architecture changes in the primary checkout were outside this review.

## Reproduction and evidence

Use local test sign-in and watch the running backend's request log. The opening character socket is logged as:

```text
GET /characters/live?token=hiveborn-local-dev-user
```

A fresh log sample from the final revalidation is saved in `hiveborn-fixture-token-log.txt` in the shared evidence directory. This value is the development-only fixture, not a real user's secret. The production WorkOS sealed session is placed in the same query parameter. The group socket uses the same mechanism.

## Cause

`src/hooks/useCloudCharacterSync.ts` and the group connection code put `tokenStorage.get()` in a URL query parameter. `backend/src/index.ts` enables Fastify's request logging without a URL redactor, and `backend/src/websocket/liveGroups.ts` authenticates that parameter. Logs can therefore retain credentials that grant account access; URL-bearing infrastructure logs can also retain them.

## Suggested fix

Use an initial authenticated socket message over TLS, or exchange the normal session for a short-lived, single-use socket ticket. Authenticate before subscribing or sending data. Redact sensitive URL parameters and authorization headers in app/infrastructure logs as defense in depth; changing only app logging leaves the URL exposure intact.

Regression: establish both socket types with a recognizable fixture credential and assert that no log URL/message contains it. Unauthorized sockets must not receive events.

## Implemented fix

Both WebSocket routes authenticate the first message, never a URL query parameter. Nothing subscribes or changes presence before authentication. Origins and group membership remain enforced. Backend request logging removes query strings and redacts credential headers; transient provider failures close with retryable 1013. Regression: `backend/tests/liveAuthentication.test.ts`.

Regression tests and local browser/API validation pass. The third independent review found no remaining actionable feedback; the [review index](README.md) records the complete iteration history and evidence.
