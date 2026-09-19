# MPI-799 Plan — the public Flow registry repo (`MadPonyInteractive/cubric-flows-registry`)

## Current State

**As of 2026-09-19, all five items are done. The repo is LIVE AND PUBLIC at
https://github.com/MadPonyInteractive/cubric-flows-registry. The only thing outstanding is
the paid lane's private email, which is Fabio's to name.** Everything below is the planning
record; read it for why the design is what it is, not for where the work stands.

Project mode: scalable-foundation.

**The four decisions are already made and are NOT to be re-derived or re-asked.** They are
written in full in `task.json`'s description (`DECIDED 2026-09-19 (Fabio)`): the repo is
`MadPonyInteractive/cubric-flows-registry` and public (go given), MIT on the registry while
each Flow keeps its own licence, a PR for BOTH lanes with the registry as a CATALOGUE and
never a file host, and the paid lane's private email still missing. Read that description,
not this paragraph, for the reasoning.

Facts established at planning time, each checked on disk on 2026-09-19:

- **The repo does not exist.** `gh repo view MadPonyInteractive/cubric-flows-registry` →
  "Could not resolve to a Repository". `gh auth status` is logged in as `MadPonyInteractive`
  with `repo` and `workflow` scopes, so both creating it and pushing a workflow file work
  from this box with no extra token.
- **The linter runs from a BARE checkout — no `npm ci`, no `node_modules`.** Proven, not
  assumed: `git archive HEAD` extracted into an empty scratch dir, then
  `node scripts/lint-flow-package.mjs "C:/AI/Mpi/Cubric-Flows/head-swap"` ran and reported.
  `userFlows.loadPackage` pulls only node builtins plus *relative* app JS (`models.js`,
  `dependencies.js`, `pluginsRegistry.js`, `workflowInjectors/index.js`, `appVersion.js`) and
  none of those reach `node_modules`; `extract-zip` sits on the zip-INSTALL path, which the
  linter never takes. So the CI job is checkout + checkout + `node`. **No install step, so
  no lockfile, no cache, no supply chain in the registry repo at all.**
- **`compat.minAppVersion` is checked against the PINNED CHECKOUT's `APP_VERSION`.** That same
  bare run exited 1 with exactly one problem: `Needs app version 2.0.0 or later (this is
  1.6.1)`. MPI's own reference package cannot pass CI until the pin is 2.0 — which is
  precisely this card's opening date, so this is the design working, not a fault. It also
  fixes what the pin MEANS: the pin is the app version the registry lists for.
- **No released tag carries the linter.** Newest tag is `v1.5.0` (locally and via
  `git ls-remote --tags origin`), and `git cat-file -e v1.5.0:scripts/lint-flow-package.mjs`
  says NO — it landed on master in `89280fd5`. So the CI pin is `master` until 2.0 tags, then
  `v2.0.0`. One `env:` line, so the flip is a one-character-class edit, not a rewrite.
- **CI cannot set `COMFY_PATH` or `COMFY_URL`.** A GitHub runner has no ComfyUI and no 80 GB
  of node packs. The handoff's "run the linter with COMFY_PATH set" is not achievable there
  and should not be attempted: CI gets the engine-free half — manifest shape, the title law,
  the markup security rule, and id resolution against the pinned app. Node classes and pack
  drift stay where MPI-798 already put them: the author's `install-flow-devkit.mjs`, and MPI's
  own private review for the paid lane. The README must say that plainly so a green tick is
  not read as a promise the Flow runs.
- The upstream repo to check out in CI is `MadPonyInteractive/Cubric-Studio` (the `origin`
  remote of this tree), which is public.
- **Name trap, carried from the handoff:** `c:\AI\Mpi\Cubric-Flows` is ALREADY a local git repo
  holding MPI's two PAID packages under an all-rights-reserved LICENCE with NO remote. Never
  run `git push` or `gh repo create` from that folder. It is a read-only source of the
  head-swap sample here.

## Implementation

