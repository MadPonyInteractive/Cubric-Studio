# MPI-973 - cubric.studio revamp for 2.0

## Current State

- Project mode: scalable-foundation.
- Repo: `C:\AI\Mpi\Cubric Studio (Website)`, static HTML on GitHub Pages (`CNAME`, `.nojekyll`),
  clean tree at `0df6b76`. No build step, no dependencies. Sibling rules:
  `.claude/rules/sibling-repos.md` (absolute paths, `git -C`).
- Today: `index.html` is the old family-hub page (Prompt/Audio/Video rows, gated Patreon tiers);
  `vision/index.html` holds the real product copy, the newer Patreon block (all tiers equal) and
  the GitHub-release download resolver (`scripts/vision.js`). `privacy/` uses `styles/product.css`.
- Inbound links found in the family repos: `/privacy/` (14, incl. the `.mcpb` manifest) and
  `/vision/` (1). The `/flows/*` redirects were rejected 2026-09-27; nothing else links in.
- `.mcpb`: `cubric-studio-agents` release `mcpb-v0.2.0` (marked Latest), asset
  `cubric-studio.mcpb`; the README already links `releases/latest/download/cubric-studio.mcpb`.
- 2.0 downloads will be `CubricStudio-<platform>-<ver>` (v1.5.0 is `CubricVision-*`); the resolver
  matches on the platform substring, so it covers both.
- Structure and copy draft 1: `research/copy.md`.
- **2026-09-29, built (uncommitted, local preview only).** Fabio: "use the impeccable skill to
  redesign the main page", "start by doing what we can". Direction came from PRODUCT.md (landing
  hero = all five on a lit stage, Studio centre; mid-tone warm dusk; mono + Russo One wordmark).
  New `index.html`, `styles/landing.css`, `scripts/landing.js`; crew clips in `assets/crew/`
  (idle/greet/happy per member, alpha VP9 WebM, two `<video>`s per member traded on first frame,
  Safari no-alpha falls back to the stills); showcase videos re-encoded into `assets/media/`
  (~3 MB each, were 14-30 MB); share image `assets/og.png`. `/vision/ /prompt/ /audio/ /video/`
  are noindex redirects to `/` that keep the hash. `sitemap.xml`, `llms.txt` rewritten. 69
  unreferenced assets and `scripts/vision.js` deleted (unstaged; git history keeps them).
- **Fabio signed off look and copy 2026-09-29 ("it looks good"), and said not to go online yet.**
  `funding.json` updated to his pick (guid kept). His screenshots are for the docs site, except
  the agent-at-work shot, which he asked for in the Agent section (added, Cosmo on its edge).
- **Next:** wait for the 2.0 cut. Before publish: the privacy sentence (below), then commit the
  Website repo by pathspec and push on his yes. Everything is UNCOMMITTED on purpose, because a
  peer pushing the Website repo would publish a local commit. Preview: any static server on the
  Website folder (this session used 127.0.0.1:8743 with `allow_reuse_address` off, see
  windows-shell-traps).
- **The GitHub repo is now `MadPonyInteractive/Cubric-Studio`** (renamed; old URLs redirect).
  Site links and the release API use the new name.
- **`privacy/index.html` is held by MPI-965 (session 4a2a917e).** Its "This website" paragraph
  says "The Cubric Vision page asks GitHub ... for the latest release number"; that page is now a
  redirect and the HOME page asks. One sentence to fix before publish, once the claim is released.

## Decisions (Fabio's)

1. Look and feel. A: rebuild on the current site's style (dark stage, JetBrains Mono + Russo One,
   cream Studio accent). B: A's type and tokens, with the app's own first screen as the hero (the
   crew on a lit stage, their animated clips). C: a fresh direction from
   `CubricStudio_Redesign/mockups`. My pick: B.
