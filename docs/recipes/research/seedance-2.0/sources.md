# Source Manifest — Seedance 2.0

Provenance for the Seedance 2.0 recipe. Sources are Fabio's NotebookLM notebook
"Seedance Prompt Guies" (`119a088d`); transcribed via `notebooklm source list -n
119a088d --json`.

Note: this notebook is **shared** with Seedance 1.5. Source #5 (fal.ai guide)
is dedicated to Seedance 1.5; all other sources (#1–4, #6–10) cover Seedance 2.0.

- **Model version researched:** Seedance 2.0
- **Research date:** 2026-06-22
- **Researcher:** Fabio (curation) + agent (query)
- **Notebook:** `119a088d-5e99-4803-8f6d-56ba82f13a52` — "Seedance Prompt Guies"

## Sources

| # | Title / URL | Authority tier | Accessed | Notes |
|---|---|---|---|---|
| 1 | https://www.imagine.art/blogs/seedance-2-0-prompt-guide — "Exclusive Seedance 2.0 Prompt Guide With 70 Ready-To-Use AI Video Prompts" | community-deep-dive | 2026-03-26 | 70 ready-to-use prompts; covers t2v and asset usage |
| 2 | https://wavespeed.ai/blog/posts/blog-character-consistency-seedance-2-0/ — "How to Keep Character Consistency in Seedance 2.0" | community-deep-dive | 2026-03-26 | Reference pack technique, 3-still method, ID drift prevention |
| 3 | https://www.mindstudio.ai/blog/timeline-prompting-seedance-2-cinematic-ai-video-3 — "How to Use Timeline Prompting with Seedance 2.0 for Cinematic AI Video" | community-deep-dive | 2026-03-26 | Timeline/multi-shot prompting with timestamp syntax for i2v |
| 4 | https://resource.digen.ai/quick-guide-to-seedance-2-0/ — "Quick Guide to Seedance 2.0 - Digen AI" | community-deep-dive | 2026-03-26 | Quick-start covering @mention system and quality suffix |
| 5 | https://fal.ai/learn/devs/seedance-1-5-prompt-guide — "Seedance 1.5 Prompt Guide: Mastering ByteDance's Audio-Video Generation Model - Fal.ai" | official-docs | 2026-03-26 | Seedance 1.5 dedicated guide; useful for version contrast only |
| 6 | https://www.promeai.pro/blog/seedance-2-0-camera-movement-cheat-sheet/ — "Seedance 2.0 Camera Movement Cheat Sheet - PromeAI" | community-deep-dive | 2026-03-26 | Authoritative camera terminology cheat sheet: pan, dolly, tracking, rack focus |
| 7 | https://www.weshop.ai/blog/seedance-2-0-guide-how-to-master-the-prompt-script/ — "Seedance 2.0 Guide: How To Master the Prompt Script - WeShop AI" | community-deep-dive | 2026-03-26 | Full prompt script breakdown; covers @tag system and multi-shot |
| 8 | https://chatcut.io/blog/seedance-2-prompt-guide — "Seedance 2.0 Prompt Guide: How to Create Better AI Videos - ChatCut" | community-deep-dive | 2026-03-26 | Comprehensive t2v guide including Subject→Action→Camera→Style formula |
| 9 | https://seadanceai.com/blog/seedance-2-prompt-guide-cinematic-ai-video-generation — "Seedance 2.0 Prompt Guide: Master Cinematic AI Video Generation" | community-deep-dive | 2026-03-26 | Cinematic control, quality suffix, constraints |
| 10 | YouTube: "The ULTIMATE Seedance 2.0 Prompting Guide (Complete Control + Amazing Results)" | community-deep-dive | 2026-03-26 | Video tutorial; multi-shot escalation technique, @Image1 as first frame example, audio sync per shot |

Authority tiers (highest first): `official-docs`, `official-example`,
`community-deep-dive`, `comparison`. Community findings supplement, never
override, official sources.

No dedicated official-docs source from ByteDance/Seedance for 2.0 exists in this
notebook; all 2.0 coverage comes from community deep-dives. Flag for Phase 3:
locate official ByteDance documentation if available.

## Step 0 locations, recorded not read (out of v1.0)

Seedance 2.0 is registered but **out of v1.0** — Vision ships it on no card — so
nothing here is urgent. These are the step-0 locations
(`docs/recipes/playbook/08-vendor-prompt-skills.md`) so the next author does not
re-run the search. Every row above is tier 3–5; the rows below outrank all of them.

| Source | Tier | Found | Note |
|---|---|---|---|
| `krea-ai/skills` → `krea-generate/references/models/seedance-2.md` and `seedance-2-examples.md` | **1–2 — platform-vendor skill** | 2026-08-17 | Krea's own official skills repo (★18) carries a per-model Seedance 2 reference. Krea is the serving platform rather than ByteDance, so it is not the model author — but it is a first-party production reference, which is a tier above every source in the table above. **Not read.** Found while running `krea-2`'s step 0. |
| `dexhunter/seedance2-skill` ★3,315, `songguoxs/seedance-prompt-skill` ★2,672, `liangdabiao/Seedance2-Storyboard-Generator` ★2,112, + six more in the hundreds-to-thousands | 3 — community skill ecosystem | 2026-08-17 | The full list, and why it is load-bearing for this model specifically, is in playbook 08. **Read the top two before drafting**: for Seedance, users do not write prompts without a skill, so our output gets compared to theirs. |

The Phase 3 flag above — *"locate official ByteDance documentation"* — was
open until MPI-911, below. Neither row is ByteDance.

## Step 0 run, MPI-911 (2026-09-24): read, merged, and what was rejected

The recipe's two modes and the agent guide (`docs/agent/models/seedance-2.0.md` plus its
`seedance-2.0/` folder) were rebuilt from these. The rule-by-rule inventory and the
classification against the old recipe live in `.agents/mpi-kanban/tasks/MPI-911/validation.md`.
Nothing below is quoted: two of the sources are private.

