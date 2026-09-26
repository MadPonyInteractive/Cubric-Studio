# MPI-846 Plan - Mascot crew: names, registry, chat presence, animations

## CLOSED (2026-09-26)

Every member is done: MPI-843, MPI-777, MPI-906, MPI-907, MPI-908, MPI-909 built; MPI-842 closed
on Fabio's call (the single registry file was not built). The member table below is history.
Carried to done by umbrella MPI-932.

## Status (2026-09-24)

The old "DO NOT START YET" gates are gone: the GIF workspace shipped and the clips are
rolled - 95 of 103 are staged as alpha WebM in `assets/mascot/{key}/` (the 8 left are
deliberate spares). MPI-777 closed with the shared clip queue, the landing crew, the agent
panel crew and the flicker fix (`heroCrew.js` `handOverClip`) - verified by Fabio. Its
unfinished phases were split into MPI-906..909 below. Fabio, 2026-09-24: no new clips are
needed; place the ones not yet shown (`heads-up`, `no-results`, four head peeks,
`engine-starting`, `update-ready`, `connecting` x4, `connected`).

## Members

| Card | Title | State |
|---|---|---|
| MPI-843 | Agent chat UI study | `done` |
| MPI-842 | Mascot crew identities | `todo` / `idea` |
| MPI-777 | Animated mascots in the app: shared clip queue, landing crew, agent panel crew | `done` (2026-09-24) |
| MPI-906 | Mascots on the waiting spots | `todo` |
| MPI-907 | Toast mascots | `todo` |
| MPI-908 | Mascots on empty and one-off states | `todo` |
| MPI-909 | Prompt box head peeks (was MPI-777 Phase 4B) | `todo` / `blocked` on the MpiPromptBox claim |

Not members, on purpose:

- **MPI-797** (Agent box: own input, image chips, resizable panel) - stays on the agent
  track by Fabio's decision, 2026-09-20. MPI-842 declares a dependency on it, does not
  absorb it.
- **MPI-838 / MPI-757** (GIF workspace) - the external blocker above, its own track.
- **MPI-708** (rename to Cubric Studio) - a rename job that happens to touch mascot files.
- **MPI-766** (landing hero 2.0) - done.

## The design, as agreed with Fabio (2026-09-20)

Five mascots get names. A sixth joins when 3D work starts.

| Mascot | Name | Accent token | Note |
|---|---|---|---|
| Studio | **Cosmo** | `--hub-accent` (cream) | the orchestrator, and the only one who speaks |
| Prompt | **Lingo** | `--prompt-accent` (yellow) | a translator, not a writer - it phrases intent so models understand it |
| Vision | **Prism** | `--vision-accent` (rose) | |
| Video | **Reel** | `--video-accent` (orange) | |
| Audio | **Vinyl** | `--accent-audio` (green) | |
| 3D | **Clay** | none yet | provisional; a sixth family hue is a website decision |

Names were screened against the app's own vocabulary. **A mascot name may not be a noun
the UI will want for a control.** That rule killed: Cue (the queue button), Foley (a
shipping Flow), Ink (`--ink-*` is the type-colour token family), Wave (audio UI
vocabulary), Chord (piano rolls will need it), Iris (Intel Iris GPUs appear in
`MpiEngineInstall.js`). Re-run the screen before adding a sixth name - the piano roll will
claim *note, key, bar, beat, tempo, pitch, track, stem, loop, gain, mix*.

Chat shape, decided: **Cosmo is the only speaker.** The other four never talk. When work
of their kind runs, that mascot's face, family accent and animation take the working row,
then hand back to Cosmo. One voice to write and maintain, not five. Multi-speaker stays
possible later on the same registry.

Honesty rail: **a mascot only takes the row when its op actually ran.** Never "let me get
Vinyl on this" when no audio work happened.

Chrome does not change. Menus, settings and workspace labels stay role nouns - Video,
Audio, Prompt. Names live in the chat and the art, so a new user never has to learn six
names to find a button.

