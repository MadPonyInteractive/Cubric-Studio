# MPI-1164 Checklist

- [x] Camera angle/framing/move/how someone moves = reference op media (0e46aeb80)
- [x] Look (grain/noise, light, colour cast/grade) on any image or video job = written into the prompt as words, not media (Fabio 2026-10-17: camera only as media); prompt budget 11,540
- [ ] Bench case for the look clause (needs spend yes)
- [ ] Fabio eye test in app
- Bench 2026-10-17 (DeepSeek V4 Flash, $0.068): named look quality in prompt + photo never sent/edited = every run; "only that quality" fails (light 0/6 carries grain, grain 2/3 carries the cast, grade 3/4). Tighter wording tried, no effect, reverted. Flips not run. Bench look fixture ignores the question asked, so may overstate the leak.
- Look leak follow-up: MPI-1134 Phase 5b "Vision chat model" (asked Video frame limit solutions to add it, 2026-10-17; they hold that plan uncommitted)
- [x] Fabio eye test 2026-10-17 (live app): picture of a woman in bed + a reference clip for the camera move -> MiniMax H3 ref2va with the clip as reference, neither picture edited; Fabio: "the camera movement is correct" (from the latents).
