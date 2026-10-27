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

## Re-cut 2.1.3 (Fabio 2026-10-27, from his own test of the built v2.1.3)

v2.1.3 (55f8b45f4) passed the 1.5.0 gate but is NOT published. Fabio found three Cosmo/prompt issues and wants them in 2.1.3. Do NOT move the tag until he says (he keeps testing and may add more).

- [ ] Cosmo default = DeepSeek-V4-Flash-0731 with a visible RECOMMENDED flag on its row (services/llmEngines.mjs RECOMMENDED_REMOTE_MODELS.deepinfra: move `jobs: ['agent']` off MiMo-V2.6-Flash, table order is preference; tests agent-loop 1556/1575-1577, llm-connection 91). MiMo too slow (~2 min for one H3 prompt) and overloaded for the photographer tester's use. Users with no saved pick follow it automatically (_resolveModel); 0731 likely does not see pictures - say so in the note
- [x] ~~Fast Motion rule~~ REJECTED (Fabio 2026-10-27): the explosion clip WAS fast action (fire, smoke), and Cosmo left it off on the calm pre-scene, so the current rule works. No change
- [ ] Joining clips (Fabio 2026-10-27): asked for a pre-scene he will join to `ref2v_001`, Cosmo re-ran Singularity H3 ref2v (carried over from the last clip) instead of `minimax-h3` `i2v_ms` with an END frame, and did not invent the missing bridge (the cars crashing behind them so the clip lands on the next clip's opening frame). Guide fix in docs/agent/models/minimax-h3.md (+ wherever Cosmo picks a model per clip)
  - [x] Code + guide (uncommitted, lint + 3769 tests green): Joining rule in the system prompt (a named model does not carry to the next clip) -> new `docs/agent/joining-clips.md` (before / after / between, same family: H3 joins on `minimax-h3` `i2v_ms`, else LTX 2.3/Wan with a warning, make the missing calm start picture with one edit, invent the bridging event); media `frame: "last"` on Cosmo's and MCP's generate (connector `_frameOf`, ffmpeg `-sseof`; pulls MPI-1134's G4 forward); budgets raised with reasons; relay test proves the last frame
  - [~] Live check 2026-10-27, isolated app, DeepSeek-V4-Flash-0731: the in-between ask picked `minimax-h3` `i2v_ms`, start = clip A's last frame, end = clip B (did NOT open app:joining-clips; the rule + H3 guide line sufficed). No clip: the rig attached to Fabio's D:\CVTest engine, which reads ITS input folder, so the isolated app's staged pictures never reached it (describer empty -> CHILD_SAFETY refused). Rig artefact, not a product bug. Real generation check = Fabio in the re-cut build
- [ ] MPI-1316: changing the style drops a stale enhanced prompt (pulled from the LTX 2.5 umbrella into 2.1.3)
- [ ] Release-note line(s) for the above: Fabio approves the wording (releaseNotes.js edit breaks the approval hash)
- [ ] lint + npm test, push, then on Fabio's go: move tag v2.1.3, rebuild, re-download, redo the 1.5.0 gate + update-evidence.json, Fabio retests the 2.1.2 copy (re-extract it), Gate 2, publish