2. Media. 2.0 needs new screen recordings: agent panel, Flow Library, cloud model picker showing a
   price, Settings > Connect an agent. My pick: I capture the local ones from my own isolated app
   instance; the agent and cloud shots need a real key and a few cents, so Fabio records those or
   okays the spend.
3. Launch timing. My pick: live the day 2.0 is released (downloads resolve to 2.0; the MCP section
   needs 2.0). Build and preview locally until then.
4. The crew section (section 3 of the copy). My pick: in.

## Implementation

- [ ] Get Fabio's sign-off on `research/copy.md` and the four decisions; fold his edits into the copy.
- [ ] Build the page: rewrite `index.html` and `styles/landing.css` (tokens stay in `tokens.css`,
  accents from `landing.css:30-34`), port the download resolver into `scripts/landing.js`, add the
  `.mcpb` button (`releases/latest/download/cubric-studio.mcpb`), media into `assets/`. Turn
  `vision/`, `prompt/`, `audio/`, `video/` into noindex redirects to `/` (the `l/fr/` pattern).
  Rewrite `sitemap.xml`, `llms.txt`, meta/OG/JSON-LD. One sentence in `privacy/index.html`
  (the "Cubric Vision page" line). Remove assets nothing references.
  **Verify:** automated checks below pass; preview in the browser pane at desktop and 375 px.
- [ ] Fabio's eye test on the local preview; iterate until he signs off look and copy.
- [ ] Publish: push the Website repo on Fabio's explicit yes, on 2.0 release day. Check the live
  site: `/`, `/privacy/`, the four redirects, the `.mcpb` and platform downloads.

## Completed

- [x] Research and structure/copy draft 1 (2026-09-29).
- [x] Build: page, redirects, sitemap, llms.txt, assets, dead-asset sweep (2026-09-29). Automated
  checks and headless crew test pass (validation.md).

- [x] Fabio signed off look and copy; funding.json; agent screenshot (the fox, 12:02 shot).
- [x] Snapshot on local branch `site-2.0` (`8c5a485a9`), nothing pushed. Claim audit: 26 of 27
  claims proven; the macOS "not tested" caveat moved to the release card.

## Remaining Work

- None on this card. **Publishing moved to MPI-983** (Fabio, 2026-09-29: "make a card so that
  when I want to release the website, I can just ask an agent"), with the privacy edits, the
  macOS check and the docs site.

## Plan Drift

- 2026-09-29: Fabio skipped the separate copy/look sign-off and asked for the build straight away
  with the impeccable skill; the look followed PRODUCT.md's stage hero (my pick B). The crew
  section merged into "What it does" (one headline, not two stacked). The proof strip became a
  status-bar row at the hero's foot (brand ban on hero-metric blocks).

## Verification

**Verify mode:** user-ux

Automated, before the eye test:
- `/privacy/` unchanged apart from the one sentence: `git -C <site> diff privacy/` shows only it.
- Every internal `href`/`src` resolves to a file; the four redirects point at `/`.
- No em or en dashes in shipped copy: `grep -rn $'\u2014\|\u2013' index.html privacy vision prompt audio video llms.txt` is empty.
- No `CubricVision-` asset names; no prices; the cloud list matches models.js non-devOnly DeepInfra entries.
- `.mcpb` link: `curl -sIL` ends 200 on `cubric-studio.mcpb`.
- Browser pane: no console errors; no horizontal scroll at 375 px; download buttons resolve to
  release assets.

Then Fabio looks at the local preview (desktop and phone width) and signs off look and copy.
After publish: the same link checks against https://cubric.studio.

## Preservation Notes

- `docs/releases/github-release-checklist.md` § Scope Guard forbids "assistant" claims in release
  copy; 2.0's headline is the in-app agent. Stale rule, logged in `brief.md` § Noticed.
- `funding.json` may still describe Cubric Vision; check at build, fold in if it does.
- Memory: `project_website_revamp_studio_only` gets a pointer to this card when it closes.
