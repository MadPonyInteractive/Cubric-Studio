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

## Open, and Fabio's alone

- **The public flip** — `gh repo edit --visibility public`. Not run.
- **The paid lane's private submission email.** `<TBD — email>` in the README today. A
  release-day blocker, not a build blocker.
