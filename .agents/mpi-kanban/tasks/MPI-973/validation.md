# MPI-973 Validation

Verify mode: user-ux. Evidence lands here as each check runs.

## 2026-09-29 - build, automated checks (local, uncommitted)

- Site checks (script in session scratchpad, logic per plan § Verification): every local
  href/src/poster resolves, every in-page anchor has a target, all runtime crew clips exist; no
  em/en dash in `index.html`, the four redirect pages or `llms.txt`; the cloud list equals
  models.js `provider: 'deepinfra'` minus `devOnly` (14 names); no price in the cloud section; no
  `CubricVision-` link; `.mcpb` latest-release URL answers 200 (4143 bytes). Result: ALL CHECKS
  PASSED.
- Headless Chromium (Playwright 1.59.1) against the local server: top load 5/5 crew clips live
  with alpha; hover wakes Cosmo; opened at `/#download` then scrolled up, 5/5 live (this failed
  first: Chromium pauses an off-screen muted video; fixed by starting the crew on first sight and
  resuming the clip still loading); reduced motion loads 0 videos; 375 px scrollWidth 375 (failed
  first on the install-command `pre`, fixed with `minmax(0, 1fr)` columns); no page errors.
- Browser pane: `/vision/#download` lands on `/#download`; no console errors; download buttons
  resolve to the latest release's full builds with sizes (v1.5.0 today).
- impeccable detector over `index.html` + `landing.css`: no findings.
- Contrast: body inks 7.5:1 and up; small print moved off `--ink-3` (3.8:1 on `--surface-bar`)
  to `--ink-fine` (5.15:1).

## 2026-09-29 - Fabio's eye test

- Fabio, on the hero + full-page screenshots and the local preview: "it looks good". Look and
  copy signed off. "Don't make it go online just yet."
- `funding.json` brought in line (Fabio: "go with your pick"): project name Cubric Studio,
  description without the app family, `webpageUrl` `/`, `repositoryUrl` the renamed repo, guid
  `cubric-vision` KEPT (it is a registered funding manifest). Valid JSON, no dashes.
- Screenshots in `C:\Users\Fabio\Pictures\Screenshots` (25, the docs-site set) reviewed: Fabio's
  lean is docs-only. The one candidate for the site is `Screenshot 2026-09-29 111415.png` (agent
  panel mid-conversation beside the finished clip) for the Agent section.
- Fabio: "yeah add the agent screenshot". Added as `assets/media/agent-at-work{,-1280}.webp`
  (112 KB / 61 KB) under the Agent section's text, full width, Cosmo's clip standing on its top
  edge; the invented "You: make a poster" bubble removed. Site checks, headless crew test and the
  detector re-ran clean; 1440 and 375 px captured, no overflow.
- Fabio swapped the shot for a better one (`Screenshot 2026-09-29 120244.png`: the agent runs
  the Extend Video Flow, fox drives off in a red convertible). Same files replaced (104 KB /
  59 KB), alt text and caption rewritten to match; site checks re-ran clean.

## Open before close

- Privacy sentence (file held by MPI-965).
- Commit (Website repo, pathspec only) and publish on 2.0 day with Fabio's yes; recheck live.
  Left UNCOMMITTED on purpose: a peer pushing the Website repo would publish a local commit.
