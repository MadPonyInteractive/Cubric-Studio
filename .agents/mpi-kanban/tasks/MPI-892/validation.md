# MPI-892 Validation

## Automated (2026-09-30, Agent 73)

- `npm test`: 2409 tests, 2407 pass, 0 fail, 2 skipped.
- `npx eslint --max-warnings=0` on every changed file: clean.
- `tests/agent-flow-handover.test.cjs` (8) and the MPI-892 block of `tests/agent-loop.test.cjs` (5):
  mutation-checked. Disabling the loop's routing fails 3 loop tests; dropping `allowEmpty` fails
  3 renderer tests (Scribble among them: its slot is required on the op, so without the opt-out
  it could not open without a drawing).
- Budgets: SYSTEM 10,403 (down 51, the stale Duration sentence gone); TOOLS 18,370 (+192 for
  `open`, reason in `TOOLS_BUDGET`).

## Live, own isolated app (never :3000)

`%TEMP%/c892`, port 63551, `POST /connector/open-flow` with `follow: true`, screenshots taken:

- Scribble: opened on "02 Draw it", "What is it?" filled, blank canvas, nothing queued.
- Object Stamp (two pictures): opened on "02 Cut it out" with the object loaded, hint returned.
- Song: opened on "03 Generate" with "Your song" filled.
- Text to Speech, no voice: opened on "01 Inputs", voice slot empty, `empty` named it.
- A second open while a Flow was already up: refused `VIEW_BUSY`, nothing replaced.

Found live and fixed: Scribble reported its drawing slot as "still needed" (the drawing IS the
step); the answer now mirrors the frame's `_stepDerivesOwnMedia`. A missing required input now
opens on Inputs even for an `agentOpens` Flow (Draw It In with no photo).

## A parked Flow does not block an open (2026-09-30, Agent 74)

Question: with a Flow parked by the Tab ring, does `openFlow` answer VIEW_BUSY? No. Parking is
`el.suspend()` -> `el.close()` -> `overlay.el.hide()`, and `hide()` always ends in
`Overlays.release(_overlayEntry)` (`js/components/Primitives/MpiOverlay/MpiOverlay.js`), so the
depth `followBlocker` reads drops to 0. `navigation.js` `_leaveOverlaySurfaces` already relies on
the same release. An open then replaces the parked Flow through `shell.js`'s `flow:open`, the
same as the user opening one from the Library. Nothing to fix.

## Found in Fabio's look: an audio result read "Did not finish" (2026-09-30, Agent 74)

A finished Sound & Music track showed a dashed "Did not finish" tile in the chat.
`MpiAgentChat._appendResult` put every non-video result in an `<img>`; a `.flac` can only error
there, and the error handler is the Stopped-job fallback. An audio result now gets an "Audio"
tile, and its `<audio preload="metadata">` still errors into the same fallback when the file
never landed.

- `tests/desktop/agent-chat.spec.js` "an audio result is an Audio tile; a missing one still says
  it did not finish": passes; against HEAD's chat file it FAILS (mutation-checked).
- `npm test`: 2415, 2413 pass, 0 fail, 2 skipped. eslint clean on the three files.

## Fabio's look, round 2 (2026-09-30, Agent 74)

