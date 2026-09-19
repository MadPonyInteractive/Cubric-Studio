# MPI-817 Checklist

An umbrella's checklist tracks PHASES, not the members' own items. Each member card keeps its own
checklist; this one closes when all three phases do.

- [ ] **Phase A — MPI-816: flow-field dispatch.** Both fixes, the confirm step, the skill doc
      update, the shared-primitive sweep. **Closes on:** four character sheets asked for in
      Fabio's own words, four cards land.
- [ ] **Phase B — MPI-774 Phase 6: global memory.** Design conversation with Fabio first; the
      footprint is unknown until it happens.
- [ ] **Phase C — MPI-774 Phase 7: agent reliability.** Includes the decision on the narration
      bug (the agent reported four sheets as started after four dispatches had already failed).
      - [x] The narration bug (2026-09-19, a2b243de): `generate` races the dispatch against
            `EARLY_REFUSAL_MS` and hands a refusal back in-turn, so a route refusal can no longer
            be narrated as "your image is on its way".
      - [x] **The pinned settings panel** (2026-09-19, session 35aabda4): built whole, both traps
            included. Code-verified — 1398 unit tests, lint clean, agent-chat.spec 28/28 whole-file.
            Evidence: `tasks/MPI-774/validation.md` § Phase 7.
      - [ ] **Fabio's own pass in the app** (Phase 7 is `user-ux`) — the five steps in that
            validation section. Needs a full app RESTART, not a reload.
      - [ ] The NSFW flag on `RECOMMENDED_REMOTE_MODELS` (Qwen3-VL-30B-A3B-Instruct only; the
            wording can only ever be "did not refuse in our tests", dated). Rides with the picker
            work.
      - [ ] The Ollama picker, plus the six free Ollama cloud models. Shape to be agreed with him.
      - [x] **Focus mode leaves the agent panel behind** (2026-09-19, session ea603cb9). Fabio
            pressed F with the agent open and the chat kept its 420px. Collapsed, not hidden:
            `:has()` still matches a `display:none` panel, so hiding it takes the chat and
            leaves its gap. `tests/desktop/focus-mode.spec.js` asserts the sibling's margin
            as well as the panel's width, because only the margin catches that mistake.
      - [x] **The cog moved left of the model button, and the caret follows the cog**
            (2026-09-19, session ea603cb9). Fabio asked for the swap twice; the round cause is
            that `.mpi-popup::after` is pinned to the popup's own centre, and the cog sits near
            the right edge so the panel always clamps left and the caret lands on the model
            button next door. Both done: the swap, and `--popup-arrow-x` on the primitive
            (defaulting to `50%`, so no other MpiPopup owner changes).
      - [x] **The never-negate rule moved out of the edit paragraph** (2026-09-19, session
            ea603cb9). Diagnosed from Fabio's own standoff conversation: three rounds lost to
            "not drawn, never leaves the holster, not held" in a `t2i` positive prompt. The rule
            existed in `docs/agent/models/krea-2.md` but was filed under `krea2Edit` / `inpaint`,
            and the negative-field bullet's "state exclusions in the positive prompt" read as a
            licence for exactly what went wrong. Now a section of its own, with the measured case.
      - [x] **Image provenance** (2026-09-19, session ea603cb9). The agent could not tell which
            model made an image and did not know it could not, so it called an `ill-anime`
            picture "the Krea 2 result" and generated nothing. `modelId` now rides the result
            into the App state line. Detail: `validation.md` § 4.
      - [ ] **A THIRD pattern, no card, watch it**: in all three of Fabio's 2026-09-19
            conversations the agent ended a turn by asking a question and doing nothing - the
            standoff axis he had just specified, the orbit he had just corrected, and "can you
            ask it to be a cartoon", which is an instruction. Mode is Auto, whose rule is
            "proceed when the goal is clear without asking about settings". Three in one day is
            a pattern, not three accidents; it belongs in the Prompt rule conversation below
            rather than as its own fix.
      - [ ] **Bigger, NOT built, needs Fabio's shape first** (both raised 2026-09-19 out of the
            same conversation): a Prompt rule in the system prompt — there is a Settings rule, a
            Duration rule, a Box rule and a Shape rule, and nothing at all about writing the
            prompt, which is the thing that failed — and surfacing the agent's real prompt in the
            chat, collapsed. Four rounds were spent correcting a prompt he was never shown.