## Phases

### Phase 1: the chat UI study (MPI-843) - RUNS EARLY, NOT BLOCKED

Ships no app code, so it does not wait on the GIF gates.

- [ ] Three mockups of the agent chat panel via the `impeccable` skill, for Fabio to evaluate.
- [ ] Each mockup answers: where Cosmo sits - bottom by the input (Fabio's lean) vs inline
      between messages; whether a terminal aesthetic with a blinking cursor holds up against
      the family accents; where the mascot animation area lands.
- [ ] Resolve **MPI-777 open decision #4** - whether the prompt box ledge replaces the 48px
      Studio in `MpiAgentChat.js` (~44-94), or both exist. Phase 3 cannot be planned until
      this is answered.

Verify: Fabio picks one, or names what to change. Record the choice in MPI-843's
`validation.md` and carry it into MPI-777's plan.

### Phase 2: the registry and the speaker (MPI-842)

- [ ] `js/data/crew.js` - six entries, `{ id, name, role, accentVar, art, anim }`. The `anim`
      slot is there from the start so the GIFs drop in without rewiring.
- [ ] Nothing hardcodes a name anywhere. Chat, landing, About all read the registry.
- [ ] `MpiAgentChat.js` - speaker resolves to Cosmo; the working row takes the active op's
      mascot, its accent and (later) its animation.
- [ ] Per-message accent uses the family token straight. **No `color-mix` between two family
      accents** - the ban in DESIGN.md holds here.

Verify: a real generation of each kind puts the right mascot on the row with the right
accent, and no op means no mascot.

### Phase 3: animation placement (MPI-777)

Its own five-phase plan already exists in `tasks/MPI-777/plan.md` - shared clip queue,
landing hero crew, prompt box ledge, spot map. Do not restate it here. Two changes only:

- [ ] It reads names and assets from `js/data/crew.js` instead of carrying its own.
- [ ] Its open decision #4 is answered by Phase 1 before its Phase 4 starts.

## Parallel Batch - Phase 2 and Phase 3

Run only after Phase 1 answers open decision #4 and both GIF gates hold.

**`MpiAgentChat.js` is shared by MPI-842 and MPI-777 and must NOT be in the same batch.**
Land MPI-842's speaker/accent wiring first, then MPI-777's ledge work on top.

| Task | Ownership |
|---|---|
| MPI-842 | `js/data/crew.js` (new), `js/components/Compounds/MpiAgentChat/**` |
| MPI-777 | `js/shell/heroCrew.js`, `js/components/Organisms/MpiPromptBox/**`, the clip-queue utility |

MPI-777's prompt-box and hero work is disjoint from MPI-842 and can run alongside it. Its
`MpiAgentChat.js` edits cannot.

## Cross-track dependency

**MPI-797** (agent box UI) owns the panel Cosmo lives in. Phase 2 depends on it and must
not edit it.

The trigger surface is the one place the two tracks touch. The boundary: **the agent side
emits, the crew layer listens.** `services/agentLoop.mjs` should never need to know Prism
exists - the crew layer subscribes to op-start / op-kind / op-finish and decides who takes
the row.

Asked on the agent track 2026-09-20 in
`state/messages/be606244-ec07-4eb1-ab57-382af74723da.json` (to MPI-817): which events the
loop already emits, whether one `Events.emit` at the dispatch point is acceptable, and
whether anything in flight makes a listener a bad idea. **Read the reply before planning
Phase 2 in detail.**

## Claims to respect

`PRODUCT.md` and `DESIGN.md` were claimed and heartbeating on 2026-09-20 at 09:55Z. The
name table and accent mapping will eventually want DESIGN.md - check `state/index.json`
for a live claim before going near it.

## Open

- A sixth family hue for Clay, when 3D work starts. The website owns the family hues
  (`c:\AI\Mpi\Cubric Studio (Website)\styles\landing.css:30-34` wins on any disagreement).
- Whether the member cards stay on the board or close into this plan once their work lands.