| # | Source | Tier | Accessed | What was adopted | What was rejected, and why |
|---|---|---|---|---|---|
| 11 | **BytePlus ModelArk, "Dreamina Seedance 2.0 series prompt guide"**, https://docs.byteplus.com/en/docs/ModelArk/2222480 (Chinese mirror docs.volcengine.com/docs/82379/2222480). Client-rendered: WebFetch returns it empty, read it in a browser. | **official-docs (ByteDance)** | 2026-09-24 (page updated 2026-09-22) | The prompt order (subject, action, scene, lighting and tone, camera, style, quality, constraints); `Shot 1:` storyboards with no durations; body-part actions with range, speed and force; gentle continuous movement over bursts; emotion as physical detail; one camera movement per shot; short quality words; the constraint tail (subtitle-free, no logo, no watermark); `{}` dialogue, `<>` sound effects, `()` music; a headshot plus a full-body photo, never a multi-view sheet. | Nothing rejected. Its reference syntax is recorded for MPI-910 below, not built. |
| 12 | Higgsfield's Seedance 2.0 director skill (`CINEDANCE HIGGSFIELD SKILL.md`), supplied privately by Fabio, gitignored at `.agents/mpi-kanban/private/seedance-skills/`. Built from production volume on Higgsfield. | platform vendor (serving platform, not ByteDance) | 2026-09-24 | Lens as diagonal field of view in degrees with camera distance and visible outcome, chosen by content, never millimetres or f-stops; first-frame occupancy, spatial blocking, separate gaze and body facing, measured landmark distance; lighting as a lock (source, direction, camera side, exposure priority); the physics lock; one take by default, cuts only for a reason, named transitions, continuity across cuts; context isolation; minimal identity anchors; local positive locks over a negative block; settings the UI sets stay out of the prompt; a short optional quality phrase. | **Its upper-case section labels**: a Higgsfield convention the ByteDance guide does not use; the official formula order wins. **Its `0:00 to 0:03` time blocks and second-precise dialogue timing**: row 11 says precise timing is unstable. **Its `@TAG` reference rules**: scoped to a multi-reference surface Vision does not send yet (MPI-910). |
| 13 | Higgsfield's Seedance 2.0 acting skill (`ACTING SKILL.md`), same private folder | platform vendor | 2026-09-24 | Acting as behaviour under pressure: objective, obstacle, tactics, visible beat changes, listening and reaction, physical state and business, distance and status, eye life, states not transitions, ensemble staggering, the failure table. Lives in the guide's `performance` sub-skill; the enhancer takes only "visible behaviour, states not transitions". | The recurring-character master profile and the verbatim voice line need a persistent per-character store the app does not have; recorded in the guide as a technique, not a feature. |
| 14 | `prompt-builder-2-5.skill` (a zip holding `seedance-clean/SKILL.md`), same private folder | platform vendor, **Seedance 2.5** | 2026-09-24 | Nothing as authority. Its frontmatter names Seedance 2.5, the playbook 08 version trap. It corroborates row 12 on degrees, labelled sections and named hard cuts. | Filed under 2.5: it becomes step 0 for a 2.5 recipe, if one is ever made. |
| 15 | `LIRA SKILL.md`, same private folder | platform vendor | 2026-09-24 | Nothing. | Image prompting for Higgsfield's image models; its video note is a pointer to Seedance. Out of scope. |
| 16 | `dexhunter/seedance2-skill` (3,926 stars, pushed 2026-09-19), Seedance 2.0 on Jimeng | community-skill | 2026-09-24 | Corroborates rows 11-12 on one camera move per shot and on short optional style words. | Timed segments for clips of ten seconds or more: row 11 calls precise timing unstable. |
| 17 | `songguoxs/seedance-prompt-skill` (2,842 stars, pushed 2026-02-12), Seedance 2.0 on Jimeng, `.claude/skills/seedance/SKILL.md` | community-skill | 2026-09-24 | Nothing new. | Output mandated in Chinese (our users write English, and row 11 asks for one dialogue language); timed storyboards (row 11); a closing prohibition list (row 12 keeps locks local). |
| 18 | `krea-ai/skills` → `krea-generate/references/models/seedance-2.md` and `seedance-2-examples.md` | platform vendor, family document (2.5 first) | 2026-09-24 | Corroborates row 11: `Shot N` over timestamps, two or three stable traits, a constraints tail, one camera move per shot. | Krea-only mechanics (its own image-slot rules, forced audio) describe a surface Vision does not use. |

