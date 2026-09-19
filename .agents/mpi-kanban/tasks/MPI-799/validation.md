# MPI-799 Validation

Verify mode: `auto`. Everything below was run and observed, not asserted.

## 1. The linter runs from a bare checkout — no `npm ci`

`git archive HEAD` into an empty scratch dir (no `node_modules`), then
`node scripts/lint-flow-package.mjs "C:/AI/Mpi/Cubric-Flows/head-swap"`.

Ran. This is what the whole CI design rests on, so it was proven before the workflow was
written rather than after.

## 2. `compat.minAppVersion` is gated on the pinned checkout's `APP_VERSION`

Same run, exit 1, exactly one problem:

```
• Needs app version 2.0.0 or later (this is 1.6.1).
```

So the pin IS the app version the registry lists for, and MPI's own head-swap cannot pass
until the pin is 2.0 — which is the card's opening date.

## 3. No released tag carries the linter

`git ls-remote --tags origin` → newest is `v1.5.0`; `git cat-file -e
v1.5.0:scripts/lint-flow-package.mjs` → absent. It landed on master in `89280fd5`. Hence
`STUDIO_REF: master`, flipping to `v2.0.0` on release day.

## 4. The entry checker's own tests

`node --test scripts/check-entry.test.mjs` → **10 passed, 0 failed.** Covers both lanes
passing, a free entry missing its package, a paid entry that commits one, a short `sha256`,
an id/filename mismatch, an unknown key, markup at the top level and nested in a list, and
an empty argument list exiting 0 (CI passes one often).

## 5. Local dry run of the exact CI sequence

Against the bare checkout plus a copy of head-swap standing in for a submission:

| Step | Exit | |
|---|---|---|
| `node --test scripts/check-entry.test.mjs` | 0 | |
| `check-entry.mjs` over a free and a paid entry | 0 | |
| `lint-flow-package.mjs` over the package | **1** | the single expected `minAppVersion` line, nothing else |
| paid lane, metadata only | 0 | nothing to lint |

Predicted first, then observed.

## 6. CI proven on a real runner — green, then red

Probe PR #1 on the private repo, since closed and its branch deleted.

- **Run 35460593816 — success.** Paid lane, metadata only. Resolved `Entries:
  flows/ci-probe.json` / `Packages: none`, checked the entry, skipped the package step.
  Both checkouts and node, **zero `npm install` in either repo**.
- **Run 35460668537 — failure, and the failure was ours.** The free-lane probe exposed the
  git pathspec bug: `flows/*.json` also matched the package's `flow.json` and
  `workflow.json`, so the entry checker was handed a package manifest and produced fourteen
  nonsense errors, while the package linter never ran. Fixed with `:(glob)` in `77acac7`.
- **Run 35460729843 — failure, correctly.** After the fix: `Entries: flows/ci-probe.json`,
  `Packages: flows/ci-probe`, entry ✓, and the free-lane linter **fired** and reported the
  app's own messages on the deliberately invalid package, including the title law:

```
• flow.mediaType must be one of image, video, audio.
• flow.type must be one of create, edit, enhance.
• flow.preview: "nope.webp" is not in the package folder.
• workflow.json: no capture node — every workflow needs a result node titled Output_* …
```

That is the registry's whole thesis working end to end: the app's own validator, on a
GitHub runner, with nothing installed.

The fix was cherry-picked to `main`; the probe content never touched it. `main` holds
eight files and no probe.

## Not verified, and not claimable

- **Node classes and node-pack drift on a runner.** Impossible by design — no ComfyUI
  there. The README says so in its own section so a green tick is not misread.
- **A valid free-lane package passing CI end to end.** The probe package was invalid on
  purpose: a valid synthetic Flow would live forever in the history of a repo that becomes
  public, and the only real package available is MPI's paid, all-rights-reserved head-swap.
  The first genuine submission is what closes this gap.

## 7. The repo is public

Flipped 2026-09-19 on Fabio's instruction, after his own attempt errored: **`gh repo edit`
refuses `--visibility` unless `--accept-visibility-change-consequences` is passed as well.**
The command handed to him the first time was missing that flag.

Two checks, one of which does not trust our own credentials:

- `gh api repos/MadPonyInteractive/cubric-flows-registry --jq '{private, visibility}'` →
  `{"private": false, "visibility": "public"}`.
- `curl https://raw.githubusercontent.com/.../main/.gitattributes` → 200 with the real file
  body. That host serves public repositories only, so it is the anonymous proof.

## 8. The paid lane's private channel is named

`fabio@madponyinteractive.com`, given by Fabio 2026-09-19. He asked whether a
Cubric-Studio address existed to use instead; it does not. MadPony-Identity documents no
mailbox on `cubric.studio`, and its only mail capability is his personal Gmail, which must
never go in a public README. The address chosen is the business-domain one that MPI-75
records as Namecheap forwarding **confirmed by test email** (2026-09-16) and as the contact
given to D&B — so it is known to route, not merely plausible.

Live in the README and the PR template as of `790df3b`. Verified anonymously:

```
curl .../main/README.md | grep madponyinteractive
→ Send the paid-lane zip to **fabio@madponyinteractive.com**, with the PR number in the
```

Zero `TBD` placeholders remain in either file.

`docs/flow-packages.md` in this repo no longer points at "MPI-799, due to open" — it names
the live registry, both lanes, and the two things its CI cannot check.

## Close-out

Everything the card scoped is built, public and verified. Nothing is outstanding.