- [ ] **Phase D — model skill packs** (Fabio, 2026-09-19, not started). Most models now ship a
      skill pack in their own repo: prompting skills that tell an agent how to drive that model
      for a given task. We have none of them. Established this session while asking why the agent
      mishandled an H3 camera move:
      - The agent can read exactly five skills. `isVisionSkill` in `services/agentCorpus.mjs`
        hard-filters the corpus to `cubric-vision` and `cubric-vision-*`, and those are the
        drive-the-app-over-HTTP skills, served with a banner saying they were written for OUTSIDE
        agents. There is no per-model skill for any model, H3 included.
      - What H3 has instead is a hand-written GUIDE, `docs/agent/models/minimax-h3.md`
        (`guide:minimax-h3`). Good, but ours, and it is where both 2026-09-19 negation failures
        traced to.
      - The sanitise work that WAS done covers those five Vision skills only. Model skill packs
        were never carded: no title, brief, plan or research folder on the board mentions them,
        and `docs/models/h3/` does not either.
      - **H3's pack is real and was read this session** (Fabio's link, 2026-09-19):
        `github.com/MiniMax-AI/MiniMax-H3/tree/main/skills`. Nine skills plus a README, installed
        upstream through the Vercel `npx skills add` CLI, which is packaging we do not need.
        `h3-prompt-writing` is the one that matters; the other eight are genre recipes (3D short,
        brand promo, music video subtitles, papercraft, paper collage, hand-drawn + live, co-op
        game intro, minimalist product ad) and read much more like FLOW material than agent
        guidance.
      - **It is clean to take.** Its own frontmatter: *"Portable to any agent that can read local
        files - no external API calls, MiniMax Hub tools, or proprietary runtime required."*
        Confirmed by reading it: no endpoints, no pricing, no CLI. `agents/openai.yaml` is
        optional ChatGPT UI metadata only.
      - **The substance is not in SKILL.md.** That file is ~420 words of routing. The weight is
        `references/base-en.txt` (15.7 KB) and `references/ref-en.txt` (23.5 KB), which are
        MiniMax's own prompt specification.
      - **It answers today's bug, with authority we do not have.** `base-en.txt` carries a camera
        motion TABLE with amplitude and speed modifiers, and it DEFINES the pair our guide only
        lists: *"Arc Shot - the camera moves in an arc around the subject"* against *"Roll
        Clockwise / Roll Counterclockwise"*, around the lens axis. Our
        `docs/agent/models/minimax-h3.md` names `arc` and `roll` side by side and defines
        neither, which is exactly the gap the agent fell into on Fabio's orbit.
      - **And it does NOT answer the other half.** `base-en.txt` has nothing on negation, and
        nothing on slow motion or speed ramps - which Fabio's shot also asked for. So the pack
        is not a replacement for our guide, and the negation rule added this session stays ours.
      - **"Sanitise" means PROGRESSIVE DISCLOSURE, not rewriting** (Fabio, 2026-09-19, his own
        words): never load a pack whole, it is far too much context. Two hops. Hop 1, the model
        the agent picked hands back a pointer, not a document. Hop 2, that pointer resolves by
        what the agent is about to DO with the model. Nothing else is read.
      - The numbers say why: `base-en.txt` + `ref-en.txt` is ~39 KB, roughly 10k tokens, on every
        turn, for a guide the agent needs one slice of.
      - **The pack is already built this way**, which makes this cheaper than it sounded.
        SKILL.md is ~420 words of pure routing over five modes, and the weight sits in separate
        reference files behind it. Hop 1 also already exists on our side: `describe_model` hands
        back guide ids and the agent calls `read_knowledge`. What is missing is hop 2 - our
        guides are one file each, all or nothing, so `guide:minimax-h3` is a single read.
      - So the work is: keep their SKILL.md as the router, split the two reference files so a
        mode pulls only its own slice, and re-point their five mode names (T2VA, I2VA, FL2VA,
        L2VA, Ref2VA) at our op ids (`i2v_ms`, `ref2v_ms`, ...). Open for Fabio: do packs ride
        BESIDE the hand-written guides or fold into them, and does our own guide get the same
        two-hop split while we are in there. `isVisionSkill` stops being a hard filter either way.
      - **The survey of the other models already exists and Fabio wrote it**:
        `docs/recipes/playbook/08-vendor-prompt-skills.md`, run read-only across the registry on
        2026-08-17, with per-model read-outs in `docs/recipes/research/<id>/sources.md`. Do not
        re-run the search before reading it: it warns in its own words that *"a survey that reads
        the world but not our own records will invent work that is already done."* Resolved
        against what actually ships today (2026-09-19):

        | Shipped model | Vendor SKILL PACK | State |
        |---|---|---|
        | `minimax-h3`, `minimax-h3-ref2va` | `MiniMax-AI/MiniMax-H3` -> `h3-prompt-writing` | merged into the enhancer RECIPE 2026-08-17 |
        | `klein-4b`, `klein-9b` | `black-forest-labs/skills` (official, star 99), the `[klein]` section | read at authoring 2026-08-05 |
        | `krea2`, `krea2-nsfw` | `krea-ai/skills` (official, star 18) | read 2026-08-17, **nothing adopted** |
        | `wan-22`, `wan22-5b` | none, but the vendor ships its own REWRITER (`system_prompt.py`) | read, partly merged 2026-08-17 |
        | `ltx-23`, `ltx-23-balanced` | none, but the vendor ships its own rewriter (`gemma3_*`) | **merge left unresolved** in the playbook |
        | `chroma-*`, `sdxl-*`, `pony-mix`, `ill-anime*` | **none exists**, searched 2026-08-17 | nothing to take |

      - **Every one of those was judged for the ENHANCER RECIPE, not for the agent, and they are
        different consumers.** A recipe rewrites a prompt the user already wrote; the agent writes
        one from nothing. So "already merged" on the H3 row does NOT mean the agent has it - the
        agent's corpus never saw any of this. And the Krea rejection was specifically that its
        moodboard rule is scoped to Krea's hosted API surface, which is correct for the recipe and
        says nothing about whether the rest of that pack helps an agent. Re-judge all three for
        this consumer rather than inheriting the recipe's verdict.
      - **The Klein row is probably stale.** That read was 2026-08-05, `klein-9b` shipped after it
        (v1.5.0), and the playbook's own note says the BFL skills *"have since moved to target
        FLUX 3"*. Re-pull before trusting the row.
      - **Three shipped models were never step-0'd at all**: `nvidia-pid` (no recipe), and
        `boogu-edit-high` / `boogu-edit-balanced` / `qwen-edit`, which ride the `flux` alias
        deliberately because the conclusion was that edit ops want NO enhancement
        (`js/data/recipes/registry.js` RECIPE_ALIASES, MPI-21). That is a fine answer for the
        enhancer and no answer at all for the agent, which still has to write their instructions.
      - **Not shipped, but flagged loudly for when they are:** Seedance, where the community
        ecosystem tops out at star 3,315 and Fabio's own line in the playbook is *"for Seedance,
        people do not touch the prompt without a skill."* Kling 3.0 is community-only. LTX 2.5's
        step 0 is already done, accidentally, and recorded.