- Checks 1 (scribble ask -> two buttons -> Scribble at "Draw it") and 2 (Object Stamp on "Cut it
  out") PASS.
- Lizard redo: Cosmo judged the RIGHT file (edit_009, describer gemma-4-26B-A4B on DeepInfra,
  ~1 MP); the general caption misplaced the lizard ("sits on the bow"). Fabio keeps retries; the
  fix is the read. The auto-look note now says the caption is general and to check the doubted
  point with `look` + a question (a fresh, focused read) before any redo. `tests/agent-loop` asserts
  it. Not proven live: needs one question-look on his DeepInfra key.
- Song, Fabio's new shape: no `agentOpens`; Cosmo asks `[options: Review lyrics | Just do it]`
  (app:flows). Review -> `open: true` -> opens on "Write the song" (an open with nothing missing
  now lands on the first step after Inputs, `flow.steps[0].kind`); Just do it -> it runs.
  `tests/agent-flow-handover.test.cjs` 9/9 incl. the Song open.
- Docs site agent page (`Cubric Studio (Docs)` pages/agent.html + regenerated agent/index.html,
  NOT pushed): models only are installed, a missing Flow is added from the Flow Library; the
  three open-for-you Flows and Song's ask. Website "Picks the right model and installs it": true.
- `npm test` 2416: 2414 pass, 0 fail, 2 skipped. eslint clean.
- OPEN: his Song run (opened by Cosmo at 17:22:51Z, Cue pressed) sat on "Starting" with nothing
  logged after the open: it never reached ComfyUI. Cause unknown from the log alone. Ruled out:
  the arch-weight confirm (a Flow run carries no modelId). He restarted; retry pending.
- After his restart, a FRESH chat ("a song about two Disney characters...") got "[declined] I
  can't make songs or any audio: I work with images and video only", no tool call. Cause: the
  prompt's first line, "a desktop AI image and video tool", older than the audio Flows; the
  Kaiju chat worked only because list_models was already in its context. Now "image, video and
  sound tool" (+8 bytes, SYSTEM still under 10,460). Not proven live.
- Live after the restart (Fabio's screenshots): the same fresh ask now reads app:flows and
  minimax-music's settings, writes the duet, asks `[Review lyrics | Just do it]`; "Just do it" ran
  it ("Starting generation", Vinyl composing, COMPOSING 1%). Check 3 PASS on the run path.
- Fabio: "I just tested review lyrics, and it works" (open on "Write the song", then his Cue ran).
  The earlier stuck "Starting" did not come back. Check 3 PASS on both paths.
- Found in the song's sidecar, filed as MPI-1002 (umbrella MPI-1000): Cosmo's Song run skips the
  enhancer and fills the caption blocks blind (Vocal empty, one "Duet" voice).
- Check 4 attempt ("give me a voice saying 'My name is Jimmy Jones...'"): Cosmo read Text to
  Speech (not installed), ignored the INSTALLED DramaBox (a package Flow: the catalogue carried
  only its title), and offered "[Install TTS flow | Skip it]", which it cannot do. Fixed: each Flow
  in list_models carries `does` (`flowDoes`: first clause of its description; DramaBox "Text to
  speech you direct in words"); `install_model` on a Flow id answers `IS_A_FLOW` (add it from the
  Flow Library); app:flows "Picking one, and one that is not installed". Tests: agent-loop +
  handover + budget + no-delete 177/0, eslint clean. Not proven live: needs his restart and the same ask.

## Fabio's look (Verify mode user-ux)

- 2026-09-30, check 1 ("make a scribble of a cat on a fence"): my test line was the wrong
  trigger. Cosmo read Scribble's settings and then ran Klein 9B with its Doodle style (log:
  `klein-9b:t2i styleSelect=5`), no `flow.open` sent. Fabio: that is the right route, and a
  better result. The Scribble trigger is the user wanting to DRAW ("can I give you a scribble and
  you turn it into a nice image?"). app:flows now says that in one paragraph.
- Fabio's shape for that ask: Cosmo answers "two ways, one Flow each" (Draw It In adds a scribble
  to an image, Scribble makes one from a drawing) as `[options: ...]` buttons, then opens the pick
  at its drawing step; "I've drawn it" gets "go to the last step and press Generate". In app:flows;
  the Flow rule now reads app:flows before an ANSWER about a Flow too (SYSTEM 10,423 / 10,460).

Not run through a real model: the loop's routing is unit-tested with a scripted model.

## Fabio's look, round 3 (2026-09-30, Agent 75)

- Check 4 PASS (screenshot): "audio of an elderly man saying '...'" with no sample: Cosmo read
  app:flows and DramaBox's settings, ran DramaBox (8 s, `flowDramaBox_001.flac`), Audio tile in the
  chat. No install offer.
- Check 5 attempt, Head Swap ("swap the head of the cyber girl with the girl with red eyes"):
  Head Swap is NOT installed on his machine (a paid Flow; `%APPDATA%/Cubric Studio/user_flows/`
  holds only drama-box), so "not installed" was right. Two wrong things in the answer, both text
  this card wrote: "its tile says Get models" (a paid tile says Get it) and "I can open the Flow
  Library for you" (no tool does). Fixed in app:flows (`docs/agent/flows.md`) and the Docs site
  agent page.
- Then "try an edit model": Cosmo offered to install Qwen Image Edit (31.8 GB); on "Try Klein9b"
  it said no editor here could take the head from the second picture, BEFORE reading Klein's
  settings (Klein edits take up to three references). Causes: the Model rule "A head from one
  picture onto another is the Head Swap Flow, never an edit or a mask", and Qwen's note "the only
  one that leaves everything outside the edit area untouched". Fabio's pick: remove the claim, add
  no tokens. The rule now ends "never a mask." (SYSTEM 10 bytes smaller); Qwen's note is "the
  slowest of these"; `tests/model-priority.test.cjs` asserts it no longer says "only one".
- Agent + model-priority + handover suites: 344, 343 pass, 0 fail. eslint clean.
- Fabio: the Klein 9B try (before these fixes) came out right. Cosmo looked, saw the wrong
  background, re-edited with the original one: two good results to pick from.
- His app restarted at 18:57:31Z, after these edits (18:53:53-58Z), with no restart since: the
  running app has them. Not proven live yet: the same head-swap ask.
- Live after the restart ("change the head of the girl holding the flowers to the head of the
  cyborg girl", edit_002 attached): no Get models, no Flow Library offer; Cosmo went to Klein 9B
  kleinEdit with both pictures (edit_004). Fabio: fine, it did what it could without Head Swap.
- edit_004 came back with a robot mask: Cosmo's prompt said "metallic cybernetic face", and
  edit_002's head is human (the metal is on the arms and torso). Fabio asked again; edit_005, same
  model, same two pictures, prompt "a natural human face ... Do not make her a robot", came back
  right. The words decided it. `docs/agent/models/flux-2.md` now says to describe a reference
  only as `look` saw it in that picture. Budget + loop suites 163/0.
- Memory: nothing about Head Swap saved (global memory empty; the project's character-notes.md
  holds one note). That note repeats the misread ("metallic cybernetic face plates"); it is
  Fabio's project data, left for him.
- Check 5 (a Flow that is not opened for the user still RUNS): DramaBox ran straight through in
  check 4, as did Song on "Just do it" in round 2. PASS. Fabio: "All is good."
