# MPI-973 — cubric.studio revamp for 2.0

**A 2.0 blocker** (MPI-595, Fabio 2026-09-29): the website, the docs website and the in-app
agent are the last things between master and the cut. The docs website is separate work
(Fabio has an agent on it); this card is the marketing site only.

Repo: `C:\AI\Mpi\Cubric Studio (Website)` (static HTML: `index.html`, `styles/`, `privacy/`,
`sitemap.xml`, `llms.txt`). It has no board of its own; this card lives here.

## What Fabio asked for

- **A full revamp, not a polish.** Cubric Studio is the only product: the Prompt, Audio and
  Video pages (`prompt/`, `audio/`, `video/`) go (decided 2026-09-25). Do not make cosmetic
  fixes to the current site first.
- **The landing page shows what the app actually is.**
- **Its own section for each of:**
  1. **Connect your AI agent (MCP)**, with a **download button for the Claude Desktop
     extension**. The `.mcpb` has ONE home: the `MadPonyInteractive/cubric-studio-agents`
     releases (latest `mcpb-v0.2.0`, 2026-09-26). The app release does NOT attach it
     (Fabio 2026-09-29). Link the latest release asset; do not host a copy.
  2. **The in-app agent**, a big 2.0 feature.
  3. **The new paid cloud models**, which run on the user's OWN DeepInfra key. The user pays
     DeepInfra directly; there are no Cubric credits. Name models from
     `js/data/modelConstants/models.js` entries with `provider: 'deepinfra'` that are NOT
     `devOnly`; never quote a price the app does not show.

## Must survive the revamp

- **`https://cubric.studio/privacy/` at the same URL**, with the footer link and the
  `sitemap.xml` entry. The Claude Desktop extension manifest points there; a broken link
  gets the directory listing rejected. The policy must stay TRUE: it lists every outbound
  service, so a new section that implies a new service means updating it in the same job.
- Public contact is `contact@madponyinteractive.com`, never a personal address.
- No em dashes in copy Fabio signs.
- Brand colours come from `DESIGN.md` § "The accent family" (mirrors the website's own
  `styles/landing.css:30-34`, which wins). Never sample a colour off the mascot art.
- Downloads point at the GitHub release assets. From 2.0 the assets are `CubricStudio-*`
  only; no legacy `CubricVision-*` names (`f74855990`).
- Claim boundary: `docs/releases/github-release-checklist.md` (no unshipped-roadmap claims).
  The feature list to draw on is `docs/releases/UNRELEASED.md` § What's new.

## How to run it

Look and feel is Fabio's call: plan the page structure and copy, show him before building,
and stop for his eye on the result. Copy he signs goes to him for review before it is
published (it is public).

## Done when

The revamped site is live on cubric.studio with the three sections and the `.mcpb` download
working, `/privacy/` unchanged in address, and Fabio has signed off the look and the copy.

## Noticed

- 2026-09-29: `docs/releases/github-release-checklist.md` § Scope Guard still says release copy
  must not claim "assistant" features; 2.0's headline is the in-app agent, so the rule is stale
  and will block the 2.0 release notes as written.
