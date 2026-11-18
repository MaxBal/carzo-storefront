# CARZO — prelaunch integration candidate provenance

Branch: `xiaomi/prelaunch-integration-review`
Purpose: single pre-integration candidate for end-to-end store testing (no new features).

## Composition (in commit order)

| Step | Origin | SHA / head | Notes |
| --- | --- | --- | --- |
| Base | `local/composition-2026-11-16` | `7a50686` | Merged PR #4+#5 (audit + followup), #6+#9 (checkout idempotency + attempt-conflict guard), #7 (cache policy), #8+#10 (Nova Poshta/keyCRM hardening + body-read timeout). Prior conflict resolutions preserved (published filters, cache mode, test scripts). |
| PR #12 | `codex/preview-legacy-integration-guards` | `f110017` | Preview guards + explicit prelaunch shared-Supabase mode (`SUPABASE_ALLOW_SHARED_PREVIEW`). Merged with `--no-ff`, no conflicts. |
| Production baseline | deployment `dpl_6JA9Cgf6V5aZox1fLmSoCVf4TGHg` | `437f399` (= `baf997e` + `f8e0e63` + `437f399`) | Verified commit range only, merged `--no-ff`. Patch evidence: `production-baseline-baf997e-to-437f399.patch` (8 files, +78/−9 — matches this merge's diffstat). |

## PR heads used (verified 2026-11-18 via `git ls-remote` + `gh pr list`)

- #4 `17cdb4e` fix/xiaomi-audit-2026-11-13 (base main)
- #5 `df322e1` fix/antigravity-xiaomi-review-followup (base PR #4) — depends on #4
- #6 `7ae4333` fix/antigravity-checkout-reliability (base main)
- #9 `8ca2de3` codex/checkout-conflict-review (base PR #6) — depends on #6
- #7 `6f9d0fb` fix/antigravity-nextjs-caching (base main)
- #8 `dd8aaa6` fix/antigravity-integrations-hardening (base main)
- #10 `2dc495a` codex/nova-body-deadline-review (base PR #8) — depends on #8
- #12 `f110017` codex/preview-legacy-integration-guards (base main)

PR #11 (`05f6cfd`) is review documentation only — not merged as functional change.

No PR change was applied twice: the composition base already contains the exact
remote heads above; this branch only adds PR #12 and the production baseline.

## Production baseline status

- Production alias `carzo-storefront.vercel.app` → `dpl_6JA9Cgf6V5aZox1fLmSoCVf4TGHg`
- `meta.githubCommitSha = 437f399187a79be4d22422252b3fe5fd4600792c`, `meta.githubCommitRef = main`
- `meta.gitDirty = 1` — deployment was created with uncommitted changes.
- **Dirty snapshot: UNKNOWN.** This candidate is NOT an exact copy of current Production;
  it is Production's known commit range plus the listed functional fixes.
- `437f399` is 2 commits ahead of `origin/main` (`baf997e`): `f8e0e63`, `437f399`.
