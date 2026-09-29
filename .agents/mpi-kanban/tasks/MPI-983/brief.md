# MPI-983 - Publish both websites the moment 2.0 is released

Fabio, 2026-09-29: when 2.0 is out he wants to say "release the websites" and have an agent do
it. Both sites are finished work held back on purpose, because their copy and download buttons
describe 2.0: going live before the release would point visitors at 1.5.0 under a "Get Cubric
Studio 2.0" heading, and the MCP section needs 2.0 to work.

**When:** right after the 2.0 GitHub release is PUBLISHED (its `CubricStudio-*` assets are up),
the same hour, before anything is announced. Not before: the download buttons read the latest
release. Wired into the cut as a line in MPI-595 § Gate D.

## The two sites

| | Marketing site | Docs site |
|---|---|---|
| Local repo | `C:\AI\Mpi\Cubric Studio (Website)` | `C:\AI\Mpi\Cubric Studio (Docs)` |
| GitHub | `MadPonyInteractive/Cubric-Studio-Website` (private) | `MadPonyInteractive/Cubric-Studio-Docs` (private) |
| Serves | GitHub Pages from `main`, `cubric.studio` | GitHub Pages from `main`, `docs.cubric.studio` |
| The 2.0 work | local branch `site-2.0` (MPI-973, signed off by Fabio 2026-09-29), ALSO sitting uncommitted in the working tree on `main` | branch `docs-2.0`, owned by the docs session and its own board (`.agents/mpi-kanban` in that repo, card MPI-19); release steps in that card's `release.md` |
| Push rule | pushing `main` publishes; do it only on Fabio's word | **hard no-push rule** (`.claude/rules/sibling-repos.md` rule 6): Fabio must confirm `docs-2.0` is the intended deploy, in the same conversation |

"Release the websites" from Fabio is the yes for the marketing site. The docs site still needs
its explicit confirmation line (rule 6), asked once.

## Must hold after release

- `https://cubric.studio/privacy/` at the same address, and TRUE (it lists every outbound
  service; the Claude Desktop extension manifest links it).
- Downloads resolve to the 2.0 full builds, never an `update` bundle.
- `.mcpb` button: `cubric-studio-agents` latest release asset `cubric-studio.mcpb`.
- No em dashes in copy Fabio signs. Public contact is `contact@madponyinteractive.com`.

## Tools

`research/` holds the checks MPI-973 used: `serve_site.py` (static server on 127.0.0.1:8743 with
`allow_reuse_address` off), `check_site.py` (links, dashes, cloud list vs models.js, `.mcpb`),
`crew_test.cjs` (headless Playwright: mascot clips start, reduced motion, 375 px overflow). Run
from `C:\AI\Mpi\Cubric-Vision` (Playwright is in its `node_modules`). A hidden browser pane
plays no video, so the crew check must be headless.
