# GIF delivery manifest

> **Moved here from MadPony-Identity on 2026-09-20.** That repo made the artwork; where it goes in the app is this repo's business. The roll records it links to (prompts, seeds, what failed and why) stayed behind.

The 103 finished GIFs live in their own Vision project,
`C:\Users\Fabio\Documents\Cubric Vision\Projects\Cubric Studio GIFs\`, copied there by Fabio on 2026-09-20.
**They are still single-copy, and a git backup was tried and rejected (2026-09-21).** Committing all 103 into
`MadPony-Identity` was 303 MB and Fabio turned it down; the commit was reverted and the copies deleted. Two things
came out of that and are worth not rediscovering:

- **The 317 MB is real, not a bad export.** Dithering is not the cause — re-encoding with dither on and off both give
  3.94 MB for a 768x768 51-frame clip. These frames are an AI video model's *renders* of vector art, so 78% of opaque
  2x2 pixel blocks are non-uniform: LZW has almost no runs to work with and the palette fills with near-duplicate
  shades. Quantising to 128 colours drops that clip to 1.16 MB with no visible change at draw size, which is the same
  reason the staged WebM set is only 13.7 MB.
- **These GIFs are a middle step, not masters** (see "Two things the copy did not carry" below). The originals behind
  them are the video cards in `Cubric Studio Mascots` — 2.8 GB, 8,373 files, also on one machine. Backing up the GIFs
  would protect the least valuable link. If a re-derivable full-resolution master is ever wanted, alpha WebM at native
  768 measures 0.505 MB per clip at crf 18, about 52 MB for all 103.

**This file exists because the conversion lost the names.** A GIF card is called `gif_NNN` and its file on disk is
`gif_<hash>.gif`; neither says which clip it came from or what it is for. The table below is that link. For **where
each one goes in the app** — the trigger, the surface, the rules about queueing and transitions — `mascot-placement.md` is
still the authority; this is only the join between a file on disk and a row in its clip index.

## How they were made

- 10 fps, original size, loop forever, from the clip of the same name in the `Cubric Studio Mascots` project.
- The 84 mascot GIFs are **background-free**: BiRefNet, with `adjust {"grow": -1}` for a 1px shrink. Verified 2026-09-20:
  every one has a transparent corner pixel.
- The 19 transition GIFs are **opaque on pure black and must stay that way**. They composite with CSS screen blending,
  which is what preserves their soft smoke edges; a mask would harden them. Verified opaque.
- GIF alpha is 1-bit. That costs nothing on flat vector art with thick outlines, and is why the transitions were never
  cut out.

## Two things the copy did not carry

- **The marks are gone.** In `Cubric Studio Mascots` these cards are still marked square (cut-out) and triangle
  (transition); in `Cubric Studio GIFs` every card reads `favourite: false`.
- **Only the selected entry came across.** Each card in the GIFs project holds ONE entry, the finished one. The opaque
  pre-cut GIF and the original video card both stay behind in `Cubric Studio Mascots`, which is where to go to redo one.

**Re-cut in place (2026-09-25).** Fabio cleaned leftover background out of `gif_011`, `gif_012` and `gif_013` inside the
GIFs project and marked each with the dot (`favourite: "dot"`). A re-cut adds a history entry with a NEW file, so the
map below points at the selected entry's file, and the old one stays in `Media/`. To re-point after a re-cut: the card's
`history[selectedIndex]` id -> `Media/.meta/<id>.json` `filePath`, then `stage-mascot-clips.mjs --only <slug>`.

## Gaps: three Studio slots have no GIF

| Slot | Clip | What happened |
|---|---|---|
| Studio, Happy (head pop) | `i2v_015` | GIF card `gif_035` archived, not delivered |
| Studio, Failed | `i2v_016` | GIF card `gif_036` archived, not delivered |
| Studio, landing no projects | `i2v_042` | GIF card `gif_062` deleted outright |

All three are Studio, which is the mascot that is on screen most (rule 8: in agent mode it never leaves), and
**Failed is a state with no substitute**. These need re-rolling or re-cutting before the set is complete.

## Spares: delivered, but not a slot in the clip index

`ref2v_001`, `i2v_062`, `i2v_063`, `i2v_066` (the first gallery peeks, superseded by peek 2), and `t2v_016`,
`t2v_038`, `t2v_043`, `t2v_046` (transition rolls beyond the 15 picks). They are fine files, just not assigned;
`t2v_046` is recorded in `mascot-transitions.md` as a clean alternate to `t2v_045`.

## Staged into the app (MPI-777 Phase 1, 2026-09-21)

95 of the 103 are staged as `assets/mascot/{key}/{state}.webm` — VP9 with alpha, **13.7 MB for the
whole set**. The 8 spares above are not staged; they are covered by the backup. The stills
(`{key}/{idle,greet,happy}.webp`) stay as the reduced-motion and first-paint fallback.

`scripts/stage-mascot-clips.mjs` rebuilds them from this table, so the state names below are
derived from the "What it is" column and not kept anywhere else. `--verify` re-checks the result;
`--dry-run` prints the plan without encoding.

State names: `idle-1..3`, `greet-1` (wave) / `greet-2` (the character's own), `happy-1` (hop) /
`happy-2` (head pop), `failed`, `cancelled`, `heads-up`, `no-results`, `peek`, `getting-ready`,
`working`, `transition-smoke` / `transition-explosion` / `transition-third`. Studio also has
`engine-starting`, `update-ready`, `agent-listening`, `agent-thinking`, `agent-answer-ready`, the
four `connecting-*` band loops and `connected`. Prompt's and Audio's first gallery peek is parked
as `peek-superseded`.

Three things here were measured rather than assumed, and each would be easy to undo by accident:

- **One scale for every clip, 620/768.** The clips all came off one character sheet and the stills
  are 620 tall, so a single factor keeps every size relationship the artwork already has — a
  clip and a still draw the character at the same size. Cropping each clip to its own subject
  would destroy that.
- **Alpha is premultiplied across the resize** (`premultiply → scale → unpremultiply`). Scaling
  straight alpha smears body colour into the transparent ring and shows up as a light rim around
  the character. This is what `--verify` guards, against a reference downscale rather than an
  absolute threshold — an absolute one cannot tell a rim from honest antialiasing.
- **WebM, not GIF, and VRAM is the reason.** Chromium keeps a decoded animated GIF as GPU
  textures: five mascots at the landing's draw size measured **~305 MiB**, against **~13 MiB** for
  the same clips as alpha WebM. Alpha VP9 is software-decoded (`VpxVideoDecoder`,
  `kIsPlatformVideoDecoder=false`), so it never takes a GPU decoder at all. CPU cost of that
  software decode measured 0.7% against GIF's 0.5%.

## The map


### Vision

| GIF card | File | From | What it is | Size |
|---|---|---|---|---|
| `gif_021` | `gif_618c8d6c.gif` | `i2v_001` | Idle 1 | 768x768 |
| `gif_022` | `gif_c7659c97.gif` | `i2v_002` | Idle 2 | 768x768 |
| `gif_023` | `gif_768fa7c7.gif` | `i2v_003` | Idle 3 | 768x768 |
| `gif_024` | `gif_d5247870.gif` | `i2v_004` | Greet (wave) | 768x768 |
| `gif_025` | `gif_8e7e98c0.gif` | `i2v_005` | Greet (say cheese) | 768x768 |
| `gif_026` | `gif_cbca74bd.gif` | `i2v_006` | Happy (hop) | 768x768 |
| `gif_027` | `gif_cb14a09d.gif` | `i2v_007` | Happy (head pop) | 768x768 |
| `gif_028` | `gif_d394ae08.gif` | `i2v_008` | Failed | 768x768 |
| `gif_067` | `gif_72e2a5b4.gif` | `i2v_047` | Job cancelled | 768x768 |
| `gif_072` | `gif_5e6a1009.gif` | `i2v_052` | Heads up | 768x768 |
| `gif_077` | `gif_b1f1c492.gif` | `i2v_057` | Search no results | 768x768 |
| `gif_087` | `gif_d76304b8.gif` | `i2v_067` | Gallery peek | 768x768 |
| `gif_011` | `gif_69186173.gif` | `ref2v_004` | Getting ready | 768x768 |
| `gif_012` | `gif_69186172.gif` | `ref2v_005` | Working | 768x768 |
| `gif_092` | `gif_45ea9a20.gif` | `t2v_002` | Smoke puff | 768x768 |
| `gif_100` | `gif_881131bd.gif` | `t2v_028` | Third (camera flash) | 768x768 |
| `gif_102` | `gif_11ea8063.gif` | `t2v_035` | Explosion | 768x768 |

### Studio

| GIF card | File | From | What it is | Size |
|---|---|---|---|---|
| `gif_029` | `gif_238be7da.gif` | `i2v_009` | Idle 1 | 768x768 |
| `gif_030` | `gif_58be1045.gif` | `i2v_010` | Idle 2 | 768x768 |
| `gif_031` | `gif_6b3ff1ec.gif` | `i2v_011` | Idle 3 | 768x768 |
| `gif_032` | `gif_c6a2dc04.gif` | `i2v_012` | Greet (wave) | 768x768 |
| `gif_033` | `gif_26c04432.gif` | `i2v_013` | Greet (hat tip) | 768x768 |
| `gif_034` | `gif_0ab0c07a.gif` | `i2v_014` | Happy (hop) | 768x768 |
| `gif_061` | `gif_8953ff1a.gif` | `i2v_041` | engine starting | 768x768 |
| `gif_063` | `gif_d0a2cd29.gif` | `i2v_043` | update ready | 768x768 |
| `gif_064` | `gif_c5bef5b1.gif` | `i2v_044` | agent thinking | 768x768 |
| `gif_065` | `gif_2ff52be2.gif` | `i2v_045` | agent listening | 768x768 |
| `gif_066` | `gif_daae5886.gif` | `i2v_046` | agent answer ready | 768x768 |
| `gif_068` | `gif_979b4c24.gif` | `i2v_048` | Job cancelled | 768x768 |
| `gif_073` | `gif_76ae58ba.gif` | `i2v_053` | Heads up | 768x768 |
| `gif_078` | `gif_4792b8db.gif` | `i2v_058` | Search no results | 768x768 |
| `gif_088` | `gif_1473fef5.gif` | `i2v_068` | Gallery peek | 768x768 |
| `gif_111` | `gif_41dfc162.gif` | `i2v_072` | connecting loop (sparks) | 1536x640 |
| `gif_112` | `gif_7f45edfc.gif` | `i2v_074` | connecting loop (spit out) | 1536x640 |
| `gif_113` | `gif_c4a29401.gif` | `i2v_075` | connecting loop (laptop) | 1536x640 |
| `gif_114` | `gif_ac8d3834.gif` | `i2v_077` | connected (plays once on connect success) | 1536x640 |
| `gif_115` | `gif_2c886f2c.gif` | `i2v_081` | connecting loop (screwdriver) | 1920x768 |
| `gif_013` | `gif_69186177.gif` | `ref2v_006` | Getting ready | 768x768 |
| `gif_019` | `gif_979e4747.gif` | `ref2v_014` | Working | 768x768 |
| `gif_093` | `gif_4858a548.gif` | `t2v_007` | Third (tv switch) | 768x768 |
| `gif_097` | `gif_1e2869ff.gif` | `t2v_019` | Smoke puff | 768x768 |
| `gif_101` | `gif_e01a3cb4.gif` | `t2v_029` | Explosion | 768x768 |

### Prompt

| GIF card | File | From | What it is | Size |
|---|---|---|---|---|
| `gif_037` | `gif_5b7bea8f.gif` | `i2v_017` | Idle 1 | 768x768 |
| `gif_038` | `gif_60cd634f.gif` | `i2v_018` | Idle 2 | 768x768 |
| `gif_039` | `gif_14d7b371.gif` | `i2v_019` | Idle 3 | 768x768 |
| `gif_040` | `gif_389bbfb6.gif` | `i2v_020` | Greet (wave) | 768x768 |
| `gif_041` | `gif_0666ec51.gif` | `i2v_021` | Greet (typing dots) | 768x768 |
| `gif_042` | `gif_317ff9f9.gif` | `i2v_022` | Happy (hop) | 768x768 |
| `gif_043` | `gif_4a55aed1.gif` | `i2v_023` | Happy (head pop) | 768x768 |
| `gif_044` | `gif_2593ed29.gif` | `i2v_024` | Failed | 768x768 |
| `gif_069` | `gif_66e18148.gif` | `i2v_049` | Job cancelled | 768x768 |
| `gif_074` | `gif_4676d79b.gif` | `i2v_054` | Heads up | 768x768 |
| `gif_079` | `gif_16bff078.gif` | `i2v_059` | Search no results | 768x768 |
| `gif_084` | `gif_d154d7ae.gif` | `i2v_064` | Gallery peek | 768x768 |
| `gif_089` | `gif_5b404e45.gif` | `i2v_069` | Gallery peek | 768x768 |
| `gif_014` | `gif_ce5b3987.gif` | `ref2v_008` | Getting ready | 768x768 |
| `gif_015` | `gif_6f23bb25.gif` | `ref2v_009` | Working | 768x768 |
| `gif_094` | `gif_69186171.gif` | `t2v_008` | Smoke puff | 768x768 |
| `gif_103` | `gif_96329ebc.gif` | `t2v_037` | Explosion | 768x768 |
| `gif_109` | `gif_a5e35289.gif` | `t2v_045` | Third (speech bubble pop) | 768x768 |

### Audio

| GIF card | File | From | What it is | Size |
|---|---|---|---|---|
| `gif_045` | `gif_9208d5d4.gif` | `i2v_025` | Idle 1 | 768x768 |
| `gif_046` | `gif_b2b731f6.gif` | `i2v_026` | Idle 2 | 768x768 |
| `gif_047` | `gif_788a9747.gif` | `i2v_027` | Idle 3 | 768x768 |
| `gif_048` | `gif_6b546a2e.gif` | `i2v_028` | Greet (wave) | 768x768 |
| `gif_049` | `gif_c2aff607.gif` | `i2v_029` | Greet (ear cup) | 768x768 |
| `gif_050` | `gif_8de136ed.gif` | `i2v_030` | Happy (hop) | 768x768 |
| `gif_051` | `gif_f36477dc.gif` | `i2v_031` | Happy (head pop) | 768x768 |
| `gif_052` | `gif_c5b8fe7a.gif` | `i2v_032` | Failed | 768x768 |
| `gif_070` | `gif_f494ce97.gif` | `i2v_050` | Job cancelled | 768x768 |
| `gif_075` | `gif_593f55e5.gif` | `i2v_055` | Heads up | 768x768 |
| `gif_080` | `gif_7d99a4e0.gif` | `i2v_060` | Search no results | 768x768 |
| `gif_085` | `gif_833d2421.gif` | `i2v_065` | Gallery peek | 768x768 |
| `gif_090` | `gif_2e5fd964.gif` | `i2v_070` | Gallery peek | 768x768 |
| `gif_016` | `gif_5cc19d06.gif` | `ref2v_010` | Getting ready | 768x768 |
| `gif_020` | `gif_422b4140.gif` | `ref2v_015` | Working | 768x768 |
| `gif_095` | `gif_13899b4b.gif` | `t2v_011` | Smoke puff | 768x768 |
| `gif_105` | `gif_e4af4815.gif` | `t2v_039` | Explosion | 768x768 |
| `gif_108` | `gif_54005c58.gif` | `t2v_044` | Third (sound pulse) | 768x768 |

### Video

| GIF card | File | From | What it is | Size |
|---|---|---|---|---|
| `gif_053` | `gif_50a73bc0.gif` | `i2v_033` | Idle 1 | 768x768 |
| `gif_054` | `gif_2d093899.gif` | `i2v_034` | Idle 2 | 768x768 |
| `gif_055` | `gif_48e40647.gif` | `i2v_035` | Idle 3 | 768x768 |
| `gif_056` | `gif_683e8060.gif` | `i2v_036` | Greet (wave) | 768x768 |
| `gif_057` | `gif_c8bc54c0.gif` | `i2v_037` | Greet (director frame) | 768x768 |
| `gif_058` | `gif_f0bf943f.gif` | `i2v_038` | Happy (hop) | 768x768 |
| `gif_059` | `gif_161900c4.gif` | `i2v_039` | Happy (head pop) | 768x768 |
| `gif_060` | `gif_16fd30f9.gif` | `i2v_040` | Failed | 768x768 |
| `gif_071` | `gif_f6470e62.gif` | `i2v_051` | Job cancelled | 768x768 |
| `gif_076` | `gif_3967da71.gif` | `i2v_056` | Heads up | 768x768 |
| `gif_081` | `gif_6c0d7d61.gif` | `i2v_061` | Search no results | 768x768 |
| `gif_091` | `gif_0c81af1e.gif` | `i2v_071` | Gallery peek | 768x768 |
| `gif_017` | `gif_5809fd6b.gif` | `ref2v_012` | Getting ready | 768x768 |
| `gif_018` | `gif_6f1eec7e.gif` | `ref2v_013` | Working | 768x768 |
| `gif_098` | `gif_8bc60fb8.gif` | `t2v_024` | Smoke puff | 768x768 |
| `gif_099` | `gif_e9c19e0a.gif` | `t2v_026` | Third (film reel burst) | 768x768 |
| `gif_106` | `gif_1ff23526.gif` | `t2v_042` | Explosion | 768x768 |

### Unassigned spares

| GIF card | File | From | What it is | Size |
|---|---|---|---|---|
| `gif_082` | `gif_7d319ec9.gif` | `i2v_062` | - | 768x768 |
| `gif_083` | `gif_72dc6e75.gif` | `i2v_063` | - | 768x768 |
| `gif_086` | `gif_498c7546.gif` | `i2v_066` | - | 768x768 |
| `gif_010` | `gif_31871e61.gif` | `ref2v_001` | - | 768x768 |
| `gif_096` | `gif_4350701b.gif` | `t2v_016` | - | 768x768 |
| `gif_104` | `gif_59ab3802.gif` | `t2v_038` | - | 768x768 |
| `gif_107` | `gif_198903de.gif` | `t2v_043` | - | 768x768 |
| `gif_110` | `gif_7403eb6b.gif` | `t2v_046` | - | 768x768 |