- [x] **Fabio's call (2026-09-19): the member cards STAY separate** — on the condition that they
      get picked up later or ride as phases of this umbrella. Neither is allowed to go quiet. Do
      not fold, close or merge them without asking him again.

## Everything in-app-agent, so nothing goes quiet

Cards, not phases: this umbrella does not own them and must not close them. Listed so the
umbrella is the one place that knows the whole surface (Fabio, 2026-09-19).

| Card | State | What it holds |
|---|---|---|
| MPI-774 | doing / validating | In-app agent slice A. Phases 6 and 7 ride here as B and C. |
| MPI-816 | doing / validating | Flow runs dying on declared fields. Phase A. |
| MPI-820 | doing / in-progress | Agent video duration. His call: its own card, does not close with this one. |
| MPI-797 | todo / blocked | Agent box: own input, numbered chips, resizable panel. |
| MPI-593 | todo / deferred | Agent interface for end users, a small Node CLI. |

Held for Fabio's shape, no card and no phase yet, all raised 2026-09-19 out of his own
conversations: a **Prompt rule** in the system prompt, **surfacing the agent's real prompt**
in the chat, and **the agent's deliberation reaching the chat verbatim** (his second app
pass — "Let me check if there's anything else I should prepare. Actually the generation is
async…", rendered as it arrived). See `validation.md` § 3 for why the per-guide doc fix is
not the whole answer; the third is the same argument.

## Session c6414b8c (2026-09-19) — his SECOND app pass

- [x] The outpaint frame reaches the agent: `params.frame.ratio`, advertised in
      `_listModels`, derived in `_submitFlow`, **refused** when absent (`FRAME_REQUIRED`)
      or a no-op (`FRAME_UNCHANGED`). Pixel-proven on his own `i2i_001.png`.
- [x] A flow's media roles are advertised — the `inputImage` / `image1` refusal.
- [x] `wait: true` on `generate`, plus the Chaining rule. His call, this session.
- [x] `A` toggles agent mode, with the typing case asserted.
- [ ] **A live outpaint in his app** — needs a RESTART (`services/` + `routes/` changed).
- [ ] His verdict on the deliberation leak (held above, not built).

Done already, on MPI-774 and recorded there, not here: Phases 1-5, including fix 8 closed
unreproduced on 2026-09-19 (`tasks/MPI-774/plan.md` § Fix 8 closure).
