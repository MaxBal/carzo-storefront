# Checkout acknowledgement and submit feedback

Base: `main` at `df6dd8e0080b8dddf3a4fce89d76703a5d488f9e`.

## Confirmed cause and resulting behavior

`createOrder` persisted the order and then awaited `runPostOrderSideEffectsOnCreate`. That runner sends notifications first and pushes to keyCRM afterwards. The buyer's response therefore waited for both integrations, even after Telegram had delivered its message. This matches the reported delay after Telegram arrival. The exact Production contribution of each network operation was not measured; catalog, pricing, delivery validation and persistence still take time before acknowledgement.

On Vercel, a newly persisted order now registers the same follow-up promise with `waitUntil` from pinned `@vercel/functions@3.11.3` and returns the authoritative order number/total without awaiting Telegram/keyCRM completion. This is the documented API for Next.js below 15.1; the project remains on Next.js 14.2.35. Outside Vercel the task is awaited. If registration throws, the same promise is awaited, without starting another send. Failed persistence never schedules follow-ups, and `created:false`/replay paths never resend them.

`waitUntil` keeps the request alive for the tracked task; this is not an untracked detached promise. It is also not a durable queue: function termination/timeouts can still interrupt delivery, and no outbox/retry infrastructure was added. The persisted order remains the success boundary, as before.

The submit button now has one inline flex wrapper, an independent fixed-size mint spinner, a single changing label (`Оформлюємо замовлення…`), and an indeterminate accent along the bottom. It keeps its size, exposes aria-busy/live status, respects reduced motion, and retains the synchronous ref guard against repeated submission. No artificial success delay or fabricated completion percentage was added. Existing button CSS was already Flex; an earlier Grid diagnosis was withdrawn. The original iOS-specific overdraw was not independently reproduced on an actual iPhone.

## Verification

- TypeScript, Next lint and production build passed. Existing img/alt lint warnings remain.
- Build used a loopback, GET-only public-content snapshot; no Production credentials.
- 200 tests passed across checkout, idempotency, keyCRM, Telegram routing and Preview boundaries.
- A network-blocked integration test exercises the real server action and actual SDK waitUntil against an injected request context: acknowledgement returns while fake Telegram/keyCRM promises remain pending; replay does not write/send/schedule twice; failed persistence does not schedule anything.
- Additional tests cover background rejection isolation, registration failure without duplicate sends, and awaiting integrations when no scheduler is supplied.
- Browser: actual CartDrawer and stylesheet in an isolated React harness, with server action, delivery selection and Next image/link adapters substituted. Checked 390/1440 px and reduced motion, spinner/text separation, stable button size, blocked double submit, error recovery and confirmation only after acknowledgement.
- Browser harness and test data are synthetic. No orders, customer writes, Telegram messages, keyCRM calls, env changes or schema changes were performed against working systems.

## Release boundary

This PR changes execution of the working order notifications. A Production release requires the owner's authorization for that change. After release, public smoke checks can run without creating an order; proving delivery through the real Vercel background context requires a separately authorized synthetic checkout or an owner-performed checkout followed by read-only log verification. Current Cloud Vercel access does not cover yevgens-projects runtime logs.

Rollback is a code revert; the change does not alter the database schema, checkout attempt IDs, request fingerprints or stored orders. Both the old and new code preserve created-only notification gating.