The top two community skills and the official guide disagree on timing; the official guide
wins, and it is the one source here written by the model's author.

### Reference notes for MPI-910 (recorded, not built)

What the reference op will need, from rows 11 and 12, so its planner does not re-read them:

- The official guide names inputs in the prompt as `Image 1`, `Video 1`, `Audio 1` (its examples
  write `@Image 1`), binds a subject once ("the woman in Image 1 as Subject 1") and reuses that
  label on every mention. An asset library id is never a substitute for the `Image N` name.
- Edit and extend tasks name the video directly (`Video 1`); "reference Video 1" is read as a
  reference task instead.
- Four or five assets is the recommended load; more than four reference people is unstable;
  a headshot plus a full-body photo per character, never a multi-view sheet.
- The director skill lists only the tags active in the shot, never invents or carries a stale
  one, and gives each referenced character a minimal anchor line ending in a statement that it
  matches its reference; a location reference supplies geography, never the camera angle.
- DeepInfra's `ByteDance/Seedance-2.0` takes `reference_images`, `reference_videos`,
  `reference_audios` and `last_frame_image` as URLs; its page carries no prompting guidance.

## Status

Sources captured. Research complete — 7 standard questions + i2v follow-up
queried against notebook `119a088d`. See `research.md` for findings.

**Superseded in part by MPI-911 (2026-09-24):** rows 11-18 outrank rows 1-10, and the recipe now
follows them. `research.md` § "MPI-911 answers" restates the seven questions against them.