- [ ] **Scaffold the registry content in a scratch dir** — not in this tree, not in
  `c:\AI\Mpi\Cubric-Flows`. `LICENSE` (MIT, MadPony Interactive), `README.md` (the submission
  rules: the two lanes, package format pointing at `docs/flow-packages.md`, the devkit
  command, what CI does and explicitly what it does NOT check), `flows/` with one worked entry,
  `flows/README.md` naming the entry fields, and the two PR templates under
  `.github/PULL_REQUEST_TEMPLATE/`. The paid lane's private address stays a literal `<TBD —
  email>` placeholder; **do not invent one.** **Verify:** every file reads back; no invented
  URL or email anywhere; `grep` for `<TBD` finds exactly the placeholders intended.

- [ ] **Write the catalogue entry check** — `scripts/check-entry.mjs` in the registry, node
  builtins only, ~40 lines: required keys present, `id` equals the filename stem, `licence`
  non-empty, `minAppVersion` is semver, `sha256` is 64 hex **on the paid lane only**, and the
  same no-markup rule the app enforces (`<`, `>`, `"`, `` ` `` reject the entry). **Verify:**
  run it over the worked entry (exit 0) and over a deliberately broken copy (exit 1, and the
  message names the field). This is the plan's one non-trivial branch, so this check is what
  proves it.

- [ ] **Write `.github/workflows/lint-submission.yml`** — checkout the registry, checkout
  `MadPonyInteractive/Cubric-Studio` at `env.STUDIO_REF` (`master` until 2.0, then `v2.0.0`),
  `setup-node`, then: always run `check-entry.mjs` over the changed `flows/*.json`, and run
  `lint-flow-package.mjs` over the submitted package folder **only if the PR carries one** —
  the one conditional the free/paid split needs. No `npm ci` anywhere. **Verify:** run the
  exact same command sequence locally against the bare checkout plus
  `c:\AI\Mpi\Cubric-Flows\head-swap` and get the known single `minAppVersion` failure, so the
  workflow's behaviour is known before a runner ever executes it.

- [ ] **Create the repo PRIVATE, push, and prove CI on a self-opened test PR** carrying
  head-swap. `gh repo create MadPonyInteractive/cubric-flows-registry --private`. **Verify:**
  the Actions run executes both checks and reports the predicted result — the `minAppVersion`
  line as the lint's only error — so a green tick on a real submission means something.
  Delete the test PR's branch afterwards; leave the run as the record.

- [ ] **Flip it public.** `gh repo edit --visibility public`. **This is the only step here that
  cannot be quietly undone, and it is Fabio's call on timing**, separately from the go he has
  already given on the repo being public: the card's target is that it opens the day 2.0 ships,
  and until then CI is pinned to `master` and MPI's own sample fails the version gate. Ask
  before running it; do not fold it into the step above. **Verify:** the repo answers
  anonymously and the workflow file is visible.

## Completed

- [x] **Items 1-4.** The repo exists at
  https://github.com/MadPonyInteractive/cubric-flows-registry — **PRIVATE**, default branch
  `main`, three commits, eight files: `LICENSE`, `README.md`, `.gitattributes`,
  `flows/README.md`, `scripts/check-entry.mjs`, `scripts/check-entry.test.mjs`,
  `.github/pull_request_template.md`, `.github/workflows/lint-submission.yml`.
  - One PR template, not two. GitHub only offers a `PULL_REQUEST_TEMPLATE/` directory
    behind a `?template=` URL parameter, which a drive-by submitter never types. One
    default template with a lane section each, "delete the one that does not apply",
    always appears.
  - `scripts/check-entry.mjs` is ~100 lines of node builtins. The lane is what decides
    whether `flows/<id>/` may exist beside the entry — that is the "catalogue, never a file
    host" rule in code rather than in prose. 10 `node --test` cases cover it and run in CI.
  - Local dry run of the exact CI sequence: tests 0, entries 0 (both lanes), package **1**
    with the single expected `Needs app version 2.0.0 or later (this is 1.6.1)`, paid-lane
    metadata-only 0. Predicted, then observed.
  - CI proven on a real runner over two probe runs, green then red. Both checkouts, node,
    and **zero `npm install` in either repo**, as planned.

