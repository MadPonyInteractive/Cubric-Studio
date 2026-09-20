# MPI-841 — The Flow Library browses the community registry

**Umbrella:** MPI-560 phase 8. **Sibling:** MPI-831, which builds the same Add-on Flows
section for INSTALLED packages plus the two paid tiles. The two ship independently; MPI-831
does not wait on this card, and this card renders into the section MPI-831 creates.

**Verify mode:** `user-ux`.

## Why this exists

**Fabio, 2026-09-20:** third-party Flows must be visible in the app. A listing on the
website is not an answer, because most users never visit the website. They go in the
Add-on Flows section at the bottom of the Flow Library, next to the installed ones.

## Current State

There is no discovery of any kind, and this was never carded until now.

- `listFlows()` in `js/data/flowsRegistry.js:2547` returns `FLOWS.slice()` — built-ins plus
  whatever is already in `user_flows/`. That is the entire Library.
- **Nothing in the app knows the registry exists.** `grep -rni "cubric-flows-registry"`
  across `js/`, `routes/`, `services/`, `scripts/` returns zero hits.
- So the only route to a third-party Flow is to have already found and downloaded it.

MPI-560 phase 6 always intended otherwise — *"The GitHub registry is phase 7 — advertising
only, never a payment rail."* Phase 7 (MPI-799) built the submission and review half. The
advertising half fell between MPI-532 and MPI-799 with no card to catch it, which is why
Fabio expected to find one and there was none.

At 2.0 this is a contradiction: submissions open publicly and Flows become the headline
feature, while no user can find a third-party Flow without leaving the app.

## Phase 1 — the registry grows an index (registry repo, not this one)

`flows/` is a folder of one JSON per Flow with no index, so a reader needs one request per
Flow and cannot even enumerate them without the GitHub API.

Add a CI step on merge to `main` that concatenates `flows/*.json` into a generated
`index.json` at the repo root. Use `:(glob)` in any pathspec: a git pathspec `*` crosses
`/`, which already shipped one real bug into this repo's CI (MPI-799 validation, fixed in
`77acac7`).

An index also fixes the human-facing gap — today the repo is a folder of JSON with no
browsable page.

**Verify:** merge a probe PR, then fetch `index.json` anonymously from
raw.githubusercontent and confirm it holds every entry `flows/` does.

## Phase 2 — fetch and cache

One request for `index.json`, cached to disk, rendered from cache when the fetch fails.

- **A failed fetch must never break the Library.** No network, no GitHub, an outage, a
  proxy: the Library renders exactly as it does today, from the cache or from nothing.
- Node `fetch` dies at 300 s waiting for headers whatever `AbortSignal` says
  (`UND_ERR_HEADERS_TIMEOUT`), so set a short explicit timeout rather than relying on it.
- Refresh on the Library's existing Refresh control, not on a timer.

**Verify:** with the network off, the Library opens, lists built-ins and installed packages,
and shows no error. With it on, the catalogue appears.

## Phase 3 — the catalogue tiles

Render uninstalled catalogue entries into MPI-831's Add-on Flows section.

- **A new tile state:** in the catalogue, not installed. Distinct from MPI-831's paid-but-
  unbought state and from `Get models`. Neither existing chip tells the truth here.
- **An entry already installed must not appear twice.** Key on the package id, the same way
  MPI-831 hides a paid tile once its package lands.
- **Previews work for both lanes.** A free entry names a filename inside its package, and
  free packages are committed to the registry, so `raw.githubusercontent.com/.../flows/<id>/
  <preview>` serves it. A paid entry already carries an absolute https URL.
- **Text is already safe.** `check-entry.mjs` enforces the no-markup rule at merge, so no
  catalogue string can carry `<`, `>`, `"` or a backtick into the renderer. Do not re-escape
  and do not assume it — the rule is enforced there, and this card depends on it.
- **`minAppVersion` above this build:** list it, disabled, with the reason named. MPI-532's
  law — silence reads as a broken app.

**Verify:** a real entry from the live registry appears as a tile, opens a drawer, and its
preview renders. Install it and the catalogue tile is replaced by the real Flow, not joined
by it.

## Phase 4 — how a user gets it

Free lane: the package lives in the registry, so the app can fetch and install it through
the existing `POST /user-flows/install` path. Paid lane: the entry's `download` field is a
purchase URL, so the button opens the browser, exactly as MPI-831's Get-it button does.

**Decide before building:** whether a free-lane install happens in-app on one click, or the
app opens the registry page and the user downloads and drops the folder. One click is the
better experience and the bigger surface — it means the app installs code-free content it
did not validate locally until after download. The validator already runs on install
(`services/userFlows.js` stages into `user_flows/.staging/` and only then renames), so the
guard exists; the question is whether to lean on it.

**Verify:** whichever route is chosen, a Flow discovered in the Library ends up installed
and runnable without the user ever seeing a file manager.

## Not in scope

- A rendered catalogue website. The point of this card is that the app is the surface.
- Ratings, comments, download counts, search across the catalogue. The Library already has
  search and filters; they apply to whatever is listed.
- Any payment rail. MPI-560 phase 6 is explicit: advertising only, never a payment rail.

## Ownership

```
js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js
js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.css
js/services/userFlowService.js
routes/userFlows.js
services/userFlows.js
tests/user-flows.test.cjs
tests/desktop/flow-packages.spec.js
docs/flow-packages.md
```

Plus, in the **registry repo** (`MadPonyInteractive/cubric-flows-registry`, public):
`.github/workflows/` and whatever generates `index.json`.

Overlaps MPI-831 on `MpiFlowLibrary.js` and `.css`. Sequence them or split by function;
do not run both as parallel workers.
