| arm_seed | result | render s | MB | error |
|---|---|---|---|---|
| ship_1347001 | ok | 207 | 4.9 |  |
| v01_1347001 | ok | 207 | 4.7 |  |
| ship8_1347001 | ok | 198 | 4.6 |  |
| ship_1347002 | ok | 206 | 5.0 |  |
| v01_1347002 | ok | 185 | 4.9 |  |
| ship8_1347002 | ok | 206 | 4.7 |  |

## Findings (2026-10-29, judged on frames vs ref_087/ref_084; audio by loudness only, not listened)

- **Identity, the decider:** the shipped 8-step v1.0 holds the woman's sheet (black-to-pink bob with bangs) on both seeds, at 10 and at 8 steps. The 4-step v0.1 drifts her to longer, wavier dark hair with pink streaks: a different woman. The man holds on every arm.
- **Face hold on the dolly-out (corrected after Fabio's look):** the shipped LoRA has more detail close up but loses it faster as the camera pulls away; v0.1 holds detail at distance better. My first read ("all blur equally") was wrong.
- **Why clips swing between good and bad, from the graph:** Fast Motion OFF (`880 Input_Fast_Motion` = false -> mode 3, nodes 620/621 `floor(a/64)*32`) renders stage 1 at HALF size, 672x384, with the turbo LoRA (561 -> 537). Then the 3D latent upscaler 2x, then a 3-sigma refine (`600`: 0.90/0.63/0.32) on the BASE model with no LoRA (586 -> 523). At the wide end the couple's heads are ~10 px tall in stage 1, so their faces are decided there and the refine only sharpens what exists: detail at distance is a per-seed lottery. The shipped LoRA is the 768p distill run at 384p here, a plausible reason it degrades faster at distance (hypothesis, untested).
- **Next test:** one seed, Fast Motion ON (full-size stage 1), shipped vs v0.1.
- **Shipped at 8 steps vs 10:** picture close to the 10-step result, no real time saved (198/206 s vs 207/206 s). Seed 1347002 swapped the seating (man on the left): a seed effect, not damage.
- **Speed:** v0.1 185-207 s, no clear win.
- **Audio (integrated loudness, LUFS):** ship -19.9/-20.8, ship8 -20.5/-20.6, v01 -17.9/-20.0. All within a 3 LU band; voice quality needs Fabio's ears.
- **Verdict (open):** shipped keeps the woman's identity; v0.1 keeps detail at distance. Not settled until the Fast Motion ON run.
- **Fast Motion ON, seed 1347001 (fm_ship 284 s, fm_v01 219 s; -19.8 / -18.6 LUFS):** both LoRAs now hold BOTH sheets: v0.1 keeps the woman's black-to-pink bob with bangs, which it lost at half size, plus tattoos, the bag and white sneakers. Faces, tattoos and hands stay detailed at the end of the move on both; shipped a touch crisper, v0.1 23% faster. Caveat: with Fast Motion on, the dolly-out stops at a full-figure medium-wide (the couple fills a third of the frame at 7 s), never reaching the tiny-figures wide of the half-size runs, so "distance" here is shorter. One seed.
| fm_ship_1347001 | ok | 284 | 4.3 |  |
| fm_v01_1347001 | ok | 219 | 4.2 |  |
| fm_v10_1347001 | ok | 217 | 3.7 |  |
| fm_v11_1347001 | ok | 255 | 4.2 |  |

- **Fast Motion ON, lightx2v's other two ref2v 768p LoRAs, seed 1347001 (Fabio: the shipped one stays, it holds detail better):** all three hold both sheets. 4-step v1.0 at 8 steps (217 s, -18.2 LUFS) is the softest: the man's face goes soft at the medium shot and the couple blurs at the end, darker overall. 8-step v1.1 at 10 steps (255 s, -19.5 LUFS) matches the shipped v1.0 on detail, faces arguably a touch crisper at the medium shot; same steps, so its 29 s less is probably Pod variance, not a speed win. One seed, frames only, audio not listened.
- **Fabio: shipped v1.0 is better than v1.1.** Searched before any v1.1-at-8 run: nothing in the repo (docs, cards, research) ever tested ref2v v1.1 or the ref2v 4-step v1.0, at any step count. lightx2v published both on 2026-10-20; the shipped 8-step v1.0 was adopted on 2026-09-04 (MPI-687), before either existed. Closest prior data: this card's ship8 arm (shipped v1.0 at 8 steps, Fast Motion off) looked close to 10 steps and saved no time; `docs/models/h3/README.md` says 8-step distills run at 10-12.
| fm_v11s8_1347001 | ok | 247 | 4.3 |  |

- **Fast Motion ON, 8-step v1.1 at 8 steps, seed 1347001 (247 s, -19.2 LUFS; shipped 284 s, -19.8):** holds both sheets (bob, bangs, tattoos, white shorts, sneakers). Opens a little tighter and ends a little wider than the shipped clip. At the end of the move it is close to the shipped v1.0 at 10 steps; the man's face is a touch softer/smudgier on v1.1@8, the shipped one a touch cleaner. About 37 s faster on this run (2 fewer steps; Pod variance is ~30 s, so not proven). No reason found to replace the shipped LoRA. One seed, frames only, audio not listened.
| fl_ship_1347001 | ok | 186 | 5.6 |  |