- [x] **Item 5, the public flip.** Done 2026-09-19 on Fabio's instruction. `gh repo edit`
  refuses `--visibility` unless `--accept-visibility-change-consequences` is passed too —
  the command handed over the first time was missing it, so his run errored and the repo
  stayed private until the corrected command ran. `gh api repos/... --jq .private` → false,
  and `raw.githubusercontent.com` serves the workflow file with a 200, which only happens
  for a public repo.

## Remaining Work

- **The paid lane's private submission email.** `<TBD — email>` is live in the public
  README and PR template right now. Both say the address is not set yet and that the
  registry opens with 2.0, so it reads as pending rather than broken — but it is a
  release-day blocker. Fabio has not named one. **Do not invent one, and do not use his
  personal address**; it wants an address on a domain he owns, routed to him.
- **Open, Fabio's alone:** the paid lane's private submission email. Already asked once and
  unanswered; templates ship with a placeholder until he names one, and that placeholder is a
  release-day blocker, not a build blocker.

## Plan Drift

- 2026-09-19 (planning): the handoff's build note said CI would run the linter "with
  `COMFY_PATH` set". Planning killed that — a GitHub runner has no ComfyUI, so CI is the
  engine-free validator only, and the README carries the caveat instead.
- 2026-09-19 (planning): the handoff implied the CI pin would be a release tag. No released
  tag carries the linter (newest is v1.5.0), so the pin starts at `master` and flips at 2.0.
- 2026-09-19 (planning): assumption stated, not a decision taken away from Fabio — the repo is
  created PRIVATE and flipped public as its own last step, because his recorded go was for the
  repo being public, while the card's target is that it OPENS at 2.0. Private-then-flip
  satisfies both and is reversible; creating it public today is not.
- 2026-09-19 (build): **the CI probe found a real bug, which is what it was for.** A git
  pathspec is not a shell glob — `*` matches `/` as well — so `flows/*.json` also selected
  `flows/<id>/flow.json` and `flows/<id>/workflow.json` and ran the catalogue-entry checker
  over a package's own manifests. The first real free-lane PR would have gone red with
  fourteen nonsense errors while the package linter, the step that matters, never ran at
  all. `:(glob)` switches to pathname matching, where `*` stops at a separator. Fixed in
  `77acac7`, and the comment above it says why so nobody "simplifies" it back.
- 2026-09-19 (build): the free-lane probe deliberately shipped an INVALID package rather
  than a valid one. A valid synthetic Flow would have to live in the history of a repo that
  becomes public, and head-swap — the only real package to hand — is MPI's paid,
  all-rights-reserved product. Neither belongs there. An invalid probe proves the same
  wiring: the step fires, the linter is invocable, and the job goes red.

## Verification

**Verify mode:** auto

The card has no UI surface — every check is a CLI or a CI run, so self-verification is real
verification. End to end:

1. `node scripts/check-entry.mjs flows/<sample>.json` → exit 0; the broken copy → exit 1.
2. The bare-checkout lint command → the single expected `minAppVersion` problem, nothing else.
3. The test PR's Actions run → both jobs execute and report as predicted.

The public flip is NOT covered by auto-verification: it stops for Fabio regardless of this
line.

## Preservation Notes

- `docs/flow-packages.md` ends with "the public registry repo is **MPI-799**, due to open at
  the 2.0 release". Once the repo is public that line should carry the real URL. It is a
  one-line doc edit in THIS repo, so it belongs to this card's close-out, not the registry's.
- Not this card, both flagged and unactioned by the previous session: MPI-538's "BLOCKED on
  MPI-531" description is stale by a month, and MPI-780's plan still says it closes when
  MPI-781 does, which is false since MPI-781 closed 2026-09-19.
