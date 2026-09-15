# MPI-593 Validation

## Step 1: the skill split (2026-09-15, PASSED, auto)

`.claude/skills/cubric-vision/SKILL.md` (721 lines) is now a router plus five on-demand files:

| File | Lines |
|---|---|
| `SKILL.md` (router) | 108 |
| `projects.md` | 116 |
| `on-disk-format.md` | 185 |
| `generating.md` | 135 |
| `flows.md` | 124 |
| `engine-and-remote.md` | 78 |

Sections were cut by line range from `git show HEAD:.claude/skills/cubric-vision/SKILL.md`,
so they moved verbatim. What was rewritten on purpose:
- a two-line header on each new file;
- the router's "Where everything else lives" table;
- § Connector (below);
- six cross-references the split broke, plus three line wraps those fixes left.

**Check:** `python <session scratchpad>/verify_split.py` → `PASS: budget, selector, no text
lost, links, sections, anchors, connector`. The script was not kept, so what it asserts is
written out here:
1. Every file ≤200 lines.
2. Frontmatter lines 1–6 identical to HEAD, so the `description:` selector did not move.
3. Every non-blank HEAD line is present in the six files (multiset count). The only
   exceptions are the rewritten lines, listed by HEAD line number: 49–50, 251–252, 535–536,
   540, 547, 606, and Connector 375–399.
4. Every relative `](x.md)` link resolves.
5. Each cross-referenced section exists in the file named: § Recovering the prompt behind an
   image, § Creating a project, then generating into it, § Dispatching a generation.
6. Both outside anchors now name `cubric-vision/generating.md`:
   `.agents/mpi-kanban/project-knowledge-index.md:174` and
   `docs/playbooks/add-flow/06-preview-image.md:139`.
7. The stale Connector route row and "Capabilities present today" are gone.

**The check bites:** its first run FAILED on three lines. Those were two bugs in the check
itself: an off-by-one line number, and a removed Connector code fence consuming a moved
duplicate's count. Both were fixed and the check re-run. A check that failed for a real
discrepancy is not a check that always passes.

`validate_board.py .` → `Board validation passed.` The session's skill listing re-registered
`cubric-vision` with the description unchanged.

**§ Connector was stale, and is folded in here.** It advertised `POST /connector/enhance` and
the `prompt.enhance` / `system.memory.release` / `system.shutdown` capabilities. MPI-677
step 2 deleted all of them. `routes/connector.js:161-166` now answers
`{ generationSubmit }` only, and the file header lists the surviving routes. The router now
names the three agent routes (`capabilities`, `generate`, `open-project`) and says the two
`jobs` routes are the app window's own relay.

**Not checked:**
- No cold agent was asked to find something through the router.
- The app was not driven; nothing here is runtime.
- `CLAUDE.md:32` was left alone: it names the router path, which is unchanged.
