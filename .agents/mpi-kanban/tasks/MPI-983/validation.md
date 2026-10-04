# MPI-983 validation

2026-10-04, after v2.0.0 was published (21:20 UTC).

## Pre-flight

- `gh release view v2.0.0`: not draft, not prerelease, full assets
  `CubricStudio-{windows-x64,macos-arm64}-v2.0.0.zip` and `CubricStudio-linux-x64-v2.0.0.tar.gz`.
- Release body still says "macOS - Not tested on this version", so the site says
  "(not yet tested on 2.0)" after the macOS part of the FAQ answer, its JSON-LD twin and the
  download fine print.

## Docs site

Already live before this session: the docs session pushed `main` = f97428e and closed MPI-19 on
the Docs board. Pages build `built` at f97428e. `/installation/` 200, `/agent/` 200 and carries
`id="connect-an-agent"`.

## Marketing site

- Website repo commit `0dd429b` on `main`: the MPI-973 revamp (working tree matched `site-2.0`
  for every text file), plus FLUX.2 Klein 9B (Cloud) added to the cloud list (in the v2.0.0 tag's
  `models.js`, MPI-918, landed after the sign-off), the macOS note, and the two privacy edits
  (Vision nav link dropped; release-check sentence reworded).
- `check_site.py`: 15 cloud models match, ALL CHECKS PASSED. `crew_test.cjs`: 5/5 live, hover,
  reduced motion 0 videos, 375 px scrollWidth 375, no page errors, exit 0. No em dash in
  `index.html` or `privacy/index.html`.
- Pushed `afb9258..0dd429b`. Pages build `built` at 0dd429b.
- Live: `/` 200, `/privacy/` 200 (new sentence present), `/vision/` 200, `/assets/og.png` 200.
  In a browser, every download button resolves to the v2.0.0 full build (Windows 531 MB, macOS
  483 MB, Linux 511 MB), never an update bundle; `.mcpb` button points at
  `cubric-studio-agents` latest `cubric-studio.mcpb`; "Install guide" and "Full setup guide"
  land on live docs pages.

## Left as is

Local branch `site-2.0` kept: `main` carries its content but not its commit, so
`git branch -d` refuses it. Safe to delete with `-D` whenever.
