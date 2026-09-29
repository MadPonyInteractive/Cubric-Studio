# MPI-983 Plan - publish the 2.0 websites

## Current State

- Blocked on the 2.0 GitHub release (MPI-595). Nothing to do before it is published.
- Marketing site: finished and signed off (MPI-973). Snapshot on local branch `site-2.0`
  (`8c5a485a9`, parent `0df6b7652` = `main` on 2026-09-29), and the same files uncommitted in the
  working tree on `main`. Blobs verified identical on 2026-09-29.
- Docs site: branch `docs-2.0` in the Docs repo, owned by the docs session (its card MPI-19).
  Read that card's latest handoff before touching it; it may name its own release steps.
- Project mode: scalable-foundation.

## Implementation

- [ ] **Pre-flight.** `gh release view --repo MadPonyInteractive/Cubric-Studio --json tagName,assets`
  shows the 2.0 tag with full `CubricStudio-{windows-x64,macos-arm64,linux-x64}` assets (not only
  `-update-`). **Verify:** the three names are there.
- [ ] **macOS claim (claim auditor, 2026-09-29).** The site says "Windows, macOS and Linux" and
  "macOS 14 or later on Apple silicon" plainly (index.html hero fine print, FAQ "Which systems",
  its JSON-LD twin, download fine print; llms.txt line 3), while `docs/releases/UNRELEASED.md`
  Known issues carried "Platform support, macOS: Not tested on this version". Read the PUBLISHED
  2.0 release body: if that line is still there, add "(not yet tested on 2.0)" after the macOS
  part of the FAQ answer, its JSON-LD twin and the download fine print. Tested by then: change
  nothing. **Verify:** site copy and release body agree.
- [ ] **Privacy page, two edits** (`privacy/index.html`, claim it first; MPI-965 held it on
  2026-09-29). (1) Top nav `<a href="../vision/">Vision</a>`: the Vision page is now a redirect,
  so drop that link (the wordmark already goes home). (2) "This website" paragraph: "The Cubric
  Vision page asks GitHub, from your browser, for the latest release number." becomes "The home
  page asks GitHub, from your browser, for the latest release, so the download buttons point at
  the right files." Keep `/privacy/` at the same address; no other change unless a new outbound
  service shipped in 2.0 (then the page must list it). **Verify:** `git diff privacy/` shows only
  those two edits; no em dash.
- [ ] **Commit the marketing site on `main`** (Website repo, by pathspec, never `-A`/`.`). If the
  working tree still holds the revamp (normal case): `git add -A -- index.html styles/landing.css
  scripts assets vision prompt audio video sitemap.xml llms.txt funding.json privacy/index.html`
  then `git commit -m ... -- <same paths>`. If the working tree was lost: `git merge site-2.0`,
  then commit the privacy edits. Then run `research/serve_site.py` (background),
  `research/check_site.py` and `node research/crew_test.cjs` from `C:\AI\Mpi\Cubric-Vision`.
  **Verify:** ALL CHECKS PASSED, crew test exit 0.
- [ ] **Publish the marketing site:** `git -C "C:/AI/Mpi/Cubric Studio (Website)" push origin main`
  (Fabio's "release the websites" is the yes). Wait for Pages:
  `gh api repos/MadPonyInteractive/Cubric-Studio-Website/pages/builds/latest --jq .status` =
  `built`. **Verify live:** `https://cubric.studio/` 200 and shows the crew; `/privacy/` 200;
  `/vision/` serves the redirect page; the hero and download buttons resolve to the 2.0 assets
  (open the page, read the buttons' `href`); `/assets/og.png` 200.
- [ ] **Docs site.** Ask Fabio once: "Is `docs-2.0` the docs build you want live?" (rule 6). On
  yes: in the Docs repo, merge `docs-2.0` into `main` (fast-forward if possible), push `main`,
  wait for Pages (`.../Cubric-Studio-Docs/pages/builds/latest`). Update the docs repo's own card
  MPI-19 per its board. **Verify live:** `https://docs.cubric.studio/` 200 and a few section pages
  (agent, cloud-models, flows) 200.
- [ ] **Tidy:** delete local branch `site-2.0` once `main` carries it
  (`git branch -d site-2.0`, which refuses if unmerged). Close MPI-983 with the live checks in
  `validation.md`.

## Completed

- [ ] Nothing yet.

## Remaining Work

- Everything above, after the 2.0 release.

## Plan Drift

- None yet.

## Verification

**Verify mode:** auto

Every step carries its own check. The live checks after each push are the evidence that closes
the card; Fabio already signed off the marketing site's look and copy (MPI-973), and the docs
site's sign-off belongs to its own board.

## Preservation Notes

- Memory `project_website_revamp_studio_only` is superseded once this ships (the revamp is live);
  update it at close.
- `docs/releases/github-release-checklist.md` § Scope Guard forbids "assistant" claims in
  release copy; 2.0's headline is the agent (MPI-973 brief § Noticed).
