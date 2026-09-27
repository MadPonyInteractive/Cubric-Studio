# MPI-872 Validation

**Verify mode:** `user-ux` — the only check that counts is a real click landing on a real
product page with the discount applied. Reading config proves nothing here.

## 2026-09-27 - REJECTED: no redirect, the app links to Gumroad directly (Fabio)

Fabio decided against the `cubric.studio/flows/*` redirects: one more thing to do on
release day. Instead (worked from MadPony-Identity MPI-81):

- Each Gumroad product has its 100-use, 100%-off code set to **apply automatically**, so
  the plain product URL gets the discount with no code in it. Checked logged-out: both
  `https://mad-pony-interactive.gumroad.com/l/khsbf` (Head Swap) and `/l/odacbs`
  (DramaBox) show £4 struck through, £0, "100% off will be applied at checkout".
- `MpiFlowLibrary.js`: each `PAID_FLOWS` entry carries `url` (the plain product page) and
  Get it opens `entry.url`; `paidFlowUrl` and its cubric.studio URL are gone. Traced: tile
  `item.source` is the `PAID_FLOWS` object → `_pick` → `_openPaidDetail(entry)`.
  `node --check` clean; `flow-licence-surface`, `flow-lora-rack`, `flow-model-choice`
  tests 42/42 pass.
- No coded URL is in this public repo, which was the redirect's reason for existing.

Still to see on the first 2.0 build: click Get it on each tile and land on the page at £0.
