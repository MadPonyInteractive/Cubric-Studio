# MPI-1286 checklist: 2.1.3

Storyboard ships in 2.1.3 in place of Multi-angle (Fabio, 2026-10-27).

- [x] Cosmo and MCP run the Storyboard Flow: the app plans when no plan is sent, then the board lands as one stack
- [x] Live ask in words, from Cosmo and from an outside agent over MCP: both PASS 2026-10-27 (validation.md), ~$0.01 DeepInfra
- [x] `docs/agent/flows.md` paragraph + MCP calling note in `.claude/skills/cubric-vision-flows/SKILL.md`
- [x] Storyboard `devOnly` off; Multi-angle stays dev-gated
- [x] Held Storyboard note folded into UNRELEASED § New, roster line kept
- [x] Changelog true to every user-visible change since v2.1.2 (cards with feat/fix commits missing from UNRELEASED)
- [x] lint + npm test green (3760 tests, 0 failed), pushed
- [ ] Version bump + release: bump pushed a9b4b778a (approved); NEXT tag v2.1.3 on Fabio's go, artifacts, install test, Gate 2, publish
