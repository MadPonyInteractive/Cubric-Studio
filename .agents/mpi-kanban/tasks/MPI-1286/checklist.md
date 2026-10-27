# MPI-1286 checklist: 2.1.3

Storyboard ships in 2.1.3 in place of Multi-angle (Fabio, 2026-10-27).

**REVERSED later 2026-10-27 (Fabio, Storyboard Improvements 5): Storyboard is OUT of 2.1.3 and dev-gated again** -
character sheets in one panel draw extra copies (MPI-1309, MPI-1313). `devOnly: true` is back, both Storyboard
bullets and the headline mention are gone from `docs/releases/2026-10-27-v2.1.3.md` and `releaseNotes.js`, and
`docs/agent/flows.md` + the cubric-vision-flows skill say source runs only. 2.1.3 is no longer held by it.

- [x] Cosmo and MCP run the Storyboard Flow: the app plans when no plan is sent, then the board lands as one stack
- [x] Live ask in words, from Cosmo and from an outside agent over MCP: both PASS 2026-10-27 (validation.md), ~$0.01 DeepInfra
- [x] `docs/agent/flows.md` paragraph + MCP calling note in `.claude/skills/cubric-vision-flows/SKILL.md`
- [x] Storyboard `devOnly` off; Multi-angle stays dev-gated
- [x] Held Storyboard note folded into UNRELEASED § New, roster line kept
- [x] Changelog true to every user-visible change since v2.1.2 (cards with feat/fix commits missing from UNRELEASED)
- [x] lint + npm test green (3760 tests, 0 failed), pushed
- [ ] Version bump + release: bump pushed a9b4b778a (approved); NEXT tag v2.1.3 on Fabio's go, artifacts, install test, Gate 2, publish
