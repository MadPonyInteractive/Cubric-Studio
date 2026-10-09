/**
 * flowsRegistry.js — Source of truth for Flows (outcome flows, MPI-256).
 *
 * A Flow is an outcome-oriented workflow surfaced in the Flow Library
 * overlay: pick a flow → open its overlay → collect inputs → Run → the job enters
 * the EXISTING generation queue and lands as a normal gallery card.
 *
 * Unlike modelRegistry, this registry is READ-ONLY over install state — flows own no
 * install-sync machinery (no syncModelInstalled, no remoteEngineClient); they READ
 * caches the model sync already populates. Do not cargo-cult the sync side here.
 *
 * Availability has TWO inputs (MPI-304):
 *   - `requiredModels` → `state.s_installedModelIds` (already isModelUsable-filtered, MPI-122)
 *   - `requiredDeps`   → the per-dep status cache, keyed `flow:<id>` (modelRegistry.js)
 * Both gate the SAME badge and the SAME Run guard — a missing dep blocks exactly like a
 * missing model, and surfaces as one extra row in the slide-over's required list.
 *
 * Flow count is small (the dev-gate came off in MPI-589), so the descriptor array lives
 * inline here rather than in a separate flowConstants/ file. Split it out only if the
 * array grows large enough to warrant it.
 *
 * @typedef {Object} FlowDef
 * @property {string}   id             - Unique identifier
 * @property {string}   title          - Display name (card + slide-over)
 * @property {string}   preview        - 4/5 still (webp) under comfy_workflows/display/. Drives the
 *                                       Flow Library tile and the slide-over thumb, and doubles as
 *                                       the hero's poster + fallback. docs/playbooks/add-flow/06.
 * @property {string}   [video]        - WIDE (8:5 or 16:9) autoplaying loop under the same folder —
 *                                       the HERO on the flow's first slide only. Unlike a ModelDef's
 *                                       `video`, this never turns the tile into a video tile: the
 *                                       tile stays the 4/5 still. Omit and the hero shows `preview`.
 * @property {string}   description    - Slide-over copy
 * @property {Array<string|{label: string, models: string[]}>} requiredModels - MODEL ids (NOT dep
 *                                       ids); drives the availability badge. Each entry is a SLOT
 *                                       — one ROLE the graph plays a model in. The object form
 *                                       makes that role choosable: `models` are interchangeable
 *                                       candidates for it, the flow runs on whichever one resolves,
 *                                       and the badge is satisfied by any of them (MPI-590,
 *                                       generalised to N slots x N candidates in MPI-599). A plain
 *                                       string is the one-candidate shorthand, which is most flows.
 *                                       `models[0]` is the RECOMMENDED candidate — declaration
 *                                       order is preference order, and the picker stars it.
 *                                       A flow may declare SEVERAL choosable slots; the scribble
 *                                       flow picks an SDXL checkpoint for its render phase and an
 *                                       edit model for its blend phase, independently.
 *                                       Resolve the list through `flowModelIds()` — never read the
 *                                       raw array, or a slot reaches a consumer as an object.
 * @property {Object<string, Object>} [modelParams] - Per-MODEL injection params, merged into the
 *                                       run's `injectionParams` for whichever candidate of each
 *                                       slot is running (MPI-590). This is what makes the picker
 *                                       REAL: without it the choice changes the badge and nothing
 *                                       else, because the graph's loader is baked. Every resolved
 *                                       slot contributes, so a two-slot flow injects both phases'
 *                                       models from one merge. Keys are ordinary injection keys,
 *                                       so `Title.widget` addressing works. Flow-local on purpose
 *                                       — the two Krea2 cards differ by a transformer file and a
 *                                       bypass strength, and that is knowledge about THIS graph,
 *                                       not a registry concept.
 * @property {string[]} [requiredDeps] - DEP ids (dependencies.js facade) this flow needs on top
 *                                       of its models — flow-only weights/nodes that no model
 *                                       requires. Filed in the dep file for their KIND, never
 *                                       folded into a model's list (that taxes every user of
 *                                       that model). MPI-304.
 * @property {string[]} [requiredPlugins] - PLUGIN ids (pluginsRegistry.js) this flow needs
 *                                       (MPI-580). Their deps fold into this flow's dep set,
 *                                       so they gate the same badge, the same Run guard and
 *                                       the same install button — a plugin has no install
 *                                       state of its own to check. Declared when a flow
 *                                       ADOPTS a capability that also stands alone, e.g. the
 *                                       Video face detailer adopting the LTX Video upscaler.
 * @property {string}   operation      - Universal-op key (commandRegistry.js)
 * @property {string}   workflow       - ComfyUI workflow filename (universal_workflows.js)
 * @property {string}   [disabledReason] - Set only on a Flow PACKAGE that failed validation
 *                                       (MPI-532, js/services/userFlowService.js): it is listed,
 *                                       never runnable, and this is the reason shown.
 * @property {FlowStepField[]} [fields] - Run-slide fields, rendered BY THE FRAME. THE SAME `fields`
 *                                       a step declares (MPI-572) — declaring them here places them
 *                                       on the run slide, declaring them on a step places them on
 *                                       that step, and nothing else differs: one vocabulary, one
 *                                       renderer, one payload law. An id reaches the op as a
 *                                       top-level input (`positive`, `negative`), EXCEPT an id
 *                                       prefixed `Input_`, which names a graph node and is routed
 *                                       into `injectionParams` instead. So
 *                                       `{ id: 'positive', type: 'text', rows: 3 }` is the whole of
 *                                       what a prompt-collecting component used to be. A FlowDef is
 *                                       DATA (MPI-572), which is what makes it expressible as a
 *                                       third-party manifest — but declaring a field does NOT mean
 *                                       there is no component. Every declared field MOUNTS AN APP
 *                                       PRIMITIVE (MPI-582); the declaration chooses which one, it
 *                                       does not replace it. See FlowStepField below.
 * A `requiredModels` SLOT may carry `loras: true` — see `flowLoraPhases()`. That slot's
 * running model then contributes its USER LoRA RACK to the graph's
 * `Input_Lora_Phase<N>_<i>` nodes, where N is the slot's 1-based position, and the slide-over
 * shows a cogwheel opening that model's Model Settings panel. It is NOT a model selection —
 * a flow still dispatches as an operation with `model.id: null`, and this never reaches
 * model resolution or workflow lookup.
 *
 * OPT-IN, and it must stay that way: `flow_ltx_extend` and `flow_ltx_foley` both carry
 * `Input_Lora_1..6` nodes while deliberately declaring no rack, so filling every slot whose
 * graph HAS the nodes would silently start injecting the user's LTX LoRAs into two shipped
 * flows. The rack is the model's OWN settings, shared with its ordinary generations — the
 * same LoRA is the same LoRA whether the flow or the prompt box runs it. Flat-slot models
 * only; a `loraStages` model warns and is skipped rather than injected in the wrong shape.
 *
 * This replaced a single `settingsModel` string (MPI-504 → MPI-608). One string could name
 * only one rack, so a flow choosing a model PER PHASE could never fill both of them.
 * @property {'image'|'video'|'audio'} mediaType - What the flow PRODUCES. Decides the gallery
 *                                       card, the save path and the group type. `'audio'` became
 *                                       legal in MPI-573, for the music / TTS / voice-clone flows
 *                                       — such a flow's graph names its SaveAudio node
 *                                       `Output_Audio`, the same title a video's soundtrack uses,
 *                                       and the declared mediaType is what tells the two apart.
 * @property {'create'|'edit'|'enhance'} type - What the flow DOES to its media: `'create'`
 *                                       makes new stuff, `'edit'` changes existing stuff,
 *                                       `'enhance'` improves existing stuff. Exactly one of
 *                                       the three (always required).
 * @property {Object}   inputSchema    - What the flow collects → injected into the workflow
 * @property {{compare?: string}} [result] - How the RESULT is presented. `compare` names the media
 *                                       ROLE holding the BEFORE — the frame then shows the result
 *                                       on the shared before/after surface (MpiCompareView) with a
 *                                       draggable reveal bar instead of a plain element (MPI-585).
 *                                       Declare it on any flow that IMPROVES media the user
 *                                       supplied; one declaration covers video and image alike.
 *                                       OMIT when a comparison would say nothing — a flow that
 *                                       returns the same pixels (foley) or whose output is not the
 *                                       same footage (an extend is LONGER than its source). The
 *                                       frame falls back to the plain element on its own when the
 *                                       named media is gone or the run produced several outputs.
 * @property {FlowStep[]} [steps]       - Declared MIDDLE steps of the flow's carousel (MPI-306).
 *                                       Step 0 (inputs) and the last step (run) are IMPLICIT —
 *                                       the frame renders them from inputSchema + the flow's
 *                                       fields. Omit or `[]` for a 2-step carousel. A flow writes
 *                                       NO layout code: MpiBaseFlow renders every declared step.
 * @property {string}   [agentOpens]   - How the in-app agent uses this flow (MPI-892, Fabio
 *                                       2026-09-30). OMIT and the agent runs it. Set, the agent
 *                                       never runs it: it fills what it can and OPENS the flow on
 *                                       the user's screen at this step — a middle step's `kind`
 *                                       (`'paint'`: the user draws), or `'run'` for the Generate
 *                                       step (filled for the user to check and press). For a flow
 *                                       that needs the user's hands, or a result the user should
 *                                       read before the GPU spends. A required input the agent
 *                                       lacks still opens it on the inputs step instead.
 * @property {string}   [agentReview]  - A field id (MPI-1005). The agent's run of this flow
 *                                       first raises a card in the chat showing that field's
 *                                       text, with Review (opens the flow, as `agentOpens`) and
 *                                       Just do it (runs it). The click acts; no agent turn.
 * @property {{operation: string, when?: string, input?: string}} [chain] - A SECOND job run on
 *                                       leg 1's completion (flowService.js § TWO-LEG FLOWS):
 *                                       `operation` picks leg 2's graph. `when` names a declared
 *                                       field; off, the run is leg 1 alone (MPI-997). `input` is
 *                                       the media role leg 2 receives leg 1's picture on, and it
 *                                       makes leg 2 land as the next version of leg 1's card.
 *
 * @typedef {Object} FlowStep
 * @property {string}  kind    - STEP_KINDS registry key (MpiBaseFlow/stepKinds.js), e.g. 'box'.
 *                               A new gizmo = one component + one registry line. The FRAME-NATIVE
 *                               kinds (FRAME_KINDS, same file) are the exception: `fields` has no
 *                               component, no gizmo and NO `role` — its declared `fields` ARE the
 *                               work, stacked where the canvas would be, and its values live in
 *                               the FLOW-level store so one prompt can be edited on the step and
 *                               on the run slide as a single value (MPI-504). The one-row cap does
 *                               not apply to it: that cap exists because the row is a modifier on
 *                               a canvas, and this step has no canvas.
 * @property {string}  role    - The MEDIA ROLE this step operates on ('image1', 'image2'…) —
 *                               the same vocabulary the op's mediaInputs uses, so a box for
 *                               `image1` reaches `Input_Box` with no new mapping.
 * @property {string}  title   - Shown above the canvas.
 * @property {string}  [hint]  - Guidance shown below the canvas (and below any fields row).
 * @property {string}  [tickerLabel] - Short label for the step ticker; falls back to `title`.
 * @property {number}  [maxGrow] - `crop` only (MPI-900): the most one pass may add on a
 *                               side, as a fraction of the picture it starts from. A frame
 *                               past it runs as several passes, each on the previous result
 *                               (`utils/outpaintPasses.js`). Omit for one pass whatever the size.
 * @property {string}  [mediaRole] - Where a STEP_MEDIA kind's derived FILE lands, when that
 *                               is not the role it operates on (MPI-567). Omit and the file
 *                               REPLACES the step's own media, which is what `crop` wants — a
 *                               padded picture supersedes the picture it padded. `paint`
 *                               wants the opposite: the user draws on the photo and the graph
 *                               needs BOTH, so the layer is declared into its own slot and
 *                               the frame APPENDS it. The named role must be one the op's
 *                               `mediaInputs` declares, or the file reaches no node.
 * @property {string}  [param] - Bind this step's GIZMO value to an injection param (MPI-572).
 *                               The flow says WHICH role feeds WHICH node (that is flow
 *                               knowledge); the KIND supplies the shape the graph wants
 *                               (`stepValueToParam`, stepKinds.js). Omit and the step reports
 *                               into `stepValues` only. A gizmo with nothing to report sends
 *                               nothing, leaving the node on its baked default.
 * @property {number}  [ratio] - Aspect lock for the gizmo (UI-only; the graph's width/height
 *                               are independent). Omit for a free box.
 * @property {FlowStepField[]} [fields] - ONE row of controls between canvas and hint, rendered
 *                               BY THE FRAME so every gizmo's controls match for free. HARD CAP:
 *                               one row, no nesting/panels/accordions — a gizmo wanting more
 *                               means the step should SPLIT.
 *
 * @typedef {Object} FlowStepField
 *
 * EVERY TYPE BELOW MOUNTS AN APP PRIMITIVE (`js/utils/declaredFields.js`, MPI-582).
 * `type` names a component, it does not replace one:
 *   select -> MpiDropdown · radio -> MpiRadioGroup · button -> MpiButton ·
 *   toggle -> MpiButton (icon mode, toggleable) · number, text -> MpiInput ·
 *   slider -> MpiProgressBar
 * So a consumer block sizes these into its layout and NEVER restates their fill,
 * border, hover, focus or disabled treatment. A control this vocabulary cannot
 * express is a NEW PRIMITIVE plus a new `type` here — never a bare input, in a Flow
 * or anywhere else. See `.claude/rules/components.md` § Every UI element is a
 * component.
 *
 * @property {string}  id      - Key the value lands under, and it is the SAME key wherever the
 *                               field was declared: `id: 'positive'` reaches the op as `positive`,
 *                               `Input_*` reaches it inside `injectionParams`. A step's fields are
 *                               additionally mirrored under that step's role in `stepValues`,
 *                               which is the shape Reuse restores from.
 * @property {'select'|'radio'|'button'|'toggle'|'number'|'slider'|'text'} type
 * @property {string}  [label]
 * @property {Array<{v:string|number, label:string, info?:string, note?:string}>} [options] -
 *                               For `select` / `radio`. `radio` emits the option's ORIGINAL `v`,
 *                               so a numeric graph param stays a number. `info` is a status-bar
 *                               hover; `note` is the always-visible line under the group — a
 *                               tier's cost has to be legible without hunting for it.
 * @property {number}  [columns] - For `radio`: render as an N-column grid.
 * @property {number}  [min]   - For `number` / `slider`. ENFORCED, not decorative:
 *                               the value is clamped before it reaches the graph.
 * @property {number}  [max]   - For `number` / `slider`.
 * @property {number}  [step]  - For `number` / `slider`.
 * @property {string}  [icon]  - For `button` and `toggle`: an `js/utils/icons.js` key, rendered to
 *                               the LEFT of the label. The button itself is an MpiButton in the
 *                               app's primary variant — never restyle it from a consumer block.
 *                               OPTIONAL on a `toggle`, which falls back to a tick; a `toggle`
 *                               shows its label on its own face either way, so neither type ever
 *                               gets a caption printed above it.
 * @property {boolean} [blankOnly] - STEP FIELDS ONLY. The field is DISABLED whenever that step's
 *                               media role is filled, because it only describes what to do when
 *                               there is no source picture. Scribble's canvas size is the case: it
 *                               sizes a BLANK canvas, and an uploaded drawing brings its own size,
 *                               so once a slot is filled the control has nothing to act on. Chosen
 *                               over a general `showWhen` expression (MPI-620) — one boolean with
 *                               one meaning, against a predicate language the frame would then own
 *                               forever. Honoured on `select` today; see `declaredFields.js`.
 * @property {number}  [rows]  - For `text`. `> 1` renders a textarea (the prompt case).
 * @property {string}  [placeholder] - For `text`.
 * @property {Array<{tag:string, label?:string}>} [tags] - For `text`: gives the box an `@` picker
 *                               offering this CLOSED list, inserting the pick in SQUARE brackets
 *                               on its own line (MPI-664). Opt-in per field — `declaredFields.js`
 *                               builds every text box in every flow, so an unconditional picker
 *                               would land on Sound & Music's "Describe it" and Voice notes too
 *                               (Fabio, 2026-09-10: *"only the lyrics box gets it"*).
 *                               🔴 THE LIST IS DECLARED HERE, NOT POINTED AT. A `mentions` key
 *                               naming a sibling field shipped first and was removed the same
 *                               week: it offered the voice roster and inserted `<Singer A>`, which
 *                               `Strip_Voice_Markers` cuts before the encoder, so it reached no
 *                               model at all. Only put a list here that the graph actually reads.
 * @property {*}       [default]
 * @property {'enhance'} [action] - Makes a `button` an ACTION rather than a value
 *                               (MPI-504). An action's own id never reaches the op, and it stores
 *                               nothing.
 *                               A `settings` action existed here and is GONE (MPI-608): it opened
 *                               the rack for the flow's single `settingsModel`, which cannot
 *                               express a flow with a model per phase. The per-slot cogwheel on
 *                               the run slide replaces it (MPI-638) — same panel, addressed per
 *                               phase, mounted by MpiBaseFlow itself.
 *                               `enhance`
 *                               runs `op` on the `from` field's text and writes the result into
 *                               the `to` field. ONE declaration carries all three behaviours —
 *                               Enhance fills `to`, editing `from` CLEARS `to`, and the button
 *                               reports which of those is true (heat = not enhanced) — so
 *                               they cannot disagree. Two more consequences fall out of it: an
 *                               empty `to` at Run sends `from` RAW (there is no silent
 *                               enhancement), and the action's own id never reaches the op.
 *                               Declare the pair on BOTH surfaces to get the run slide's
 *                               condensed form; the value is shared either way.
 * @property {string}  [op]    - For `action: 'enhance'`: the universal-op key to run. It must be
 *                               an `outputKind: 'text'` op — it reports through `onText` and
 *                               lands no history item. An unregistered key warns and no-ops.
 * @property {string}  [from]  - For `action: 'enhance'`: id of the field supplying the text.
 * @property {string}  [to]    - For `action: 'enhance'`: id of the field the result is written
 *                               into. Enhance is its ONLY writer besides the user.
 * @property {string}  [model] - For `action: 'enhance'`: optional model id for the run. Omit for
 *                               an op whose weights are a dep rather than a ModelDef.
 * @property {Object<string, *>} [injectionParams] - For `action: 'enhance'`: params injected into
 *                               the enhancer's OWN graph on every press (MPI-664). This is what
 *                               makes `promptEnhance` the reusable op it has claimed to be since
 *                               MPI-504 — its recipe (`Input_System_Prompt`), both scrub patterns
 *                               and `Input_Text_Gen.max_length` are all meant to be the CALLER's,
 *                               so a second flow supplies its own rewrite rather than registering
 *                               a twin op. Without it the graph's BAKED recipe runs, and that
 *                               recipe is Character Sheet's: press Enhance on a music flow and a
 *                               character designer writes a wardrobe phrase. Ordinary injection
 *                               keys, so `Title.widget` addressing works.
 *                               `Input_Seed` is NOT settable here — the frame spreads its driven
 *                               seed last, because a fixed one returns the same phrase on every
 *                               press and the Enhance → Generate → Enhance loop is the point.
 */

'use strict';

import { state } from '../state.js';
import { DEPS } from './modelConstants/dependencies.js';
import { getPlugin } from './pluginsRegistry.js';
import { MODELS } from './modelConstants/models.js';
import { OUTPAINT_MAX_GROW } from '../utils/outpaintPasses.js';

/**
 * The download-queue / dep-status key for a flow's own deps. Namespaced so it can
 * never collide with a model id, and so every consumer that sees a job id can tell
 * flow-owned deps from model-owned ones. MPI-304.
 * @param {string} flowId
 * @returns {string}
 */
export function flowDepKey(flowId) {
    return `flow:${flowId}`;
}

/**
 * The MiniMax Music enhance action's injected params (MPI-664) — the recipe, both
 * scrub overrides and the raised token budget.
 *
 * Hoisted from a time when the `enhance` pair was declared twice — once per surface
 * that carried an Enhance button — and two copies of a 15-line recipe is two recipes
 * that drift. There is one declaration now (`flow.enhance`, MPI-664); the constant
 * stays hoisted because a 40-line recipe inline in a FlowDef buries the fields either
 * side of it.
 *
 * THE INPUT IS A LABELLED BLOCK, not a bare sentence (MPI-664). `from` names three
 * fields — the brief, the style phrase and the Instrumental flag — and the frame
 * sends them as `Label: value` lines, dropping the empties. That is why the recipe
 * can tell the model the genre is already written for it, and why the instrumental
 * rule can be stated as a plain condition: the word arrives on its own line or not
 * at all.
 *
 * WHY EACH KEY IS HERE:
 *
 * `Input_System_Prompt` — the graph parses `[MOOD]` / `[VOCAL]` / `[ARRANGEMENT]`
 * with three `RegexExtract` nodes, so emitting those three markers IS the contract.
 * The recipe never names the genre or the BPM: the graph writes those from the
 * controls, and a 4B asked to carry "78 BPM" through prose rounds it to "around 80".
 * Short and single-task is what a 4B holds. The KEY is the exception — no control
 * sets one, MiniMax's own template carries "D flat major, major scale with jazzy
 * extensions", so letting the model name one is additive rather than a fabrication
 * of the user's intent.
 *
 * 🔴 IT ASKS FOR A CAPTION, NOT PROSE (MPI-664, 2026-09-03), and the first version
 * got this backwards in two rules at once: it opened with "three prose blocks" and
 * then said *"write musical changes, never an equipment list"*. **MiniMax's own
 * shipped template IS an equipment list** — *"dusty boom-bap drums with a soft
 * thumping kick, cracked snare with lazy swing, brushed hi-hats, low round sub
 * bass"*, with `Intro:` / `Verses:` / `Bridge:` / `Outro:` as literal labels and
 * "Rhodes" named in five separate sections. So the recipe was forbidding exactly the
 * register the model was trained on. The 4B obliged with literary prose, and a live
 * run proved the cost: Fabio asked for a viola section, an orchestral drum, a piano
 * and a choir, and the caption delivered them as ~3 literal tokens each wrapped in
 * twenty of metaphor ("their strings vibrating with a cold, metallic resonance that
 * feels like the earth groaning beneath a collapsing sky"). The model fell back on
 * its orchestral prior and played flutes. Repeating each instrument name per section
 * is part of the same fix — the old caption wrote "the percussion becomes a ghost, a
 * memory", at which point the drum has stopped being called a drum.
 *
 * `Input_Scrub_Negation` is DISABLED with `(?!)`, a pattern that can never match. Its
 * baked value strips negation clauses out of a Character Sheet noun phrase, and on a
 * music caption it would eat "no drums until the second verse" — a real arrangement
 * instruction. Overriding it to a no-op is safer than deleting the node, which
 * Character Sheet still needs.
 *
 * `Input_Tidy` is narrowed to trailing whitespace. Its baked `[\s,.]+$` also eats a
 * closing full stop, which is right for a phrase spliced mid-sentence and wrong for
 * three prose blocks.
 *
 * `Input_Text_Gen.max_length` — 512 tokens cannot hold 250-450 words. That widget sits
 * on the shared enhancer graph's `TextGenerate`, which was UNTITLED until this card;
 * Character Sheet keeps 512 by not injecting, so titling it was purely additive.
 *
 * Not a concern, though it looks like one: the enhancer's `StringReplace` flattens the
 * output to a single line. The three blocks are delimited by their MARKERS, not by
 * newlines, so the parse is unaffected — and one line per block is the shape a caption
 * paragraph wants anyway.
 */
const MINIMAX_MUSIC_ENHANCE_PARAMS = {
    Input_System_Prompt: [
        '<|im_start|>system',
        'You are a music producer writing three caption blocks for a text-to-music model, and nothing else.',
        '',
        'The user message is a short brief, optionally followed by a "Style:" line. Treat all of it as the description of one song.',
        '',
        'REGISTER — this is a caption, not prose. Write comma-separated noun phrases and fragments, the way a producer labels a track: the instrument, then its qualities — register, articulation, tone, room. Name every instrument literally, and name it again in each section it plays. No similes, no metaphors, no "like a...", no scene-setting sentences, no sentences about what the music resembles or where it would be heard.',
        '',
        'EVERY INSTRUMENT MUST COME FROM THE USER. Never take one from these instructions. Where the user names instruments — in the brief, or in a Song structure — THAT LIST IS CLOSED: name no others in any block, and add nothing "to fill it out". Where they name none, choose instruments that suit the brief and keep the set small.',
        '',
        // 🔴 THE CAST RULE, AND IT FIXED A REAL DEFECT (MPI-664, 2026-09-11). Until this
        // card the roster never reached the enhancer at all, so it wrote "[VOCAL] Female
        // lead … no harmonies, no ad-libs, no layered backing vocals" over Fabio's own
        // two-singer cast and the caption's LAST clause won. It is worded as a positive
        // instruction — name them, carry the notes through — with one prohibition, the
        // one the defect actually needed. The recipe's habit of teaching by negation is
        // a known cause of the 4B's repetition loop; do not answer a new defect here
        // with another "No X" line.
        //
        // 🔴 SECTION PLACEMENT WAS THE SECOND HALF OF THE SAME DEFECT (2026-09-12).
        // Fabio wrote "Soft smooth voice playing in the intro and chorus" / "Harsh and
        // raspy rock vocal playing in the verse and the chorus"; the 4B kept both
        // timbres and deleted both placements. It was obeying: the carry-through list
        // here read "timbre, delivery, harmonies or backing vocals" — a closed list
        // that placement was not on — and the older "never invent a running order"
        // rule pushed the same way. That rule exists because two runs had the 4B
        // writing TIMED plans nobody asked for, so it stays; what changed is that it
        // now says never INVENT one, which was always the point.
        'THE CAST COMES FROM THE USER THE SAME WAY. A "Voices:" line lists every singer on its own line as Voice N (Type), where a bare label means the user left the type open. Write [VOCAL] for exactly that cast: give each voice its own phrases, and where a "Voice notes:" line describes timbre, delivery, harmonies, backing vocals OR WHICH SECTIONS A VOICE SINGS, carry those words through into your phrases. A placement the user wrote — "the female in the intro and chorus", "Voice 2 takes the verse" — is theirs and belongs in [VOCAL] in their terms; you are forbidden from INVENTING a running order, never from carrying one they gave you. THAT LIST IS CLOSED IN BOTH DIRECTIONS — introduce no singer they did not cast, and leave none of theirs out. Never state that the track lacks a vocal the user asked for.',
        '',
        'Output EXACTLY three blocks, in this order, each opening with its marker on the same line:',
        '[MOOD] Feel and listening occasion in a few phrases, then the production texture: mix, room, grain. Name no instruments here and do not describe the running order.',
        '[VOCAL] Timbre, delivery, backing vocals and any section placement the user gave, as phrases, covering every voice in the cast. Where the cast holds more than one voice, open on the cast itself — never on a single summary vocal, which reads as the whole track having one singer.',
        '[ARRANGEMENT] Open with the core instrument bed as one list, then describe how that bed develops and what carries each part, in phrases. Write no section lines and name no sections.',
        '',
        'Rules:',
        '- 250 to 450 words in total, weighted towards [ARRANGEMENT].',
        '- Do not invent a BPM, a time signature or a named artist. Do not name the genre — it is written for you. You MAY name a key and scale.',
        '- Do not write lyrics, bracketed tags such as [Verse], or any text outside the three blocks.',
        // 🔴 THE RULE THAT FIXED A REAL DEFECT — keep it whatever else changes here. The
        // 4B was writing a complete TIMED plan nobody asked for ("At 1:20, the strings
        // enter… By 2:15, the full orchestra erupts") while the user's own sections sat in
        // the lyrics slot. The caption OUTRANKS the lyrics slot, so the model played the
        // 4B's song. The running order is the user's to state, in their lyrics, and the
        // rewriter's job stops at texture.
        '- NEVER invent a running order, a section list or a timing of your own. No clock times such as "at 1:20" or "by 2:15", in any block.',
        '<|im_end|>',
        '<|im_start|>user',
    ].join('\n'),
    'Input_Scrub_Negation.regex_pattern': '(?!)',
    'Input_Tidy.regex_pattern': '\\s+$',
    // 1400 -> 800 (Fabio, 2026-09-10). The cap is a GUARD, not the budget: the rules
    // above ask for 250-450 words, and 450 words is ~620 tokens, so 800 leaves ~30%
    // headroom for a legitimately long [ARRANGEMENT] while halving the worst case.
    //
    // 🔴 WHAT IT GUARDS AGAINST, MEASURED: the 4B degenerated and ran to the FULL 1400
    // tokens — 6,606 characters, 106.81 s — with the tail an unbounded repetition loop
    // ("No instrumentation changes after the last 30 seconds." over and over; the run
    // before it was "No clipping." x21, and THAT graph errored). Fabio saw it as a
    // 1400/1400 progress bar and a 90-second wait for a caption.
    //
    // The cap alone does not fix it and is not meant to — the real fix is the sampler's
    // `repetition_penalty` 1.05 -> 1.15 and `presence_penalty` 0 -> 0.6, in the shared
    // enhancer graph (`comfy_workflows/qwen3vl_4b_prompt_enhancer.json`), because
    // anti-degeneration is every caller's problem, not this recipe's.
    //
    // 🟡 AND THE WORD BUDGET ABOVE IS ITSELF A CAUSE. Three honest blocks for a simple
    // brief come to ~200 words; told to reach 250-450, the model pads, and it pads in
    // the register these instructions taught it — a stack of "No similes, no metaphors,
    // no scene-setting". `No X` is self-similar and has no natural end. Rewriting the
    // recipe to stop teaching by negation is the root fix and has NOT been done.
    'Input_Text_Gen.max_length': 800,
};

// MPI-1036: what Video Edit asks the describer picked in Remote about its picture. A question
// REPLACES the describer's own instruction on both backends, so the reply shape rides in it.
// The asks are the bench's (tasks/MPI-1036/research/bench/flow_graph.py CAPTION_ASK).
const VIDEO_EDIT_PERSON = 'the main person: apparent age and gender, face and skin, hair colour, length and style, and every garment and accessory with its colour';
const VIDEO_EDIT_PLACE = 'the place: the kind of room or location, its main furniture and objects, its surfaces and colours, and its light';
const videoEditAsk = what => `This picture is a reference for a video edit. ${what} Reply with one or two plain sentences of concrete visual facts, starting at the subject: no preamble, no opinions, and only what is there.`;

/** @type {FlowDef[]} */
export const FLOWS = [
    // head-swap and drama-box LEFT THE APP (MPI-781, umbrella MPI-780 phase 2). They are
    // sold as Flow packages, authored in their own repo under their own licence — never in
    // this AGPL tree. They install into `user_flows/` and register as `user:head-swap` /
    // `user:drama-box`. Comments below still cite them as worked examples ("the head-swap
    // shape"); the shape is what is being cited, and it is unchanged.
    //
    // Their deps STAY in the registries (assetDeps.js, nodesDeps.js, pluginsRegistry.js) —
    // a package may only name ids the app declares, and the orphan sweep reads DEPS.
    // MPI-520 — the first Flow authored with no component at all. Its three controls
    // are DECLARED (MPI-531), so the whole descriptor is data a third-party manifest
    // could carry. Do not reach for a component to gain a knob; add the field type.
    //
    // Runs on the already-installed LTX 2.3 checkpoint — no ModelDef, no dep entry.
    // `ltx-23-balanced` specifically: the bench-proven graph bakes the int8
    // transformer (UNETLoader → ...int8_convrot.safetensors), so the High card's
    // bf16 weight would not satisfy it. One tier, one workflow file — revisit if the
    // Flow Library ever leaves the dev gate with only the High card installed.
    {
        id: 'ltx-extend',
        title: 'Extend Video',
        // Both cut from a real extend run and its kept source (2.334s in, 4.042s out —
        // verified as the same shot by PSNR before building on it). What this flow
        // changes is LENGTH, so the hero plays the RESULT straight through under a
        // progress rail: the source's 57.7% in `--ink-3`, a mark where it ended, and
        // the rail running past it in `--accent-heat` — the added seconds are the
        // payload, so they are the only thing wearing the accent. The tile is that
        // rail complete, over the walk it bought.
        preview: 'flow-ltx-extend.webp',
        video: 'flow-ltx-extend.mp4',
        description: 'Continue a video past its last frame. Drop a clip, describe what happens next, and the model generates the new seconds — with matching audio — onto the end of it.',
        // MPI-591 — the first slot whose members do not share a graph. `modelParams` cannot
        // express it: LTX 2.3 and MiniMax H3 extend with different node sets end to end, so
        // the choice is resolved in `universal_workflows.js` (`flowLtxExtend.byModel`) and
        // reaches the executor as `flowModelIds`. LTX stays FIRST because it is the
        // recommended candidate the picker stars, and what every existing extend ran on.
        // MPI-591 Phase 8 (2026-09-27): the H3 candidate is 'minimax-h3' — the fl2va DiT —
        // NOT ref2va. The graph was rewired to fl2va + MpiH3MaskedPrefix, and the id names
        // the dep set that supplies its transformer and its fl2v turbo LoRA. A user who
        // already has base H3 gains this flow with no download; a ref2va-only user gets a
        // 19.53GB one. Both H3 ModelDefs share the same licence descriptor, so the consent
        // gate does not re-fire either way.
        requiredModels: [{ label: 'Model', models: ['ltx-23-balanced', 'minimax-h3'] }],
        operation: 'flowLtxExtend',
        // The LTX graph. The H3 arm's file is NOT named here — `byModel` owns that, and this
        // field is read only by the tests that check declared fields against node titles.
        workflow: 'flow_ltx_extend.json',
        mediaType: 'video',
        type: 'create',
        inputSchema: {
            media: [
                { type: 'video', mode: 'upto', max: 1, roles: ['video1'], labels: ['Video to extend'] },
            ],
        },
        // Nothing is MARKED on the clip, but the user still has to see it: step 0
        // loads media at thumbnail size, so a `preview` step is the first point at
        // which they can judge the take they are about to continue — and the prompts
        // belong with it, written while watching the last seconds they are describing
        // past. 3-step carousel (supply → describe → run).
        //
        // A step's fields reach the op exactly as a flow-level one does (MpiBaseFlow
        // `_collectInputs` folds `stepValues[role].fields` into the same `declared` /
        // `injectionParams` bins), so this is a placement change, not a payload one.
        steps: [
            {
                kind: 'preview', role: 'video1',
                tickerLabel: 'Describe',
                title: 'Describe what happens next',
                fields: [
                    {
                        id: 'positive', type: 'text', rows: 3, label: 'What happens next',
                        placeholder: 'Describe the new seconds — action, camera, sound…',
                    },
                    {
                        id: 'negative', type: 'text', rows: 2, label: 'Avoid',
                        // The bench-proven negative, kept as the default because it is what
                        // the approved runs used — an empty box here is a different graph.
                        default: 'letterbox, black bars, cinematic bars, pillarbox, border, vignette, blurry, low quality, still frame, frames, watermark, overlay, titles, unrealistic, plastic, fake, out-of-focus, low-detail, slow motion',
                        // MPI-591: this box does NOTHING on the MiniMax H3 arm — H3 takes no
                        // negative conditioning (models.js `negativePrompt: false`) and
                        // flow_h3_extend.json carries no Input_Negative node, so the injector
                        // skips the title in silence. The model rule (MPI-591) is what takes
                        // it off screen there; MPI-664's `{ field, is }` could not, because it
                        // keys on another FIELD's value rather than on the pick.
                        hiddenWhen: { model: 'minimax-h3' },
                    },
                ],
            },
        ],
        // Declared fields — rendered by MpiBaseFlow on the run slide (that is what
        // declaring them HERE rather than on a step means), each value reaching the op
        // under its own id. `Input_Duration` is an injection param, so it is named for
        // the graph node it writes.
        fields: [
            {
                // Seconds of NEW video, snapped to whole latent frames by the graph
                // (MpiMath `floor((a*b+0.5)/8)*8/b` off the source's own fps). A
                // slider because it is a bounded coarse choice, not a typed number.
                id: 'Input_Duration', type: 'slider', label: 'Seconds to add',
                min: 1, max: 10, step: 1, default: 4,
            },
            {
                // MPI-591 4b. The H3 graph gates its whole sampler path off one
                // `MpiSimpleBoolean` — SigmaShift vs EasyCache, beta/6 vs simple/25,
                // euler vs res_multistep, and the turbo LoRA at 1.0 vs 0.2. Phase 3
                // baked the turbo side; this exposes the other one.
                //
                // DEFAULT TRUE, and it stays true: non-turbo is 25 steps against 6.
                //
                // The LTX arm's graph has no such node, so the injector would skip the
                // title in silence and the toggle would sit there doing nothing — hence
                // the model rule rather than a comment apologising for it.
                id: 'Input_is_Turbo', type: 'toggle', label: 'Turbo', icon: 'bolt',
                default: true,
                hiddenWhen: { modelNot: 'minimax-h3' },
            },
            {
                // MPI-591 Phase 8. How much of the source the extension is SHOWN, written
                // into the front of the latent and masked out of sampling by
                // MpiH3MaskedPrefix. Not a free number: the node snaps DOWN to 39 / 90 /
                // 141, the only lengths that sit on H3's 17k+5 video grid AND divide by 3,
                // so audio's 40 Hz clock lands on a whole step too. 56 frames — the value
                // the bench arms used on the third-party MotionContext node — satisfies the
                // video grid but NOT the audio one, which is why it is absent here.
                //
                // DEFAULT 39, measured (both arms native 1920x800, same seed, same prompt,
                // 2026-09-27). 39 preserves 1.625 s and continues the shot as the prompt
                // describes it. 90 preserves 3.75 s and, when that window contains a shot
                // change, the model COPIES the edit: the 90 arm cut back to the source's
                // earlier wide shot and held it for all 102 generated frames, against a
                // prompt that asked for none of that. More context is not better, it is
                // more imitative — so the richer setting is something the user reaches for
                // deliberately, and 141 is offered for the same reason.
                //
                // The old graph hardcoded 39 with nothing guarding a shorter source. Now the
                // stitch offsets read the node's OWN snapped count, so asking for more than
                // the clip holds degrades instead of breaking.
                id: 'Input_Context', type: 'select', label: 'Show it this much of the clip',
                default: 39,
                options: [
                    { v: 39, label: '1.6 seconds',
                      info: 'Continues the last shot. Follows your prompt most closely.' },
                    { v: 90, label: '3.8 seconds',
                      info: 'Sees more of the scene. If the last seconds contain a cut, expect it to cut too.' },
                    { v: 141, label: '5.9 seconds',
                      info: 'The whole scene, for carrying complex action across a cut. Slowest.' },
                ],
                hiddenWhen: { modelNot: 'minimax-h3' },
            },
        ],
    },
    // MPI-536 — the foley twin of ltx-extend. Same tier, same all-declared shape,
    // OPPOSITE resolution decision: this graph's Input_Width/Input_Height were deleted
    // because they fed only the encode and never the delivered pixels (Output_Video
    // takes its images off the raw source), so the output always matches the input and
    // there is nothing to expose. Do not copy extend's width/height plan across.
    //
    // Unlike extend this one DOES add a weight: ltx23-lora-foley, on `ltx-23-balanced`
    // only (see models.js). The graph bakes the int8 transformer, so that tier is the
    // only one that can run it.
    //
    // v1 IS FOLEY ONLY. The same file carries a voice mode — Input_Audio#106 fed a real
    // path, the speech terms dropped from the negative, Foley_Lora#100 set to None — and
    // it has never been run. The two are mutually exclusive settings, so shipping them
    // as two toggles would present untested configuration as a composable feature.
    {
        id: 'ltx-foley',
        title: 'Add Foley',
        // Both cut from a real run of this flow (prompt: footsteps on gravel coming
        // from the right and leaving to the left). The hero cannot be a before/after
        // — this flow returns the SAME pixels — so it plays the picture untouched
        // while the waveform of the generated foley draws itself in sync.
        preview: 'flow-ltx-foley.webp',
        video: 'flow-ltx-foley.mp4',
        description: 'Give a silent clip a soundtrack. Drop a video, describe what it should sound like, and LTX 2.3 generates matching foley across the whole clip — the picture comes back untouched.',
        requiredModels: ['ltx-23-balanced'],
        operation: 'flowLtxFoley',
        workflow: 'flow_ltx_foley.json',
        mediaType: 'video',
        type: 'edit',
        inputSchema: {
            media: [
                { type: 'video', mode: 'upto', max: 1, roles: ['video1'], labels: ['Video to score'] },
            ],
        },
        // Nothing is MARKED on the clip, but the user still has to see it: step 0
        // loads media at thumbnail size, so a `preview` step is the first point at
        // which they can judge the take they are about to score — and the prompts
        // belong with it, written while watching the thing being described.
        // 3-step carousel (supply → describe → run).
        //
        // Two fields, and deliberately no third: no duration (whole-clip by
        // construction), no resolution, no seed (_buildParams fills Input_Seed per
        // run), no audio-influence knob (Audio_Influence#110 only reaches the
        // sampler through the voice-mode branch, so surfacing it here would be a
        // dead control).
        steps: [
            {
                kind: 'preview', role: 'video1',
                tickerLabel: 'Describe',
                title: 'Describe what it should sound like',
                fields: [
                    {
                        id: 'positive', type: 'text', rows: 3, label: 'What it should sound like',
                        placeholder: 'Describe the sounds — footsteps, room tone, traffic, wind…',
                    },
                    {
                        id: 'negative', type: 'text', rows: 2, label: 'Avoid',
                        // The bench-proven negative verbatim. Its speech/music terms are what
                        // keep foley from drifting into score or narration, and it only bites
                        // at all because the guider runs at cfg 3.0 — at cfg 1 core CFGGuider
                        // sets uncond_pred = None and this string is inert.
                        default: 'music, melody, song, singing, vocals, score, soundtrack, beat, instrumental backing, narration, tinny, thin, harsh, clipped, distorted, low bitrate, static, noise, room tone',
                    },
                ],
            },
        ],
    },
    // MPI-584 — the FLOW half of the LTX Video upscaler. The capability ships TWICE
    // on purpose (memory `project_flows_are_the_beginner_surface`): MPI-579 shipped it
    // as a PLUGIN entry in the History video Upscale dropdown, and this is the same
    // capability behind the Flow Library, so a beginner never has to leave it.
    //
    // NOTHING HERE IS NEW WORK. The op (`ltxVideoUpscale`, universal, injector
    // `ltxSigmas`), the graph (`ltx_video_upscale.json`, 29 nodes, audio pass-through
    // proven) and both registry mappings were built and verified by MPI-579 — this
    // descriptor is the only file the second surface needed. The three fields below are
    // the plugin's `upscale.fields` VERBATIM, which is what keeps the two surfaces from
    // drifting apart: change one, change the other.
    //
    // Same line as ltx-foley / ltx-extend: `requiredModels: ['ltx-23-balanced']` and NO
    // requiredDeps. It owns no weight — every one the graph loads is that tier's, and the
    // spatial upscaler is already in both LTX tiers' `dependencies`. Balanced specifically
    // because the graph bakes the int8 transformer.
    //
    // NO frame or resolution cap, and that is a decision rather than an oversight: the
    // graph has no knob to cap (its only Input_* nodes are the ones below), so a cap means
    // a new node plus a control — a card of its own. Measured cost is 12752 MB at 25
    // frames and 14721 MB at 73 on a 16380 MB card (MPI-579 validation Phase 5), so the
    // ceiling is real and grows with length. Until a cap exists the description is what
    // warns the user, because an OOM lands minutes deep.
    {
        id: 'ltx-upscale',
        title: 'Upscale Video',
        preview: 'flow-ltx-upscale.webp',
        video: 'flow-ltx-upscale.mp4',
        description: 'Double a video’s resolution and rebuild its detail. Drop a clip and LTX 2.3 re-renders it at 2x — the audio comes through untouched. Short clips first: cost grows with length, and a long one can exhaust the GPU.',
        requiredModels: ['ltx-23-balanced'],
        operation: 'ltxVideoUpscale',
        workflow: 'ltx_video_upscale.json',
        mediaType: 'video',
        type: 'enhance',
        inputSchema: {
            media: [
                // Role MATCHES the op's `mediaInputs` key (`inputVideo`), NOT the `video1`
                // its sibling flows use — that op predates them and is shared with the
                // plugin, so the flow bends to the op.
                { type: 'video', mode: 'upto', max: 1, roles: ['inputVideo'], labels: ['Video to upscale'] },
            ],
        },
        // An upscale IMPROVES media the user supplied, so the result is worth seeing
        // against its source (MPI-585). The role names which input is the BEFORE; the
        // shared surface handles the rest, video and image alike.
        result: { compare: 'inputVideo' },
        // Run-slide fields, no middle step. Unlike extend and foley the prompt here is
        // OPTIONAL and secondary (an upscale is a fidelity job), so there is nothing the
        // user has to watch the clip to write.
        //
        // Both ranges are MPI-568's, measured and closed by Fabio 2026-08-19. The user
        // sees 0–1 on both and the mapping is hidden — his words: "The mapping should be
        // occulted from the user, as per usual."
        fields: [
            {
                id: 'positive', type: 'text', rows: 3, label: 'Prompt', default: '',
                placeholder: 'Optional — describe the shot to steer the detail',
                // EMPTY by default, and load-bearing. MPI-568's most expensive finding:
                // the bench's own default prompt ("natural skin texture, freckles, sharp
                // eyes") was ordering the artifact every downstream dial had been built to
                // remove — the model rendered those freckles as MOLES on flat cheek skin.
                // A suggestion belongs in the placeholder, never in the value.
            },
            {
                id: 'Input_Denoise', type: 'slider', label: 'Denoise',
                min: 0, max: 1, step: 0.01, default: 0.5,
                // -> start sigma 0.50–0.85; UI 0.5 lands on 0.675, Fabio's default. The
                // whole four-value schedule is derived from this one number by
                // ltxSigmasInjector, not by the graph.
                mapTo: [0.50, 0.85],
                note: 'Higher reconstructs more detail and drifts further from the source.',
            },
            {
                id: 'Input_Prompt_Strength', type: 'slider', label: 'Prompt strength',
                min: 0, max: 1, step: 0.01, default: 0,
                // -> cfg 1–3. Defaults to the NO-GUIDANCE end on purpose. Fabio,
                // overruling a plan recommendation of 3: "Most upscaling jobs do not want
                // too much change anyway." Steering is opt-in; the measurement bounds the
                // range, not the default. Do not re-argue it.
                mapTo: [1, 3],
                note: 'Only has an effect once you write a prompt.',
            },
        ],
    },

    // MPI-1036 — Video Edit, on MiniMax H3 reference-to-video. ONE graph, and every choice
    // below is resolved INSIDE it: the picker selects one of twelve hidden instruction
    // templates (picture / no picture), the user's words, who and target are spliced in by
    // StringReplace, and a typed "Only change" routes the run through SAM3 + one still square
    // box (re-render the box, grade-match, stitch back at source resolution) instead of the
    // whole frame. The swap LoRA is a FLOW dep: it holds H3's timing to the source on every
    // masked edit, which is why it is not swap-only. Bench evidence: tasks/MPI-1036/brief.md.
    //
    // 🔴 A HIDDEN FIELD KEEPS ITS VALUE (fields.md), so the graph re-checks each rule the
    // hiddenWhen clauses below express: a target typed and then hidden by Change the
    // background does not mask (MpiMath `a * (b != 4)`), and the picture's room is taken only
    // when op 1 AND a picture AND Keep_Background false. Change a clause here, change the
    // graph's twin.
    //
    // PROVISIONAL `preview` (Fabio, 2026-10-08): a frame of bench run F, the picture's
    // character dancing in the picture's room, so CI's package check passes before Phase 4.
    // Phase 4 (/mpi-flow-graphics) replaces it and adds the `video` hero.
    {
        id: 'video-edit',
        title: 'Video Edit',
        preview: 'flow-video-edit.webp',
        description: 'Swap the person, head or outfit in a video, change its background, or make any edit you describe. Add a picture of the new character, outfit or place, or describe it in words. Name one thing under “Only change” and just that part is re-rendered, faster, with the rest kept exactly as filmed. The soundtrack comes through untouched. Short clips first: a 5-second clip can take 20 minutes, and longer ones drift.',
        requiredModels: ['minimax-h3-ref2va'],
        // The swap LoRA belongs to this Flow, not to the model (01-descriptor-and-ops.md §
        // requiredDeps). SAM3 is an engineAsset, so it is not listed.
        requiredDeps: ['minimax-h3-character-swap-lora'],
        operation: 'flowVideoEdit',
        workflow: 'flow_video_edit.json',
        mediaType: 'video',
        type: 'edit',
        inputSchema: {
            media: [
                { type: 'video', mode: 'upto', max: 1, roles: ['video1'], labels: ['Video to edit'] },
                // <Picture 1>. Optional: with none, the no-picture template bank runs and the
                // words carry the whole change.
                { type: 'image', mode: 'upto', max: 1, roles: ['image1'], labels: ['Picture (optional)'] },
            ],
        },
        result: { compare: 'video1' },
        fields: [
            {
                // Selects the instruction template (MpiAnySwitch10 banks). 6, "the person
                // into the picture's room", is NOT an option: the graph picks it from 1 +
                // a picture + Keep_Background false.
                id: 'Input_Operation', type: 'select', label: 'What to change', default: 1,
                options: [
                    { v: 1, label: 'Swap the person', info: 'Replace someone in the video with the character in your picture, or one you describe.' },
                    { v: 2, label: 'Swap the head', info: 'Replace only the head and face; the body, clothes and hands stay.' },
                    { v: 3, label: 'Change the outfit', info: 'Dress them in what your picture shows, or what you describe.' },
                    { v: 4, label: 'Change the background', info: 'Keep the performance, move it to the place in your picture or your words.' },
                    { v: 5, label: 'Anything else', info: 'Describe any change; everything else stays as filmed.' },
                ],
            },
            {
                id: 'Input_Keep_Background', type: 'radio', label: 'Where they are', default: true,
                options: [
                    { v: true, label: 'The video\'s room' },
                    { v: false, label: 'The picture\'s room', info: 'The character performs the video\'s moves in the place your picture shows. Needs a picture.' },
                ],
                hiddenWhen: { field: 'Input_Operation', isNot: 1 },
            },
            {
                // {who} in the templates. Anything else has no {who}, so it is hidden there.
                id: 'Input_Who', type: 'text', label: 'Who', default: 'the person',
                placeholder: 'e.g. the woman in the red dress',
                hiddenWhen: { field: 'Input_Operation', is: 5 },
            },
            {
                // Typed = masked mode (SAM3 finds it, one still square box round it). A box
                // cannot hold a background, so it is hidden there and the graph ignores it.
                id: 'Input_Target', type: 'text', label: 'Only change (optional)', default: '',
                placeholder: 'e.g. her hat',
                note: 'Name one thing and only it is re-rendered: faster, and the rest of the video stays exactly as filmed.',
                hiddenWhen: { field: 'Input_Operation', is: 4 },
            },
            {
                id: 'positive', type: 'text', rows: 3, label: 'Describe the change', default: '',
                placeholder: 'Optional with a picture. e.g. two small red demon horns, or a long black coat',
            },
        ],
        // The picture put into words before the run (flowEnhance.js § describe): H3 mostly
        // ignores a picture its prompt does not describe (MPI-1036 bench: R2-R4 kept the clip,
        // R2d/R3f/R4e/R5e passed described). The graph splices Input_Look into the picked
        // template, and Input_Kept: what the clip must KEEP - its own person for a background
        // change, its own room for a person swap that stays there (R2p kept the room once it was
        // named; R2o, unnamed, took the picture's).
        // First entry per target that holds wins: template 6 (the picture's room) before 1.
        describe: [
            { to: 'Input_Look', media: 'image1', when: [{ field: 'Input_Operation', is: 1 }, { field: 'Input_Keep_Background', is: false }],
                ask: videoEditAsk(`Describe ${VIDEO_EDIT_PERSON}, and then ${VIDEO_EDIT_PLACE}.`) },
            { to: 'Input_Look', media: 'image1', when: { field: 'Input_Operation', is: 1 }, ask: videoEditAsk(`Describe only ${VIDEO_EDIT_PERSON}.`) },
            { to: 'Input_Look', media: 'image1', when: { field: 'Input_Operation', is: 2 },
                ask: videoEditAsk('Describe only the main person\'s head: apparent age and gender, face, skin, eyes, hair colour, length and style, and anything worn on the head.') },
            { to: 'Input_Look', media: 'image1', when: { field: 'Input_Operation', is: 3 },
                ask: videoEditAsk('Describe only what the main person wears: every garment and accessory with its colour, pattern and material, or the bare skin shown.') },
            { to: 'Input_Look', media: 'image1', when: { field: 'Input_Operation', is: 4 }, ask: videoEditAsk(`Describe only ${VIDEO_EDIT_PLACE}. Leave out any people.`) },
            { to: 'Input_Look', media: 'image1', when: { field: 'Input_Operation', is: 5 }, ask: videoEditAsk('Describe the main subject of the image.') },
            { to: 'Input_Kept', media: 'video1', frame: 'first', when: [{ field: 'Input_Operation', is: 4 }, { media: 'image1' }],
                ask: videoEditAsk(`Describe only ${VIDEO_EDIT_PERSON}.`) },
            { to: 'Input_Kept', media: 'video1', frame: 'first',
                when: [{ field: 'Input_Operation', is: 1 }, { field: 'Input_Keep_Background', is: true }, { media: 'image1' }],
                ask: videoEditAsk(`Describe only ${VIDEO_EDIT_PLACE}. Leave out any people.`) },
        ],
    },

    // MPI-504 — the Character Sheet. A description in, a three-panel video-reference
    // sheet out: a large 3/4 close-up, full body front and full body back, in the
    // layout a video model reads best. v1 takes a PROMPT AND NOTHING ELSE — the
    // reference-photo path is deferred whole to v2, because Head Swap already covers
    // "make it look like this person" as a second pass on the finished sheet.
    //
    // The FRONT BODY IS HEADLESS on purpose, and it is a MASK op, not a prompt: SAM3
    // text-selects face+hat in the front-body quarter and the hole is filled from the
    // sheet's own backdrop, in its own graph since MPI-997 (`chain` below; the full
    // recipe: docs/playbooks/add-flow/existing-flows/character-sheet.md). On a wide shot the model otherwise sources the face
    // from the tiny blurry full-body figure; remove that head and it has exactly one
    // place to take a face from. Toggleable, on by default.
    //
    // NO requiredDeps. Every weight and node this graph needs is either a MODEL dep of
    // krea2/klein-4b (RES4LYF, Impact-Pack, inpaint-cropandstitch, MpiNodes) or an
    // engine-installed universal — `getUniversalWorkflowDepIds()` (routes/shared.js)
    // returns EVERY `type:'custom_nodes'` dep plus EVERY `engineAsset`, so
    // face-yolov8n, sam3-multiplex and Impact-Subpack all install with the engine and
    // belong to no model. Declaring face-yolov8n here (as plan.md first proposed, by
    // analogy with head-swap's LoRA) would be wrong twice: the analogy fails because a
    // LoRA is neither of those things, and an undeclared dep-status cache reads
    // NOT-installed until the first sync, so the flow would show unavailable on open
    // for a weight the engine already guarantees.
    // MPI-567, REBUILT KLEIN-ONLY 2026-08-25 (MPI-621). One model, one pass: the
    // drawing is composited onto the user's own photo, a crop is taken around it, Klein
    // 9B edits that crop, and the user's box is stitched back. The old architecture —
    // SDXL + ControlNet renders the drawing in isolation, rembg cuts it out, a flat
    // paste lands it in the photo, LanPaint blends the seam — is DELETED. It was six
    // locally-correct steps downstream of one unasked question, and by construction it
    // could never produce interaction: a paste is always on top. Fabio's own live test,
    // same scribble and same photo: the 55-node flow took 38s and left the man standing
    // apart touching nothing; ONE Klein 9B edit took 15s and put his hand on the
    // tiger's back and his leg BEHIND it. Evidence chain and both sizing measurements:
    // tasks/MPI-621/brief.md. Nothing is lost by dropping the SDXL arms — that half
    // becomes the Scribble flow (MPI-620).
    {
        // RENAMED 2026-08-23 (Fabio): "Scribble to Object" -> "Draw It In". "Object" was
        // the broken word — he had been drawing characters, and the old title read as a
        // promise the flow does not make. DISPLAY ONLY: `id`, `operation: 'flowScribObj'`
        // and `workflow: 'flow_draw_it_in.json'` all deliberately stay, because
        // cards already in users' galleries carry the `FLOWSCRIBOBJ_` prefix and their
        // sidecars' `flowId`, so renaming the id breaks reuse on every existing item.
        // The Klein-only rebuild changes none of that either — same op key, same file.
        id: 'scribble-object',
        title: 'Draw It In',
        // Both assets EXIST in `comfy_workflows/display/` as of 2026-08-23 — check
        // before touching either name. `7c883d67` declared this pair before the art
        // was made, the tile fetched it and 404'd, and because
        // `tests/desktop/flows-tab-ring.spec.js` asserts `consoleErrors` is empty in
        // three places, that held master's CI RED for a day and eight pushes. Both
        // fields are optional and every consumer guards them (`MpiFlowLibrary.js` ~333,
        // `MpiTileSheet.js` ~137), so the correct state while art is missing is ABSENT,
        // never a name written ahead of the file.
        //
        // Built from run 015 of Fabio's own live session on the OLD route. The art still
        // holds — it shows a drawing becoming a figure in a photo, which is what the
        // flow still does — so the rebuild does not invalidate it.
        preview: 'flow-draw-it-in.webp',
        video: 'flow-draw-it-in.mp4',
        // Two sentences on purpose. The second is CRAFT guidance rather than a
        // description of the flow, and it lives here because `description` is the
        // only copy the inputs slide renders — `_buildInputsSlide` builds the
        // explainer as a single `<p>` off this field, and MpiBaseFlow.js is another
        // card's file. Fabio asked for it on the first stage specifically: the point
        // has to land BEFORE the drawing, not in the paint step's hint where the user
        // has already committed to a shape. The hero demonstrates exactly this
        // contrast — beat 1 is a filled blob, beat 2 a drawn outline.
        description: 'Draw what you want on top of your own photo, describe it, and the flow paints it into the scene — a person, an animal, an object — matching the light, casting a shadow on the ground, and letting whatever is already in front of it overlap its edges. The better you draw it, the more detail carries through: an outline with a pose and a tail gives the model far more to work with than a filled blob, and the less you have to fight the prompt to get what you meant.',
        // ONE slot now, where the old route picked a render model AND a blend model.
        //
        // 9B ONLY, and it is a CORRECTNESS call rather than a quality preference. Under
        // style load 4B LEFT THE USER'S OWN INK IN THE OUTPUT — the drawn leash and head
        // survived as a grey mechanical object while the tiger was corrupted into a
        // cartoon dog. 9B under the same load degraded gracefully: scribble gone,
        // composition intact. 4B follows the drawn shape more closely and integrates
        // worse, which is the same axis the deleted "Follow the drawing" slider rode,
        // reappearing as a model choice — and its failure mode is the worst one
        // available. Cost accepted: a 4B-only user now downloads 9B, offset by the SDXL
        // checkpoint this flow no longer needs at all.
        //
        // LoRA RACK ADDED 2026-08-26 (MPI-620), reversing the decision recorded here
        // before it. The rack is `Input_Lora_Phase1_1..6` (`MpiLoraModel`, model-only —
        // `klein-9b` declares `loraStrengths: ['model']` and there is no CLIP side),
        // spliced between `Input_Edit_Model` and the `CFGGuider`.
        //
        // WHAT THE OLD DECISION GOT RIGHT, AND IT IS STILL TRUE: a style LoRA restyles
        // the WHOLE photograph, not just the inserted subject, and a styled 9B run did
        // exactly that. That is a real hazard HERE in a way it is not on Scribble, which
        // has no photograph to protect. The rack is opt-in — a user who picks no LoRA
        // gets the previous behaviour byte for byte — so the hazard is now the user's to
        // choose rather than one the flow forbids on their behalf (Fabio's call: both
        // flows should benefit from the rack).
        //
        // Still true and NOT re-litigated by this: an SDXL, Pony or Flux1 character LoRA
        // will not load on Klein at all, so the rack cannot carry identity across.
        // Identity by REFERENCE IMAGE remains the route, and remains a later card.
        //
        // 9B ONLY, deliberately — see the paragraph above on 4B integrating worse. Adding
        // 4B was raised on 2026-08-26 and applies to SCRIBBLE, not here.
        //
        // Klein 9B cloud (MPI-918) runs this graph's edit stage at DeepInfra, as on Scribble:
        // offered only with a key saved, run unpicked only when no local one is installed,
        // no LoRA rack. NOT Nano Banana: it failed hard here on Fabio's look (2026-10-01).
        requiredModels: [
            { label: 'Edit model', models: ['klein-9b', 'klein-9b-cloud'], loras: true },
        ],
        // The edit stage a cloud pick replaces (utils/cloudEditGraph.js): 106 is the boxed
        // crop at 1 MP as the local edit encodes it, 185 the joined instruction, 168 the
        // decode. Everything after it (colour match, stitch) is model-free and runs as is.
        cloudEdit: { input: '106', prompt: '185', output: '168' },
        // The graph bakes exactly this pair, and the arm restates it anyway: a re-export
        // that quietly moves a default is caught here rather than in a live run.
        //
        // THE CLIP ARM IS NOT OPTIONAL TRIM. Klein 9B needs `qwen_3_8b_int8_convrot`;
        // pairing it with 4B's encoder dies with a shape error that reads as a sampler
        // bug and is not one (MPI-600). The text encoder moves WITH the checkpoint.
        //
        // `Input_Edit_Clip.clip_name` uses the dotted `Title.widget` form (MPI-359)
        // while `Input_Edit_Model` is plain, and that asymmetry is load-bearing rather
        // than untidy: `unet_name` is on `comfyController._inject`'s spray list and
        // `clip_name` is NOT, so a plain `Input_Edit_Clip` would match the node and
        // silently write nothing.
        modelParams: {
            'klein-9b': {
                'Input_Edit_Model': 'flux-2-klein-9b-int8-convrot.safetensors',
                'Input_Edit_Clip.clip_name': 'qwen_3_8b_int8_convrot.safetensors',
            },
        },
        operation: 'flowScribObj',
        workflow: 'flow_draw_it_in.json',
        agentOpens: 'paint', // the user draws; the agent never does (MPI-892)
        mediaType: 'image',
        type: 'edit',
        inputSchema: {
            // ONLY `media` is read here. A `positive: 'string'` key sat in this object
            // and did NOTHING — the frame reads `inputSchema.media` and nothing else,
            // and a prompt reaches the run by being a declared FIELD whose id is
            // `positive` (MpiBaseFlow `_collectInputs`). It read as a wired prompt, the
            // flow shipped with no prompt box at all, and the first live run rendered a
            // blob into something nobody asked for (MPI-567, 2026-08-23). Declare
            // prompts BELOW.
            //
            // ONE user slot. `image2` (Input_Paint) is the op's second slot but is
            // never offered here: the paint step DERIVES that file, there is nothing
            // to upload into it, and a visible empty slot would invite a wrong one.
            media: [
                {
                    type: 'image', mode: 'upto', max: 1,
                    roles: ['image1'],
                    labels: ['Photo'],
                },
            ],
        },
        // The BEFORE is the user's own photo, and the flow's whole claim is that only
        // the boxed region changed — so the reveal bar crosses a steady scene.
        result: { compare: 'image1' },
        steps: [
            {
                // `mediaRole` sends the derived layer to `image2` instead of replacing
                // `image1`: the graph wants the photo AND the drawing (paint-gizmo.md).
                // Omit it and the drawing would eat the photo.
                kind: 'paint', role: 'image1', mediaRole: 'image2',
                tickerLabel: 'Draw it',
                title: 'Draw what you want to add',
                // THE PROMPT BELONGS BESIDE THE DRAWING, and it is not optional
                // (Fabio, 2026-08-23). A human reads a blob as the thing they had in
                // their head; the model reads it as a silhouette, and a girl and a boy
                // share one. Ask while the drawing is on screen — an unlabelled shape
                // is exactly what the user cannot describe from the next step.
                //
                // DECLARED HERE AND NOWHERE ELSE. Restating it in the flow's own
                // `fields` so it is also editable on the run slide is the obvious next
                // thought, and it SILENTLY DROPS EDITS from the second run onward.
                // The two surfaces are two different stores: a gizmo step's fields are
                // role-keyed in `_stepValues[role].fields`, while flow fields live in
                // `_fieldValues`, and `_collectInputs` applies the flow store LAST.
                // On a fresh open that is harmless — `_seedField` returns undefined for
                // a flow-level field with no default and no persisted root, so the key
                // is absent and cannot overwrite. But after one run `s_flowInputs`
                // carries `positive` at the payload root, the flow-level copy seeds
                // from it, and thereafter editing the prompt HERE is overwritten at
                // collection by the stale run-slide value. Wrong picture, no error.
                //
                // The character-sheet flow really does declare its prompt twice, and
                // that is not a counter-example: its prompt step is `kind: 'fields'`, a
                // FRAME kind with no role, whose values are seeded into the FLOW store
                // on purpose (stepKinds.js § FRAME_KINDS) — one store, so one value.
                // A gizmo step cannot borrow that. Unifying the two stores is frame
                // work and belongs to MPI-606, not to a FlowDef.
                //
                // Cost of the single surface: changing a word before `Generate Again`
                // means clicking "Draw it" in the ticker. One click, and correct.
                fields: [
                    {
                        id: 'positive', type: 'text', rows: 2, label: 'What did you draw?',
                        placeholder: 'An old lady riding the tiger, a stone bench, a red umbrella…',
                    },
                ],
                // NO SIZE FLOOR ANY MORE, and dropping it was measured rather than
                // assumed (MPI-621). The old "~96px tall" came from ControlNet: stage 1
                // upscaled a starved control hint, so a small drawing had too little ink
                // to read. There is no ControlNet here, and the crop is sized FROM the
                // drawing and normalised to ~1MP, so it manufactures the resolution — a
                // 75px scribble with 3px strokes rendered a grounded figure with contact
                // shading. What matters instead is that the strokes say where, how big
                // and what pose, which is what this copy now asks for.
                hint: 'Draw roughly where it goes, how big it is and what pose it holds, then say what it is — the drawing gives the placement, the words give the subject. It does not need to be large: the flow crops in around whatever you draw.',
            },
            {
                // The return region. `param: 'box1'` -> `Input_Box` through the box
                // injector (an MpiBox carries four widgets, which the generic title
                // injector would match and silently not write). No `ratio`: this box
                // wraps a subject AND the ground its shadow falls on, which is not
                // square. `overflow: 'allow'` because both consumers clip — MpiBoxMask
                // clamps to the image and the crop takes the clamped mask — and a
                // subject near an edge otherwise cannot be given room below it.
                kind: 'box', role: 'image1', param: 'box1', overflow: 'allow',
                tickerLabel: 'Blend area',
                title: 'Box the area to blend',
                // Asks for ROOM, never light direction — the model reads the scene's own
                // light, and telling it where the light is makes it worse
                // (blending-into-a-photo.md). MEASURED FLOOR (MPI-621): the model renders
                // the subject AROUND and BEYOND the drawing, not inside it, so a box
                // stitched at the drawn bbox cut a hard vertical line through the man's
                // torso; 1.6x the drawing was enough and 2.2x had margin. Shadow room is
                // ON TOP of that floor and is scene-dependent — a low sun casts a long
                // shadow — which is exactly why the user draws this and the graph does
                // not derive it.
                //
                // The "keep it tight" half has a SECOND reason now: the context crop is
                // sized from the drawing but can never be smaller than this box, so a
                // very large box under-anchors the render and the subject comes back
                // bigger than it was drawn.
                hint: 'Include the subject plus room on the ground for its shadow — it is rendered around your drawing, not inside it, so a box drawn tight to the strokes will slice it. Keep it close otherwise: everything inside gets re-rendered, and a very large box makes the subject come back bigger than you drew it.',
            },
        ],
        // NO `fields`. Both of the old ones were ControlNet knobs and the graph no
        // longer carries a ControlNet: "Drawing type" chose between the scribble and
        // canny preprocessor banks, and "Follow the drawing" set the control strength.
        // Their axis did not disappear, it became the model choice — see the 4B note
        // above. Do not reintroduce a strength slider here; there is nothing to steer.
    },
    {
        // MPI-620 — "Scribble". Draw on a blank canvas (or bring a drawing made
        // elsewhere) and SDXL renders it. This is the SDXL + ControlNet render half that
        // MPI-621 deleted from Draw It In when that flow was rebuilt Klein-only, rehoused
        // as a flow in its own right — it was always a general-purpose scribble-to-image
        // engine wearing a photo-insertion costume.
        //
        // The id is `scribble` and the op is `flowScribble`, deliberately NOT reusing
        // `scribble-object` / `flowScribObj`. Those still belong to Draw It In: the op key
        // was kept when that flow was renamed because its gallery cards carry the
        // `FLOWSCRIBOBJ_` prefix and their sidecars' `flowId`, so it can never be freed.
        id: 'scribble',
        title: 'Scribble',
        // The hero dissolves the drawing away in place — its white ground lifts first, so
        // the render appears behind the strokes, then the strokes lift too — and the TILE is
        // that mid-dissolve instant, a real frame of the clip rather than a separate
        // composition. So the poster never cuts to a different picture when the clip starts.
        // Plates are one real run: `imported_002.png`'s sha256 IS the `.preview-assets`
        // input both `kleinEdit_011` (anime) and `kleinEdit_012` (photoreal) ate.
        preview: 'flow-scribble.webp',
        video: 'flow-scribble.mp4',
        description: 'Draw something and let the model render it. Start from a blank canvas at the shape you want, or bring in a drawing you made elsewhere, then say what it is — the drawing gives the shapes and the composition, the words give the subject and the style. It does not have to be a good drawing: rough placement and a readable silhouette are enough for the model to build a finished image around.',
        // EDIT MODELS, NOT SDXL + ControlNet — Fabio's call on 2026-08-26 after a live
        // side-by-side on one drawing, and it retires SDXL scribble-to-image from the
        // product. A deliberate call, not drift: this card EXISTED to rehouse the SDXL
        // half MPI-621 deleted from Draw It In, and the comparison beat it.
        //
        // Same drawing, same prompt, only the model path differing: the SDXL arm rendered
        // the drawn strokes as physical white road barriers and put the sea on the wrong
        // side, because both ControlNet arms are monochrome LINE DETECTORS — Scribble and
        // Canny discard colour, so a blue fill contributes an outline indistinguishable
        // from a red terrain stroke and carries no "sea goes here" signal. Klein reads
        // actual RGB and placed it correctly on the first run.
        //
        // KREA 2 AND BOOGU WERE BOTH TRIED AND BOTH DROPPED, so do not re-add either
        // without a fresh sweep. Krea 2 rendered the drawn pink dashes as real pink road
        // paint and survived three prompt reframings — its `Krea2EditModelPatch` ships
        // `ref_boost 2`, which biases the whole reference against the instruction, i.e.
        // "keep what is in the picture", the exact opposite of what this flow asks for.
        // Boogu passed on the winning prefix but Klein beat it on both quality and speed
        // (14-27s against 38-39s), and Boogu would have forced a second sampler chain into
        // this graph behind a switch: a flow op resolves as a UNIVERSAL workflow — ONE
        // file, resolved before any model lookup — and Boogu is `ModelSamplingAuraFlow` +
        // `SamplerCustom` where Klein is `Flux2Scheduler` + `CFGGuider`.
        //
        // 9B FIRST because `models[0]` is the recommendation, matching Draw It In. Both
        // tiers are one architecture, so ONE graph drives them and `modelParams` below is
        // the only thing that differs.
        //
        // `loras: true` — CONFIRMED LIVE, not assumed. An Anime style LoRA at 1.00 drove
        // the entire look with the prompt saying nothing about style, and naming the style
        // in the prompt worked too. That measurement is also why this flow has no `style`
        // select: a LoRA already does it better than a dropdown would. It rides on the SLOT
        // rather than a flow-level `settingsModel` so the rack follows the card the user
        // picked.
        // The two cloud ids (MPI-918) run the SAME graph's edit stage at DeepInfra: offered
        // only with a key saved, run unpicked only when no local one is installed, no LoRA
        // rack (`flowModelIds`). Nano Banana fits here
        // because this edit takes ONE reference.
        requiredModels: [
            {
                label: 'Edit model',
                models: ['klein-9b', 'klein-4b', 'klein-9b-cloud', 'nano-banana-2-lite-cloud'],
                loras: true,
            },
        ],
        // The edit stage a cloud pick replaces (utils/cloudEditGraph.js): 106 is the drawing
        // at 1 MP as the local edit encodes it, 185 the joined instruction, 168 the decode.
        cloudEdit: { input: '106', prompt: '185', output: '168' },
        // What differs between the tiers, and it is the ONLY thing that does.
        //
        // THE CLIP ARM IS NOT OPTIONAL TRIM: 9B needs `qwen_3_8b_int8_convrot` and 4B
        // needs `qwen_3_4b`, and pairing 9B with 4B's encoder dies with a shape error that
        // reads as a model bug and is not one (MPI-600). The text encoder moves WITH the
        // checkpoint or the arm is broken on arrival.
        //
        // `Input_Edit_Clip.clip_name` uses the dotted `Title.widget` form (MPI-359) while
        // `Input_Edit_Model` is plain, and that asymmetry is load-bearing rather than
        // untidy: `unet_name` is on `comfyController._inject`'s spray list and `clip_name`
        // is NOT, so a plain `Input_Edit_Clip` would match the node and silently write
        // nothing.
        modelParams: {
            'klein-9b': {
                'Input_Edit_Model': 'flux-2-klein-9b-int8-convrot.safetensors',
                'Input_Edit_Clip.clip_name': 'qwen_3_8b_int8_convrot.safetensors',
            },
            'klein-4b': {
                'Input_Edit_Model': 'flux-2-klein-4b-int8-convrot.safetensors',
                'Input_Edit_Clip.clip_name': 'qwen_3_4b.safetensors',
            },
        },
        operation: 'flowScribble',
        workflow: 'flow_scribble.json',
        agentOpens: 'paint', // the user draws; the agent never does (MPI-892)
        mediaType: 'image',
        type: 'create',
        inputSchema: {
            // ONE slot, and `mode: 'upto'` makes it genuinely optional (Fabio,
            // 2026-08-26): the user either draws on a blank canvas in the next step or
            // brings a drawing made in Photoshop. Whichever happens, the paint gizmo
            // hands the run a single composited image, so there is no second slot.
            media: [
                {
                    type: 'image', mode: 'upto', max: 1,
                    roles: ['image1'],
                    labels: ['Drawing (optional)'],
                },
            ],
        },
        // NO `result.compare`. The reveal bar wants a steady BEFORE the output can be
        // read against, and this flow has none: with no upload there is literally no
        // before, and with one the before is a line drawing and the after a finished
        // render, which share no pixels for the bar to travel across.
        steps: [
            {
                // `role: 'image1'` with NO `mediaRole` — the composite REPLACES the
                // drawing it was composited from, which is `crop`'s semantics rather than
                // the `paint` semantics Draw It In uses. That flow needs the photo AND the
                // drawing as two separate graph inputs so it can flatten them itself; this
                // graph has one image input and wants it already opaque.
                // `composite: true` — the run gets the FLATTENED picture (strokes over
                // the upload, or over flat white when there is none), not the bare RGBA
                // layer. This graph has ONE image input and reads its RGB as the
                // ControlNet hint, so a layer would arrive with undefined colour
                // wherever alpha is 0 (stepKinds.js § STEP_MEDIA).
                // `fieldsSide` — the prompt and the canvas-size picker sit in a column
                // BESIDE the drawing rather than under it. Someone drawing a whole figure
                // needs the canvas, and stacked those two controls cost ~150px of exactly
                // the vertical the drawing wants (Fabio, 2026-08-26).
                kind: 'paint', role: 'image1', composite: true, fieldsSide: true,
                tickerLabel: 'Draw it',
                title: 'Draw what you want',
                fields: [
                    {
                        // DECLARED HERE AND NOWHERE ELSE. Restating it in the flow's own
                        // `fields` so it is also editable on the run slide silently drops
                        // edits from the second run onward — a gizmo step's fields are
                        // role-keyed in `_stepValues[role].fields` while flow fields live
                        // in `_fieldValues`, and `_collectInputs` applies the flow store
                        // LAST. See the long note on Draw It In's prompt above.
                        id: 'positive', type: 'text', rows: 2, label: 'What is it?',
                        placeholder: 'A knight on a cliff at sunset, a red sports car, a treehouse…',
                    },
                    {
                        // THE CANVAS SIZE, and it is read by the GIZMO rather than sent to
                        // the graph — hence a bare id, not an `Input_` one. The graph
                        // derives its own dimensions (`GetImageSize` off the scaled input
                        // drives `EmptyLatentImage`), so this never becomes an injection
                        // param; it exists to seed the blank canvas the user draws on.
                        //
                        // Declared on THIS step on purpose. A step's own fields are seeded
                        // into `_stepValues[role].fields` at SETUP and handed to the gizmo
                        // as `props.value` AT MOUNT, which is the only place a value is
                        // readable before the gizmo's first report. A flow-level field
                        // would NOT be — mount props are `{ media, step, value, onChange }`
                        // and `_fieldValues` is not among them.
                        //
                        // The values are SDXL-native buckets. Off-bucket dimensions are
                        // what make an SDXL render go soft or grow a second head, and since
                        // the drawing's size becomes the output's size, picking here is
                        // picking the output resolution.
                        //
                        // It renders even when the user HAS uploaded a drawing, because
                        // the frame has no conditional-field support. That is answered with
                        // copy rather than a `showWhen` in the field vocabulary — a real
                        // feature with real blast radius for one control.
                        //
                        // `blankOnly` DISABLES it once the drawing slot is filled. It used
                        // to render live-but-inert in that case — the frame has no
                        // conditional-field support, and the cost was accepted with a note
                        // instead. Fabio hit it in a live run and rejected it on the same
                        // grounds he rejected the reshape guard: a control that moves and
                        // does nothing is worse than either real behaviour. Disabled, the
                        // note below reads as the REASON rather than as fine print.
                        id: 'canvasSize', type: 'select', label: 'Canvas size',
                        default: '1024x1024', blankOnly: true,
                        note: 'Sets the size of a blank canvas. A drawing you add keeps its own size.',
                        options: [
                            { v: '1024x1024', label: 'Square', info: '1024 x 1024' },
                            { v: '896x1152', label: 'Portrait', info: '896 x 1152' },
                            { v: '1152x896', label: 'Landscape', info: '1152 x 896' },
                            { v: '768x1344', label: 'Tall', info: '768 x 1344' },
                            { v: '1344x768', label: 'Wide', info: '1344 x 768' },
                        ],
                    },
                ],
                hint: 'Rough is fine — the drawing carries placement, scale and silhouette, and the words carry the rest. Colour matters: the model reads what you paint, so a blue patch reads as water and a green one as vegetation. Nothing you draw survives into the result, so scribble freely.',
            },
        ],
        // NO FLOW-LEVEL FIELDS. Both that lived here — the `Input_Control_Net` drawing-type
        // radio and the `Input_Control_strength` "Follow the drawing" slider — died with the
        // ControlNet when this flow moved to edit models. An edit model reads the drawing's
        // actual RGB rather than a preprocessed monochrome hint, so there is no arm to pick
        // and no strength to trade off; the only knob that ever mattered is the wording, and
        // that is the `positive` field on the paint step.
        //
        // The prompt PREFIX is baked in an `MpiText` node in the graph, not declared here,
        // so the user types only the subject. Settled live on 2026-08-26 after three
        // reframings, and the two things it must not lose are why it reads the way it does:
        // it says REPLACE rather than "change the drawing" (asking a model to *change* a
        // drawing licenses it to keep part of one — that is what left strokes in the
        // output), and it names NO output medium (an earlier version said "photorealistic
        // photograph", which would have made anime unreachable from a baked prefix).
        //
        //   Replace this sketch with a fully rendered image of the same scene. The sketch
        //   is a layout guide only: no drawn line, outline or patch of flat colour survives
        //   into the final image. The finished image shows
        //
    },
    {
        id: 'character-sheet',
        title: 'Character Sheet',
        preview: 'flow-character-sheet.webp',
        video: 'flow-character-sheet.mp4',
        description: 'Describe a character and get a reference sheet back: a large three-quarter portrait, plus full-body front and back views, on a plain grey studio backdrop. Built to be fed to a video model, so the front body comes back headless — that leaves the portrait as the only place a face can come from.',
        // A CHOOSABLE SLOT (MPI-590): the sheet samples Krea 2, and the SFW and NSFW cards
        // are the SAME architecture with a different bake — so a user holding either one
        // can run it, and is never asked for a second 12.25GB download of the other. Both
        // candidates stay listed so a user who has NEITHER picks which one downloads
        // instead of silently getting the first; `flowModelIds` resolves it, and
        // `modelParams` below is what makes the pick reach the graph.
        //
        // NOT `modelFamily` — MPI-316 removed that field from both krea2 cards on purpose:
        // it drives the H/B/L tier letter, and these two are CONTENT variants, not tiers.
        //
        // ONE SLOT AGAIN (MPI-628). MPI-610 gave this flow a second choosable slot for the
        // head-removal phase, which was a Klein edit pass — a whole second checkpoint plus
        // its own CLIP and VAE, loaded mid-run to paint studio grey. The head mask already
        // existed, so the graph now SUBTRACTS the head from a BiRefNet subject matte and
        // composites the sheet onto a flat #808080 plate instead. No second model, no
        // sampler pass. BiRefNet and SAM3 are both `engineAsset: true` — they install with
        // the engine, so neither is a flow requirement and neither belongs here.
        requiredModels: [
            // `loras: true` — the graph carries a user LoRA rack, so the user's own LoRAs
            // ride along: the LoRA carries identity, the sheet carries the layout, and
            // someone who has already trained a character describes only the wardrobe and
            // face on top (Fabio, MPI-504). Declared on the SLOT rather than as a
            // flow-level `settingsModel`, so the rack follows whichever member of the
            // any-of set is running — the NSFW arm opens the NSFW rack (MPI-590) — and so a
            // flow with more than one model phase can give each of them one (MPI-608).
            { label: 'Render model', models: ['krea2', 'krea2-nsfw'], loras: true },
        ],
        // What differs between the arms, as injection params. The graph is the SFW one,
        // so that arm restates its own baked values — cheap, and it keeps each pair
        // readable as a pair instead of "the default plus an override".
        //
        // `Input_Bypass_Filter_Lora` is not optional trim: the NSFW twin workflow bakes
        // that strength at 0 (krea2_t2i_nsfw.json node 245), so leaving it at 1 runs the
        // lustify transformer with the SFW bypass still applied.
        modelParams: {
            'krea2': {
                'Input_Base_Model': 'krea2_raw_int8_convrot.safetensors',
                'Input_Bypass_Filter_Lora.strength_model': 1,
            },
            'krea2-nsfw': {
                'Input_Base_Model': 'lustify-v10-krea-raw-int8_convrot.safetensors',
                'Input_Bypass_Filter_Lora.strength_model': 0,
            },
        },
        operation: 'flowCharacterSheet',
        workflow: 'flow_character_sheet.json',
        // THE HEAD REMOVAL IS ITS OWN RUN (MPI-997, Fabio 2026-09-30). The sheet graph draws
        // the sheet and nothing else; with Headless front body on, the few-second head
        // removal runs on the finished sheet and lands as the card's NEXT VERSION, so the
        // untouched sheet stays one step back in its history. One run still, for the user
        // and for the in-app agent's single `generate` call.
        chain: { operation: 'flowCharacterSheetHeadless', when: 'Input_Remove_Head', input: 'image1' },
        mediaType: 'image',
        type: 'create',
        // No `inputSchema` at all: this flow collects no media, so step 0 renders its
        // own "This flow needs no input media." beside the hero. No `result.compare`
        // either — there is no BEFORE to reveal against.
        //
        // The refine step. Media-less, so `kind: 'fields'` (FRAME_KINDS) — its fields
        // ARE the work, stacked where a canvas would be. No `role`, so its values live
        // in the FLOW-level store, which is what makes the prompt ONE value edited from
        // here and from the run slide.
        steps: [
            {
                kind: 'fields',
                tickerLabel: 'Describe',
                title: 'Describe your character',
                hint: 'Enhance rewrites your description into the phrase the sheet is generated from. Edit it freely — whatever is in the lower box is what runs. Leave it empty and your own words run raw.',
                fields: [
                    {
                        id: 'positive', type: 'text', rows: 3, label: 'Your character',
                        placeholder: 'Who they are, wardrobe, age, hair, eyes, scars and marks…',
                    },
                    {
                        id: 'enhance', type: 'button', label: 'Enhance', icon: 'enhance',
                        action: 'enhance',
                        from: 'positive', to: 'Input_Positive',
                    },
                    {
                        // The enhanced phrase, shown ONLY here. It is the product as much
                        // as the picture is: an asset is a PAIR of image plus a phrase
                        // reused word for word, and a phrase the user cannot see is a
                        // phrase they cannot repair. `Input_*`, so it reaches the graph's
                        // MpiText#112 as an injection param — which beats the top-level
                        // `positive` because _buildParams assigns injectionParams LAST.
                        id: 'Input_Positive', type: 'text', rows: 10,
                        label: 'The character phrase',
                        placeholder: 'Press Enhance, or write the full phrase yourself.',
                    },
                ],
            },
        ],
        // The run slide carries the SAME prompt pair minus the enhanced box (declaring
        // the pair on both surfaces is what gives the condensed form), then the knobs.
        // Rule 3 of the decided UI lives here: with the enhanced text hidden, the
        // button's heat is the only thing that can say "this prompt is not enhanced".
        fields: [
            {
                id: 'positive', type: 'text', rows: 3, label: 'Your character',
                placeholder: 'Who they are, wardrobe, age, hair, eyes, scars and marks…',
            },
            {
                id: 'enhance', type: 'button', label: 'Enhance', icon: 'enhance',
                action: 'enhance',
                from: 'positive', to: 'Input_Positive',
            },
            {
                // Four sheet templates behind one MpiAnySwitch, 1-indexed like
                // head-swap's Input_Tier — but a `select`, because these are four
                // equal LOOKS rather than a cost ladder worth spending a radio row on.
                // The dropdown emits the option's original `v`, so the int reaches
                // MpiAnySwitch as a number and not as "1".
                //
                // The templates differ in five marked spans and NOTHING else, and every
                // one of them keeps the pupil catch-light: without it the face is dead
                // and no video model can act with it. None of them names a lens, a grain
                // or a grade — the sheet stays boring on purpose, or the character
                // carries that look into every scene it is ever used in.
                id: 'Input_Recipe', type: 'select', label: 'Style', default: 1,
                options: [
                    { v: 1, label: 'Photoreal',
                      info: 'Photographed as a real actor — visible pores, natural hair, 85mm.' },
                    { v: 2, label: '3D animation',
                      info: 'Hero character for a feature animation — subsurface skin, groomed hair.' },
                    { v: 3, label: 'Anime',
                      info: 'Key character for an animated feature — crisp line art, flat cel shading.' },
                    { v: 4, label: 'Cartoon',
                      info: 'Hero character for an animated series — bold outlines, flat colour fills.' },
                ],
            },
            {
                // The output size, 1-indexed into the graph's TWO `MpiAnySwitch` banks
                // (`Width_Select` / `Height_Select`, both selected by `Input_Quality`).
                // A declared field emits exactly ONE value into ONE param and `mapTo` is
                // a linear range map, so a resolution can never be one field driving a
                // width node and a height node — the switch bank is the answer, and it
                // is the pattern `Input_Recipe` already uses three nodes away. The banks
                // carry `any_1..any_5` rather than a boolean because MPI-586's Prop Sheet
                // needs FOUR arms off this same shape.
                //
                // Both values are TRUE 8:5 and ÷32-clean — 1280×800 is `FLUX_RATIOS`' 8:5
                // row (corrected this card) and 1792×1120 is `KREA2_RATIOS['2k']`'s, which
                // was exact all along. Krea2's time scales LINEARLY in pixels
                // (`docs/models/krea2/resolution.md`), so 1.96× the pixels is ~2× the wait,
                // not the 4× an attention-cost intuition predicts.
                //
                // 1K is the default: three panels across 1280 is ~426 px of face each —
                // enough to judge the sheet, cheap enough to iterate. 2K is for the keeper.
                id: 'Input_Quality', type: 'radio', label: 'Quality', columns: 2, default: 1,
                options: [
                    { v: 1, label: '1K', note: '1280 × 800',
                      info: 'Baseline. ~426 px per panel — enough to judge pose, wardrobe and face before committing.' },
                    { v: 2, label: '2K', note: '1792 × 1120 · ~2× time',
                      info: '~2× the time for 1.96× the pixels — ~597 px per panel. For the sheet you are keeping.' },
                ],
            },
            {
                // A `toggle` is an icon+label MpiButton (MPI-504), so `icon` is what it
                // shows when there is no room to read the caption. Optional — omit it
                // and the type falls back to a tick.
                id: 'Input_is_Turbo', type: 'toggle', label: 'Turbo', icon: 'bolt',
                default: false,
                // The krea2 accelerator LoRA. OFF by default: a sheet is a keystone
                // asset every later shot inherits, so it is the wrong place to trade
                // fidelity for speed.
            },
            {
                id: 'Input_Remove_Head', type: 'toggle', label: 'Headless front body',
                icon: 'eraser', default: true,
                // ON by default — it is the whole reason this layout works as a video
                // reference. Off is for inspecting the sheet the model actually drew.
                // Read by `chain.when` (flowService), not by either graph (MPI-997).
            },
            // The `loras` action button that used to sit here is GONE (MPI-608). It opened
            // the rack for the flow's one `settingsModel`, which cannot express a flow with
            // a model per phase. The cogwheel beside each model selector in the slide-over
            // replaces it — same panel, same event, but addressed per phase and visible
            // where the model it belongs to is chosen.
        ],
    },

    // MPI-1042 — Character Sheet from Images. The character the user ALREADY has, from a
    // face picture (required, boxed) and a body picture (optional), into the same sheet as
    // `character-sheet` — same layout, so the same head-removal leg runs on it. No LoRA, no
    // training: the pictures are references. Bench record: tasks/MPI-1042/validation.md.
    //
    // TWO ARMS, the user picks (Fabio, 2026-10-08). Qwen-Image 2.1 draws the whole sheet in
    // one sampling and follows a body picture's build and clothes; Klein 9B needs two
    // samplings (the portrait alone, or it squeezes and loses the turn) and leans on the face
    // picture's clothes. Qwen is first, the recommended arm; its licence leaves the IMAGES
    // non-commercial (the licence gate and badge are the model's, MPI-936), Klein's does not.
    //
    // The close-up is ALWAYS three-quarter (Fabio: a frontal one leaves the video model to
    // invent the turn). Whether the face picture is already turned decides the wording - keep
    // its turn and expression, or turn it - and the DESCRIBER says which, on the boxed face.
    // A body picture is described too: no wording alone dressed the sheet in the body's
    // clothes on both models, a caption of them did (batches 21-23). The graph builds the
    // caption and puts it ahead of the user's words; "nude" there trips Klein's NSFW LoRA,
    // exactly as in the app's Klein workflow.
    {
        id: 'character-sheet-from-images',
        title: 'Character Sheet from Images',
        // PROVISIONAL: a crop of a bench sheet, so CI's package check passes; /mpi-flow-graphics
        // replaces it and adds the `video` hero.
        preview: 'flow-character-sheet-from-images.webp',
        description: 'Turn pictures of a character you already have into a character sheet: a large three-quarter portrait, plus full-body front and back views, on a plain grey studio backdrop. Box the face in the first picture; add a full-body picture and the sheet takes its build and clothes. Qwen-Image 2.1 follows a body picture best, but its pictures are not for commercial use; FLUX.2 Klein 9B\'s are. If the sheet does not look like your character, run it again.',
        requiredModels: [{ label: 'Model', models: ['qwen-image-2-1', 'klein-9b'] }],
        operation: 'flowCharacterSheetImages',
        // The Qwen graph. Klein's file is `byModel`'s (universal_workflows.js); this field is
        // read only by the tests that check declared fields against node titles.
        workflow: 'flow_character_sheet_from_images.json',
        chain: { operation: 'flowCharacterSheetHeadless', when: 'Input_Remove_Head', input: 'image1' },
        // The agent fills the pictures and words and opens the box for the user (MPI-892). It
        // cannot run it: its `look` box gate refuses any box over 0.6 of the picture as "the
        // whole person" (Head Swap's head-only bound, agentLoop.mjs), and a head-and-shoulders
        // box on a portrait picture is most of it. A per-step bound there would let it run.
        agentOpens: 'box',
        mediaType: 'image',
        type: 'create',
        inputSchema: {
            media: [
                { type: 'image', mode: 'upto', max: 1, roles: ['image1'], labels: ['Face picture'] },
                // Optional: empty, the graph skips the head removal and the second reference.
                { type: 'image', mode: 'upto', max: 1, roles: ['image2'], labels: ['Full-body picture (optional)'] },
            ],
        },
        steps: [
            {
                // 4:5 = the portrait panel. Klein COPIES the face picture, so a picture of
                // another shape comes back stretched (bench runs 1-3); the graph widens any box
                // to 4:5 as well, for an agent's measured one. `overflow` + MpiBoxCrop `pad`:
                // a head at the edge can still be framed with its hair.
                kind: 'box', role: 'image1', param: 'box1', ratio: 0.8, overflow: 'allow',
                tickerLabel: 'Face',
                title: 'Box the face',
                hint: [
                    'Box the head and shoulders, hair and headwear included: the portrait copies what is inside the box.',
                    'Adding a full-body picture? Qwen-Image 2.1 follows its build and clothes best.',
                ],
            },
        ],
        fields: [
            {
                id: 'positive', type: 'text', rows: 3, label: 'Changes (optional)', default: '',
                placeholder: 'e.g. a short bob haircut, a heavier build, a red leather jacket',
            },
            {
                id: 'Input_Remove_Head', type: 'toggle', label: 'Headless front body',
                icon: 'eraser', default: true,
                // As on Character Sheet: read by `chain.when`, not by either graph (MPI-997).
            },
        ],
        // Both answers are graph TEXT: `Input_Face_Pose` holding "turned" keeps the picture's
        // turn, anything else turns the head; `Input_Body_Clothes` becomes the caption, and
        // "no clothing" the nude one. The turn is asked on the BOX: on a whole torso shot the
        // describer called a turned head FRONT (batch 14a).
        describe: [
            { to: 'Input_Face_Pose', media: 'image1', crop: 'box1',
                ask: 'Look only at the person\'s head. Is the face pointing straight at the camera, or is the head turned to one side (a three-quarter or profile view)? Reply with one word: FRONT or TURNED.' },
            { to: 'Input_Body_Clothes', media: 'image2',
                ask: 'Describe only the clothing this person wears below the neck, as one short phrase, for example \'a red hoodie and black jeans\'. If the person wears no clothing, reply exactly: no clothing.' },
        ],
    },

    // MPI-594 — OUTPAINT. One image in, the same picture back inside a bigger frame.
    //
    // The graph is a FLUX.2 Klein 9B EDIT that fills the black, and it never learns a
    // rect: the `crop` step composes source + transparent bars into a single file and
    // that file is what `Input_Image` loads (stepKinds.js § STEP_MEDIA). So there is no
    // fill input and no box param here — deliberately, and the same reason the History
    // crop tool has no auto-mask (docs/crop.md § The rect is not confined to the image):
    // prompting an edit model to fill "the black area" beats handing it a painted mask.
    //
    // KLEIN 9B ONLY (MPI-900, Fabio 2026-09-24). Krea 2 was slower and failed more, and a
    // failed fill is simply re-run.
    //
    // KLEIN'S PICTURE IS THE RESULT (MPI-1011, Fabio 2026-10-02). Klein repaints the WHOLE
    // frame at ~1 MP. MPI-900 pasted only the new area back over the untouched original;
    // it kept the original's pixels and size, but a line showed wherever the fill met it.
    // Fabio's call: the direct result, smaller and recoloured, with no join at all. Better
    // ways to keep the original are for a later version.
    //
    // AN OPTIONAL PROMPT (MPI-900, reverses MPI-594's "no prompt"). The fill instruction
    // stays baked in an UNTITLED node; `Input_Positive` is a second node the graph JOINS
    // after it ("<bake> <prompt>"), so the empty string `_buildParams` sends on every run
    // lands in the user's half and the bake survives.
    //
    // NO `result.compare`. The output is a DIFFERENT SHAPE from the input, so a wipe
    // between them compares two framings rather than two versions of one picture. The
    // honest before/after here is the black the step already showed.
    {
        id: 'outpaint',
        title: 'Outpaint',
        preview: 'flow-outpaint.webp',
        video: 'flow-outpaint.mp4',
        description: 'Extend an image past its edges. Choose the shape you want, drag the frame out '
            + 'over the sides you want filled, and say what should appear there if you like. Runs '
            + 'on FLUX.2 Klein 9B.',
        // The graph bakes 9B's transformer + encoder, so there is nothing to inject. NO cloud
        // model (Fabio, 2026-10-02, MPI-1011); Klein 9B cloud ran here 2026-10-01 to 10-02
        // (MPI-918).
        requiredModels: [{ label: 'Base model', models: ['klein-9b'] }],
        operation: 'flowOutpaint',
        workflow: 'flow_outpaint.json',
        mediaType: 'image',
        type: 'create',
        inputSchema: {
            media: [
                { type: 'image', mode: 'upto', max: 1, roles: ['image1'], labels: ['Image'] },
            ],
        },
        steps: [
            {
                // No `param`: this gizmo's value changes the PICTURE, not a widget —
                // it binds through STEP_MEDIA instead (stepKinds.js).
                kind: 'crop', role: 'image1',
                // A big frame fills in passes, each growing a side by at most a third of what
                // it already has (MPI-1011, Fabio 2026-10-02: one pass failed on large fills).
                maxGrow: OUTPAINT_MAX_GROW,
                tickerLabel: 'Frame',
                title: 'Choose the frame you want',
                hint: 'Pick a shape, then drag the frame past the edges — black is what gets painted in.',
            },
        ],
        fields: [
            {
                // Optional: empty, the graph's baked instruction runs alone.
                id: 'positive', type: 'text', rows: 2, label: 'What goes in the new area?',
                placeholder: 'Leave empty to just continue the picture',
            },
        ],
    },
    // MPI-607 — Voice Changer, the FIRST audio-only flow: audio in, audio out, no
    // picture anywhere in the run. `mediaType: 'audio'` is what routes the graph's
    // `Output_Audio` to a real gallery card instead of a video's soundtrack
    // side-channel (MPI-573 built that half; this is its first consumer).
    //
    // NO MODEL, but nine-tenths of a gigabyte of weights — so `requiredModels: []`
    // with everything in `requiredDeps`, the head-swap shape. Chatterbox is a FLOW
    // WITH DEPS, deliberately not a ModelDef (which would force dead fields and an
    // entry in the model picker) and not a Plugin (which by its own definition is
    // not a tile in the Flow Library).
    //
    // Only the VC half is declared. The five TTS weight ids in assetDeps
    // (`chatterbox-ve` / `-t3` / `-s3gen` / `-tokenizer` / `-conds`, 4.25GB) belong
    // to the Chatterbox MODEL (Text to Speech, MPI-1012) — declaring them here would
    // make every Voice Changer user download a text-to-speech model they never run.
    //
    // THE WEIGHT DEPS ARE `targetPath` AND MUST STAY THAT WAY. The pack computes
    // `<ComfyUI>/models/chatterbox/` from its own `__file__` and never reads
    // extra_model_paths.yaml, so a weight filed under mpi_models/ is simply absent
    // and `hf_hub_download` fetches it again — outside the download manager, with no
    // progress, no sha check, no GC, on every engine reinstall. Same class as RIFE
    // (MPI-222).
    {
        id: 'voice-changer',
        title: 'Voice Changer',
        // Both drawn from ONE real run of this flow (MPI-622): the performance, the
        // target sample and the result, all off disk. The flow changes nothing you
        // can see and the hero is muted, so a before/after would be two identical
        // panels — the device animates the channel that changed instead. The
        // performance draws in frost, then a sweep re-colours it to the TARGET
        // lane's heat while the silhouette holds, because it measurably does hold:
        // envelope Pearson r = 0.867 between take and result, against -0.004 for
        // the target voice. Timing survives, timbre does not — which is the flow.
        // The tile is the same two takes stacked, YOU over THEM, since a 4/5 crop
        // of the hero would throw a whole lane away.
        preview: 'flow-voice-changer.webp',
        video: 'flow-voice-changer.mp4',
        description: 'Say it in someone else’s voice. Record yourself performing a line, pick the voice you want it in, and Chatterbox keeps every bit of your delivery — timing, breath, even a laugh or a cough — while swapping the voice itself.',
        requiredModels: [],
        // `ComfyUI-MpiNodes` is deliberately NOT declared, even though the graph runs
        // MpiLoadAudio and MpiInt. `requiredDeps` means "flow-only weights/nodes that
        // NO MODEL requires" — every model in the registry declares MpiNodes, so
        // listing it here does not describe this flow, and the cost is real: a flow's
        // deps are protected UNCONDITIONALLY in `_localSharedDepsMap` (a flow is
        // always "present", unlike a model), so declaring a dep the whole registry
        // shares pins it for every uninstall and breaks the MPI-258 B1 invariant that
        // a tier family with neither transformer installed stays deletable. It
        // reaches the engine anyway: `getUniversalWorkflowDepIds()` returns EVERY
        // `type: 'custom_nodes'` dep, and the boot gate installs and drift-repairs
        // that whole set independently of any model or flow.
        requiredDeps: [
            'chatterbox-vc-s3gen',          // 1008.20MB — the VC generator
            'chatterbox-vc-conds',          // 104.86KB — its conditionals
            // The one node pack that IS flow-only — no model declares it. Same
            // reasoning as head-swap declaring comfyui-inpaint-cropandstitch.
            'ComfyUI_Fill-ChatterBox',      // FL_ChatterboxVC
        ],
        operation: 'flowVoiceChanger',
        workflow: 'flow_voice_changer.json',
        mediaType: 'audio',
        type: 'edit',
        inputSchema: {
            media: [
                // ONE group, two roles, index-aligned labels — the head-swap shape.
                // Which clip plays which part is the whole of this flow, so neither
                // slot can be left to the frame's "Audio 1 / Audio 2" fallback.
                {
                    type: 'audio', mode: 'upto', max: 2,
                    roles: ['audio1', 'audio2'],
                    labels: ['Your performance', 'Target voice'],
                    // The shipped voice library, offered as a third source inside the
                    // media picker on the "Target voice" slot only (MPI-622). Index-aligned
                    // with roles/labels, and `null` on slot 0 deliberately: "Your
                    // performance" is the one thing that has to be the user's own take, and
                    // a stock voice there would just convert one library voice into another.
                    // The value is the picker ROUTE, so the play button previews the raw
                    // sample — the actual file handed to `target_voice` — rather than a
                    // generated audition of a conversion that has not happened yet.
                    voiceLibrary: [null, 'character'],
                },
            ],
        },
        // No `result.compare`: the shared before/after surface is a draggable reveal
        // bar over two images, and there is nothing to reveal between two waveforms.
        //
        // No `fields` and no `steps` either. The seed is filled by `_buildParams`
        // from the run's own seed (the `Input_Seed` MpiInt convention), and the two
        // knobs FL_ChatterboxVC does expose — `use_cpu`, `keep_model_loaded` — are
        // engine plumbing, not choices a user should be making. What DOES decide the
        // result is how the performance is recorded, and that guidance is measured,
        // not tunable: perform but do not push; pick a target that sounds nothing
        // like you (similar voices make the conversion nearly inaudible, which is
        // what an "it did nothing" report usually is); meet the target's pitch; hold
        // that pitch steady, because drift within a take drifts the output. Rules 2
        // and 3 only look contradictory — distance in TIMBRE is what makes the
        // conversion audible, distance in PITCH is what you compensate for.
    },
    // MPI-607 "Text to Speech" (`chatter-box`) left the Library in MPI-1012: it is the
    // Chatterbox MODEL in the prompt box now (models.js; old ids: js/data/retiredFlows.js).
    // MPI-663 — "Stems". One track in, four stem files out, and the ONLY multi-output
    // flow in the Library: its four `Output_Audio_1..4` SaveAudioAdvanced nodes each land
    // their own gallery card. It is the export bridge — generate several songs, listen,
    // stem the keeper, finish it in a DAW — and it works just as well on audio the user
    // brought in, which is probably the wider use.
    //
    // A SEPARATE FLOW FROM MUSIC GENERATION (MPI-664), not a second stage of it. One Flow
    // is one dispatch and there is no second Run button; stemming every candidate would
    // also spend GPU on tracks that get binned.
    //
    // Hybrid Demucs v3 (`HDEMUCS_HIGH_MUSDB_PLUS`) — a generation behind htdemucs_ft and
    // BS-Roformer, so expect vocal bleed into Other and reverb tails following the vocal.
    // The user has heard it and accepted it ("bleeds can be fixed in the mix"). No
    // instrumental output in v1: it is two `AudioCombine` nodes on `add` away if wanted,
    // and `add` is not optional — chained `mean` silently weights bass .25 / drums .25 /
    // other .5.
    //
    // FLAC, never MP3. The source is already lossy from MiniMax; separating, re-encoding
    // and then mastering stacks artifacts three deep. Output is always 44.1 kHz whatever
    // went in — `sources_to_tuple` stamps the model's own rate, so a 32 kHz MiniMax track
    // is upsampled on the way in and never brought back down.
    {
        id: 'stems',
        title: 'Stems',
        // Five lanes, real waveforms off a real run: the frost SOURCE over the four heat
        // stems. The hero draws the stems in left to right under a heat playhead, holds,
        // then lifts them back off — so it returns to the source alone and the loop point
        // is invisible. The tile is the same layout with every lane filled.
        preview: 'flow-stems.webp',
        video: 'flow-stems.mp4',
        description: 'Pull a track apart. Drop in a song — one you made here or one you brought — and get bass, drums, vocals and everything else back as four separate files, ready to take into a DAW and mix properly.',
        requiredModels: [],
        // Flow-only node pack: no model declares it, same reasoning as head-swap and
        // `comfyui-inpaint-cropandstitch`. `ComfyUI-MpiNodes` stays OUT even though the
        // graph runs MpiLoadAudio and MpiClearVram — see voice-changer above for why
        // declaring a registry-wide dep on a flow breaks the MPI-258 B1 invariant.
        requiredDeps: [
            'audio-separation-nodes-comfyui',   // AudioSeparation (Hybrid Demucs)
        ],
        operation: 'flowStems',
        workflow: 'flow_stems.json',
        mediaType: 'audio',
        type: 'create',
        inputSchema: {
            media: [
                { type: 'audio', mode: 'upto', max: 1, roles: ['audio1'] },
            ],
        },
        // FOUR STEM TOGGLES + COMBINE. The four `Input_Get_*` ids name `MpiBlocker` gates
        // in the graph, whose `input` is LAZY — an off gate skips the work feeding it, so
        // an all-off run would not even load the separator. That is also why they carry
        // `group`/`minActive`: a run with every stem off blocks every branch, reports
        // SUCCESS, and lands nothing at all (02-media-io.md § Self-gating is not the same
        // as HANDLED). The frame locks the last one on rather than letting the user reach
        // that state. Note the cost is all-or-nothing anyway: any single stem selected
        // runs the full separation, so picking fewer saves save-time, not GPU.
        //
        // `combine` carries NO `Input_` prefix, and that is the whole design. Prefixed ids
        // route into `injectionParams` and name a graph node; this one names no node —
        // combining is done APP-SIDE with ffmpeg after the run, because combining a SUBSET
        // in-graph is not expressible: a blocked `MpiBlocker` branch cannot feed an
        // `AudioCombine` (it blocks the combine too), so the graph would need a silence
        // source, three chained combines and a separated/combined switch. Unprefixed, it
        // lands in `flowInputs` where generationService reads it. A prefixed id here would
        // be SILENTLY skipped at injection and the toggle would do nothing.
        //
        // AudioSeparation's own three knobs (chunk_fade_shape, chunk_length, chunk_overlap)
        // are chunking plumbing, not choices about the result, so they stay baked at the
        // values proven on the bench.
        fields: [
            { id: 'Input_Get_Bass',   type: 'toggle', label: 'Bass',   icon: 'stem_bass', default: true, group: 'stems', minActive: 1 },
            { id: 'Input_Get_Drums',  type: 'toggle', label: 'Drums',  icon: 'stem_drums', default: true, group: 'stems', minActive: 1 },
            { id: 'Input_Get_Other',  type: 'toggle', label: 'Other',  icon: 'stem_other', default: true, group: 'stems', minActive: 1 },
            { id: 'Input_Get_Vocals', type: 'toggle', label: 'Vocals', icon: 'mic',   default: true, group: 'stems', minActive: 1 },
            {
                id: 'combine', type: 'toggle', label: 'Combine into one file', icon: 'merge',
                default: false,
                // Nothing to combine until two stems are selected. Greyed, not hidden — a
                // control that appears and disappears reads as a bug. It KEEPS its value
                // while disabled, so generationService re-checks that more than one file
                // actually landed rather than trusting the flag.
                enabledWhen: { group: 'stems', atLeast: 2 },
                info: 'Mix the selected stems back into a single track instead of one card each.',
            },
        ],
        // No `result.compare` — the shared surface is a reveal bar over two images, and
        // the output is new files, not a changed version of the input.
    },
    // MPI-596 — "Object Stamp". Take an object out of one photo and put it into
    // another. Draw It In's architecture with the scribble swapped for a real object:
    // the object is composited onto the user's scene, a crop is taken around it, Klein
    // 9B edits that crop, and the boxed region is stitched back.
    //
    // ONE GRAPH, TWO MODES, and the mode is a real fork in the wiring rather than a
    // prompt change. Three `MpiAnySwitch` nodes read `Input_Mode`:
    //   Auto   — reference 1 is the clean scene cropped to the region, reference 2 is
    //            the STAMPED COMPOSITE. The object keeps its own pixels, so identity is
    //            free and the model spends no words on it.
    //   Manual — reference 2 is the CLEAN OBJECT at full frame and nothing is stamped.
    //            Buys a viewpoint the object's source photo cannot give, and pays for it
    //            in exact identity: the model has no 3D model of that object and
    //            synthesises a generic one. A live run returned a beautifully lit pistol
    //            that was not the user's. Auto is the default for exactly this reason.
    //
    // TWO REFERENCES, NEVER THREE — the documented identity-mixing limit, and three is
    // what made the model draw two guns. Both baked prompts say "image two into the
    // scene of image one", so REFERENCE ORDER IS SEMANTIC: reference 1 is always the
    // scene, reference 2 always whatever carries the object.
    //
    // Both modes proven end to end on the bench 2026-08-27 (26.1s each on a 4060 Ti),
    // and the unified graph is pixel-identical to the two separate graphs it replaced.
    {
        id: 'object-stamp',
        title: 'Object Stamp',
        // Both cut from ONE real run — `t2i_003` -> `flowObjectStamp_003`, the cleanest
        // pair in the test corpus at 1.09% of pixels changed. The hero is deliberately
        // NOT full frame: the candlestick body is only 53px of 1280, so a full-width
        // wipe would have crossed identical pixels for ~45% of its travel, which is the
        // dead-air failure Outpaint's first hero was thrown away for.
        preview: 'flow-object-stamp.webp',
        video: 'flow-object-stamp.mp4',
        description: 'Take an object out of one photo and put it into another — a mug on your desk, a lamp in your living room, a bag on a chair. The object keeps its own shape and markings, and the flow lights it with the scene it lands in, resting it on the surface it touches and giving it a shadow that matches the ones already there. You clean the object up first, then say where it goes.',
        // ONE slot, 9B only. 4B was tested and FAILED (Fabio, 2026-08-26) — the same
        // call Draw It In made, for the same reason: under load 4B follows the source
        // shape more closely and integrates worse.
        //
        // `loras: true` rides on the slot, so the rack follows the card the user picked.
        // The Draw It In hazard applies here in full: a style LoRA restyles the WHOLE
        // photograph, not just the inserted object. Opt-in, so it is the user's to
        // choose rather than one the flow forbids on their behalf.
        //
        // NO cloud candidate (MPI-918, Fabio 2026-10-01). The local edit samples from the
        // clean crop's latent with both references beside it, which is what cleans the
        // stamp into the scene; a cloud call only sees two pictures, so its result kept a
        // seam and shifted the colour of the crop. Splitting the graph in two would be the
        // way back (the two-reference support in utils/cloudEditGraph.js is kept for it).
        requiredModels: [
            { label: 'Edit model', models: ['klein-9b'], loras: true },
        ],
        // THE CLIP ARM IS NOT OPTIONAL TRIM. Klein 9B needs `qwen_3_8b_int8_convrot`;
        // pairing it with 4B's encoder dies with a shape error that reads as a sampler
        // bug and is not one (MPI-600). The text encoder moves WITH the checkpoint.
        //
        // `Input_Edit_Clip.clip_name` uses the dotted `Title.widget` form (MPI-359)
        // while `Input_Edit_Model` stays plain, and that asymmetry is load-bearing:
        // `unet_name` is on `comfyController._inject`'s spray list and `clip_name` is
        // NOT, so a plain `Input_Edit_Clip` would match the node and write nothing.
        modelParams: {
            'klein-9b': {
                'Input_Edit_Model': 'flux-2-klein-9b-int8-convrot.safetensors',
                'Input_Edit_Clip.clip_name': 'qwen_3_8b_int8_convrot.safetensors',
            },
        },
        operation: 'flowObjectStamp',
        workflow: 'flow_object_stamp.json',
        // The agent loads both pictures; the user cleans the object up and places it. Opens on
        // the clean-up step, whose hint already says to skip it for a cut-out (MPI-892).
        agentOpens: 'cutout',
        mediaType: 'image',
        type: 'edit',
        inputSchema: {
            // TWO user slots, unlike Draw It In where `image2` is derived and never
            // offered. Here the object IS an upload — it is the whole point — and the
            // labels carry which image plays which part, because the frame otherwise
            // falls back to "Image 1 / Image 2".
            //
            // `image2` is then REWRITTEN twice on the way to the run: the `cutout` step
            // replaces it with the cleaned object, and in Auto the `place` step
            // overwrites that with the stamped layer via `mediaRole`.
            media: [
                {
                    type: 'image', mode: 'upto', max: 2,
                    roles: ['image1', 'image2'],
                    labels: ['Scene', 'Object'],
                },
            ],
        },
        // The BEFORE is the user's own scene, and the flow's whole claim is that only
        // the boxed region changed — so the reveal bar crosses a steady picture.
        result: { compare: 'image1' },
        // STEP ORDER IS LOAD-BEARING AND IT FAILS SILENTLY. `_deriveRunMedia` walks
        // these in DECLARATION order, and `place` stamps whatever sits in `sourceRole`
        // at the moment it runs. Declare `cutout` second and stage 3 stamps the UNCUT
        // object — background and all — and the run still completes and still returns a
        // picture. There is no error to catch this; only the order.
        steps: [
            {
                // Stage 2, on the OBJECT. No gizmo, so no `param` and no `mediaRole` —
                // it replaces its own role's file.
                //
                // SKIPPABLE BY CONSTRUCTION, with no flag: untouched, `composeCutObject`
                // returns null, the frame reads a null as "this kind changed nothing",
                // and `image2` reaches the run byte-identical instead of being
                // re-encoded through a canvas for nothing. So a PNG that arrived already
                // cut out costs nothing here.
                kind: 'cutout', role: 'image2',
                tickerLabel: 'Cut it out',
                title: 'Clean up the object',
                // The brush works with Remove Background OFF, which is not a detail: for
                // sources BiRefNet whiffs entirely it is the only way to cut. The two
                // mask layers are never flattened, so toggling the background off and on
                // preserves erasures.
                hint: [
                    'Remove the background, then erase whatever it left behind. Restore paints pixels back.',
                    'Already cut out on transparency? Skip this step.',
                ],
            },
            {
                // Stage 3, on the SCENE, placing the OBJECT — the one kind that reads two
                // roles. `sourceRole` names what it stamps; `mediaRole` sends the result
                // to `image2` rather than replacing the scene.
                //
                // In MANUAL this derives NOTHING: the clean object is already `image2`,
                // put there by the cutout stage, so deriving would hand the run a second
                // copy of a picture it has. Manual contributes only the region and the
                // mode — unless the object is FLIPPED, when it derives the object
                // mirrored and `mediaRole` puts that over `image2` (MPI-998).
                kind: 'place', role: 'image1', sourceRole: 'image2', mediaRole: 'image2',
                // An OBJECT `param`, not a string — this kind feeds two nodes. `region`
                // goes to `Input_Box` through the box injector (an MpiBox carries four
                // widgets the generic title injector would match and silently not
                // write), and `mode` to `Input_Mode`, the `MpiAnySwitch` selector that
                // picks the crop source, reference 2 and the baked instruction. Lose
                // `mode` and a Manual run silently gets Auto's wiring and still renders.
                param: { region: 'box1', mode: 'Input_Mode' },
                tickerLabel: 'Place it',
                title: 'Put it where you want it',
                // DECLARED HERE AND NOWHERE ELSE. Restating it in the flow's own `fields`
                // so it is also editable on the run slide SILENTLY DROPS EDITS from the
                // second run onward: a gizmo step's fields are role-keyed in
                // `_stepValues[role].fields` while flow fields live in `_fieldValues`,
                // and `_collectInputs` applies the flow store LAST (MPI-620).
                //
                // Optional and empty by default — unlike Draw It In, where the drawing is
                // a silhouette and the words are the only thing naming the subject. Here
                // the object names itself. This is the escape hatch for what the flow
                // cannot know and the user can see: pose in Manual, and scene-specific
                // lighting in either mode.
                fields: [
                    {
                        id: 'positive', type: 'text', rows: 2, label: 'Anything to add?',
                        // PLACEHOLDER COPY IS LOAD-BEARING — it is where the user learns
                        // the Manual move. Describing a pose is what buys the viewpoint.
                        // LIGHTING FIRST, because that is the half that works in BOTH modes:
                        // the field is live in Auto too (node 18 concatenates Input_Positive onto
                        // whichever instruction the switch picked), and scene-specific light is
                        // the one thing a baked prompt can never name. The POSE example is second
                        // and marked, because a pose only buys anything in Manual - in Auto the
                        // stamp already pins the viewpoint and asking for another fights it.
                        placeholder: 'e.g. "warm sunlight from the left window" - or, in Manual, "lying flat on its side, seen from above"',
                    },
                ],
                // Says what each mode COSTS, because the trade is not visible until the
                // result comes back. Auto is default; Manual is the escape hatch.
                // ALT-DRAG IS NAMED HERE BECAUSE NOTHING ELSE NAMES IT (Fabio, 2026-08-27).
                // The gesture is ALT + drag a HANDLE (`MpiStepPlace` mousedown: it needs a
                // `shape.hitTest` hit, so a bare ALT-drag on the canvas does nothing), and it
                // is AUTO-ONLY — Manual's box is a region, and swinging it would say the model
                // reads it at an angle, so ALT is ignored there. An undiscoverable gesture is
                // the same failure as an inert control: the user never finds it and the flow
                // looks like it cannot do the thing it can.
                // MODE-KEYED, because half of this used to be wrong wherever it was read:
                // the Manual redraw trade-off showed while the user sat in Auto, where
                // none of it applies, and ALT-rotate showed in Manual, which has no
                // rotation at all (Fabio, 2026-08-27). `base` is what is true in both.
                // NO `base`, because the two modes share almost nothing on screen: Auto
                // shows the OBJECT and Manual shows only a REGION. The old shared lines said
                // "drag the object where it should sit" in Manual, where there is no object
                // to drag, and told Auto to leave room on the ground for a shadow — which is
                // self-defeating, since Auto's box IS the object and growing it just makes
                // the object bigger. The shadow margin is not the user's job at all: the
                // graph grows the write-back ~30% off the box side (law 8, node 225).
                //
                // Kept SHORT on purpose. The mode radio already carries a tooltip explaining
                // what each mode does, so repeating it here is a wall the user scrolls past
                // (Fabio, 2026-08-27, twice).
                hint: {
                    auto: [
                        'Drag and scale the object to where it should sit.',
                        'ALT + drag a corner rotates it. Shift keeps its proportions.',
                    ],
                    manual: [
                        'The model only sees what is inside the box. Put it where the object should go, with a little room around it.',
                        'Describe the object and the angle you want in the box above.',
                    ],
                },
            },
        ],
    },
    // MPI-664 — MiniMax Music 3. A brief in, a finished song out: lyrics optional, a
    // cast of voices optional, and one of eighteen style families to route it.
    //
    // 🔴 `id` MUST STAY `minimax-music`. `licences.js` keys `MINIMAX_MUSIC3` on
    // `flow:minimax-music` (= `flowDepKey(id)`), and a lookup MISS IS SILENT — rename
    // this and 13.3GB of licensed weights install with no gate shown at all.
    //
    // NO MODEL and NO MEDIA. `requiredModels: []` with the three weights in
    // `requiredDeps` is the Voice Changer shape — a FLOW WITH DEPS, deliberately not a
    // ModelDef (nothing about a music model belongs in the image/video model picker).
    // And no `inputSchema.media`: text is the entire input, so step 0 renders its own
    // "this flow needs no input media" panel. `mediaType: 'audio'` is what routes the
    // graph's `Output_Audio` to a real gallery card rather than a video's soundtrack
    // side-channel (MPI-573).
    //
    // THE CAPTION IS BUILT BY THE GRAPH, not by the model (GAP 4 option B, Fabio
    // 2026-08-31). The enhancer writes only three PROSE blocks — mood, vocal and
    // arrangement; the graph writes the three headings, Basic Attributes, the
    // instrumental clause and the serialised roster around them. So the style phrase,
    // the BPM and the cast reach the encoder EXACTLY as chosen: a 4B asked to hold
    // "78 BPM" in prose rounds it to "around 80".
    //
    // 🔴 TWO STEPS, REDESIGNED 2026-09-02. The first shape had five and Fabio rejected
    // it on sight — *"The UI is all over the place… there are way too many steps, and
    // it's bad."* What replaced it is his: the song and its style are ONE stage with the
    // exact controls on the left and the prose on the right, and voices and lyrics are
    // ONE stage laid out the same way. The old order was forced by the roster having to
    // exist before the lyrics box could offer it; side by side, that constraint is
    // simply gone.
    //
    // Both middle steps are `kind: 'fields'` (FRAME_KINDS) — no canvas, no `role`,
    // values in the FLOW store — which is also what lets the brief be ONE value edited
    // on the song step and on the run slide.
    //
    // The three prose blocks are THREE BOXES, not one (MPI-664, 2026-09-02). They were a
    // single 12-row `Input_Caption` labelled "Mood, vocal and arrangement" and it read as
    // nothing: *"as much as I read it, I still don't know what it is or how to use it…
    // there are no examples… and what is he now going to do? Replace my prompt?"* Three
    // labelled boxes with a real example in each answer all three questions at once, and
    // watching Enhance fill them is what shows the button does not touch the brief. The
    // enhancer still answers in ONE marked string; `to` names which marker lands where,
    // and the frame splits it (MpiBaseFlow § _writeEnhanced).
    {
        id: 'minimax-music',
        // Fabio, 2026-09-01: "Text to Music" is not a good name — it reads as the model's
        // task, not the thing the user gets. "Music Maker" instead, the register Voice
        // Changer and Head Swap already set. The `id` does NOT follow: `licences.js` keys
        // MINIMAX_MUSIC3 on `flow:minimax-music` and a lookup miss is SILENT.
        //
        // 🔴 RETITLED AGAIN, "Music Maker" -> "Song" (Fabio, 2026-09-05), when the
        // instrumental half split off into its own flow. "Music Maker" claimed the whole
        // territory and this flow now owns exactly one part of it: songs, with words,
        // sung. `Sound & Music` (MPI-694, Stable Audio 3; a prompt-box model since
        // MPI-1012) owns the rest. The `id`, the op
        // key `flowTextToMusic` and the `filePrefix` all STAY — a renamed op id is a
        // tombstone problem (MPI-533), not a rename.
        title: 'Song',
        // Art off `flowMusicMaker_013` — a real 120s run, "Don't wake the morning", one
        // cast voice. The LYRIC SHEET is what nothing else in the set has, so both assets
        // lead with its grammar (`[Chorus]` in heat, `<Singer A>` in frost) rather than
        // with another line-of-type-over-a-waveform, which is already Chatter Box's tile
        // and Drama Box's. The hero writes the sheet a group at a time, then draws the
        // track under a heat playhead, then returns to the bare page — loop seam measured
        // 0.006/255. The band is a 12s excerpt on purpose: the whole two minutes averages
        // into a flat pink brick at 220px and says nothing.
        preview: 'flow-song.webp',
        video: 'flow-song.mp4',
        // NO "for instrumentals, use Sound & Music" TAIL, same reason as its twin
        // (Fabio, 2026-09-07): naming the other flow from INSIDE this one reads as an
        // option on this one. Each description says what its own flow makes; the Flow
        // Library is where the choice between them is made.
        description: 'Describe a song and hear it sung. Say what it should feel like, pick a style, write your own lyrics and cast the voices that perform them — MiniMax Music 3 writes and sings the whole track.',
        requiredModels: [],
        // FOUR weights, 18.22GB (the three MiniMax ones are 13.34GB measured — never
        // typed: `computeDepHashes.py --sizes`, because `size` is parsed 1024-based and
        // HuggingFace displays decimal). `ComfyUI-MpiNodes` is deliberately NOT here
        // even though the graph runs MpiText/MpiIfElse/MpiInt: every model in the
        // registry declares it, so listing it would pin it for every uninstall — the
        // same reasoning spelled out on `voice-changer` above.
        requiredDeps: [
            'minimax-music3-dit',           // 4.58GB — the DiT
            'minimax-music3-text-encoder',  // 8.57GB — pruned int8. The bf16 twin was
                                            // tested and abandoned: 15.9GB staged on a
                                            // 16GB card, ~33min for the AR stage alone
                                            // against 240s end to end. Do not retry it.
            'vae-minimax-music3-dav',       // 206.66MB — the DAV VAE
            // 🔴 4.88GB — THE ENHANCER, AND IT IS NOT OPTIONAL ANY MORE (MPI-664).
            // It was undeclared for as long as Enhance was a button: an install without
            // it lost a button that warned, which is survivable. The one-box design runs
            // the enhancer as step one of Generate (see `enhance` below), so on a clean
            // install an undeclared weight is a Generate that dies. Since MPI-1045 it is an
            // engineAsset, installed WITH the engine, so this line costs nobody a download;
            // it stays declared so the Flow never depends on that flag.
            'qwen3vl-abliterated-clip',
        ],
        operation: 'flowTextToMusic',
        workflow: 'flow_minimax_music.json',
        // No `agentOpens`: the APP asks first, on a card showing the lyrics (MPI-1005); Review
        // lyrics opens on "Write the song" with them in, Just do it runs it (Fabio, MPI-892).
        agentReview: 'Input_Lyrics',
        mediaType: 'audio',
        type: 'create',
        // No `inputSchema` at all, and no `result.compare` — there is no BEFORE.
        // THE ENHANCER RUNS INSIDE GENERATE, AND HAS NO BUTTON (Fabio, 2026-09-02:
        // *"the enhancer runs silently, but it only runs if the user has changed the
        // prompt. If the user changes the prompt and presses Generate, the enhancer
        // runs, and only then does the music workflow run"*).
        //
        // WHY IT IS DECLARED HERE AND NOT AS A FIELD. A `button` field was the carrier
        // for as long as there was a button; with the button gone, hanging the
        // declaration on a hidden one would put a dead `<button>` in the DOM purely to
        // hold data. `flow.enhance` is the same object minus the control — the frame
        // reads `action` and `auto` as implied, because a declaration nobody can press
        // can only be automatic.
        //
        // `from` IS A LIST, and it is also the CACHE KEY: these are exactly the fields
        // whose change makes the previous answer stale, which is why the frame re-runs
        // on a change to any of them and skips otherwise. The enhancer writes an
        // arrangement, so it has to know the genre; it writes the [VOCAL] block, so it
        // has to know who sings.
        //
        // 🔴 THE CAST JOINED `from` ON 2026-09-11, AND IT IS A BUG FIX. Without
        // `Input_Voices`/`Input_Voice_Notes` the enhancer wrote the vocal block BLIND:
        // Fabio cast a man and a woman, and it returned *"Female lead, breathy,
        // restrained … no harmonies, no ad-libs, no layered backing vocals"* having
        // never seen there were two singers. `Cat_Vocal_Body` (node 87) concatenates
        // roster + voice notes + this prose IN THAT ORDER, so the invented sentence came
        // LAST and negated both facts before it, and `Strip_Voice_Markers` (77) had
        // already taken `<man>`/`<woman>` out of the lyrics — one woman, no harmonies,
        // exactly what he heard. The staleness side effect is the correct one: editing
        // the cast now marks the vocal block stale, exactly as editing the brief does.
        //
        // 🟡 DO NOT "FIX" THIS BY REORDERING `Cat_Vocal_Body` so the prose comes first.
        // Which clause wins inside one prose blob is a coin flip; the defect was that
        // the rewriter could not see the cast at all.
        //
        // 🔴 `Input_Instrumental` AND `Input_Structure` LEFT `from` ON 2026-09-05, with
        // the controls (see the step below). Tempo is NOT here either: the graph states
        // the BPM
        // verbatim and a 4B asked to carry "78 BPM" through prose rounds it to "around
        // 80". THE LYRICS ARE STILL NOT HERE and must not be added: they reach the
        // caption on their own wire, and as a cache key a 16-row box would restage the
        // enhancer on every keystroke of the one field the user types most.
        //
        // 🔴 THIS IS WHY `qwen3vl-abliterated-clip` IS IN `requiredDeps` (see above).
        // While Enhance was a button, an install without the enhancer lost a button
        // that warned; now it would lose Generate.
        // 🔴 THE ONE RECIPE RULE THAT MUST SURVIVE ANY EDIT: *never invent a running
        // order, a section list or a timing.* The first two live runs had the enhancer
        // writing a complete TIMED plan nobody asked it for — *"opens with a single,
        // pulsing sub-bass drone… At 1:20, the strings enter… By 2:15, the full
        // orchestra erupts"* — while the user's own sections sat in the lyrics slot. The
        // caption OUTRANKS the lyrics slot, so the model played the 4B's song: Fabio
        // asked for a single orchestral drum in the intro and got a drone and muted
        // brass. It was not disobeying; it was obeying the other plan in the same
        // caption. The running order is the user's, stated in their lyrics, and the
        // rewriter's job stops at texture.
        enhance: {
            from: ['positive', 'Input_Style', 'Input_Style_Custom', 'Input_Voices', 'Input_Voice_Notes'],
            to: {
                MOOD: 'Input_Mood',
                VOCAL: 'Input_Vocal',
                ARRANGEMENT: 'Input_Arrangement',
            },
            injectionParams: MINIMAX_MUSIC_ENHANCE_PARAMS,
        },
        // No `inputSchema` at all, and no `result.compare` — there is no BEFORE.
        //
        // ONE STEP, then the run slide (Fabio, 2026-09-02). The song stage and the
        // lyrics stage merged: *"what we have in the lyrics section moves to the song
        // section… the style and tempo move to the last section, along with the Your
        // Song box"*. What made two steps necessary was three prose boxes that had to
        // be seen being written; with the enhancer silent there is nothing to watch, so
        // the surface collapses to the two things the user actually authors — the cast
        // and the words — and everything you SET moved to the slide you set things on.
        steps: [
            {
                // THE SONG STAGE — cast on the LEFT, words on the RIGHT.
                kind: 'fields',
                tickerLabel: 'Song',
                // The hint has to state the thing that cost two GPU runs to learn — text
                // outside a tag is SUNG — because nothing on screen implies it.
                title: 'Write the song',
                // ROUND BRACKETS ARE THE GAP THIS HINT USED TO LEAVE (Fabio, 2026-09-10).
                // Reading ComfyUI's own template lyrics — `(rain on the window)`,
                // `(take your time, take your time)` — the obvious inference is that
                // `(…)` is a channel for telling the model what to play. It is not:
                // `normalize_lyrics` splits on SQUARE brackets only, so a round-bracket
                // run travels in the same stream as any lyric line. In the lyric-sheet
                // convention the model was trained on it means a BACKING VOCAL, which is
                // why the template uses it for call-and-response. Left unsaid, the hint
                // invited exactly the mistake runs 1 and 2 already paid for.
                //
                // A BARE TAG is the one real instruction the lyrics box can carry —
                // `[Instrumental]` with nothing under it buys a section with no vocals.
                // Said out loud here because it is the answer to "how do I get a guitar
                // break", and the tag channel is MiniMax's closed nine words or nothing.
                hint: 'Mark sections with [Intro] [Verse] [Pre-Chorus] [Chorus] [Post-Chorus] [Bridge] [Instrumental] [Solo] [Outro] — type @ in the lyrics to pick one. They steer the arrangement rather than guarantee it, and a tag with nothing under it buys a section with no vocals. Every line outside a tag is sung, and so is anything in round brackets: (like this) is a backing vocal, not a note to the model, so instruments and production belong in Your song or Style. The lyrics cannot hand a line to a particular voice — say who sings where in Voice notes instead.',
                fields: [
                    {
                        // The roster (MPI-664 tier 2). Its `v` values are the CAPTION
                        // WORDS, not indices: `serialiseVoices` writes `Voice N (Type)`
                        // straight into the caption's Vocal Details, so there is no
                        // switch bank and no lookup table to drift.
                        //
                        // `Any` is the catch-all and emits the bare LABEL — writing
                        // "Voice 2 (Any)" would state a quality the user never chose.
                        //
                        // 🔴 NO NAME BOX, and the `note` is the whole promise (Fabio,
                        // 2026-09-12). Five runs said the cast is a bias the seed can
                        // refuse, so the control must not read as a guarantee — see
                        // `serialiseVoices` for the runs and what separates them.
                        id: 'Input_Voices', type: 'voices', label: 'Voices',
                        note: 'MiniMax decides how many voices actually sing. Casting two makes a duet likely, not certain — re-roll if it comes back as one.',
                        default: [{ type: 'Any' }],
                        options: [
                            { v: 'Any', label: 'Any' },
                            { v: 'Female', label: 'Female' },
                            { v: 'Male', label: 'Male' },
                            { v: 'Child', label: 'Child' },
                            { v: 'Duet', label: 'Duet' },
                            { v: 'Choir', label: 'Choir' },
                        ],
                    },
                    {
                        // Timbre, delivery and backing vocals — the three Vocal Details
                        // sub-labels a roster slot cannot express.
                        id: 'Input_Voice_Notes', type: 'text', rows: 4, label: 'Voice notes',
                        // THE PLACEHOLDER TEACHES THE ONLY WORKING GRAMMAR FOR PLACEMENT
                        // (2026-09-12). With the lyrics box unable to address a voice,
                        // this is where "who sings where" lives, so it shows both halves
                        // — a voice referenced by its roster position, and a section.
                        placeholder: 'Voice 1 raspy and close-miked, takes the verses; Voice 2 smooth, layered harmonies on the chorus…',
                        default: '',
                    },
                    {
                        // 🔴 EVERY LINE OUTSIDE A TAG IS SUNG, and that cost two live
                        // runs on Fabio's own GPU to learn. `normalize_lyrics` keeps
                        // `[section]` tags verbatim, so this box reads as a place to
                        // describe a track — it is not. The tags survive, but the prose
                        // BETWEEN them is a lyric line and the model sings it. Run 1
                        // (bare tags, prose underneath) put a man singing the stage
                        // directions. Run 2 folded the directions INSIDE the brackets,
                        // Suno-style — `_LYRIC_TAG_RE` is `\[[^\]]+\]` so any bracketed
                        // run is a legal tag — and the model sang those too. This is what
                        // the step's `hint` is for; nothing on screen implies it.
                        //
                        // The markers are STRIPPED IN THE GRAPH before the encoder sees
                        // this (`Strip_Voice_Markers`), because `<Name>` is not in
                        // MiniMax's tag set and the lyrics reach the model verbatim.
                        //
                        // 🔴 `default: ''` IS LOAD-BEARING. `_seedField` returns
                        // undefined for a field with no `default` and the seeding loops
                        // skip an undefined, so the id never reaches `injectionParams`
                        // and THE GRAPH'S BAKED VALUE RUNS — this node is baked with the
                        // bench's own demo song, so without it a user who leaves the
                        // lyrics empty hears that song's words.
                        id: 'Input_Lyrics', type: 'text', rows: 16, label: 'Lyrics',
                        col: 'right',
                        // `@` LISTS THE NINE SECTION TAGS (MPI-664, 2026-09-12). The
                        // hint names them, but reading nine words off a paragraph and
                        // retyping one with the right bracket and the right hyphen is
                        // the user's problem otherwise — and it is the only channel in
                        // this box that steers the arrangement instead of being sung.
                        //
                        // 🔴 THIS IS THE SECOND `@` PICKER THE BOX HAS HAD, and the
                        // difference is the source. The first pointed at the voice
                        // roster (`mentions: 'Input_Voices'`) and inserted `<Singer A>`;
                        // `Strip_Voice_Markers` cuts every `<…>` run before the encoder
                        // and the lyrics never reach the enhancer either, so it wrote a
                        // no-op — Fabio followed the hint on two live runs for nothing.
                        // These nine DO execute: `normalize_lyrics` splits on square
                        // brackets and the graph's own `regex_pattern` in
                        // `comfy_workflows/flow_minimax_music.json` names exactly this
                        // list. Keep the two in step — a tenth word here is not a tag,
                        // it is a lyric line, and the model will sing it.
                        //
                        // Title Case is free: the graph lowercases before matching. It
                        // is spelled this way to match the hint the user just read.
                        tags: [
                            { tag: 'Intro' }, { tag: 'Verse' }, { tag: 'Pre-Chorus' },
                            { tag: 'Chorus' }, { tag: 'Post-Chorus' }, { tag: 'Bridge' },
                            { tag: 'Instrumental' }, { tag: 'Solo' }, { tag: 'Outro' },
                        ],
                        placeholder: '[Verse]\nMidnight and the canvas glows…',
                        default: '',
                    },
                ],
            },
        ],
        // The run slide: what you SET. The brief, the style, the tempo and the two
        // machine facts (Fabio, 2026-09-02: "the style and tempo move to the last
        // section/step, along with the Your Song box").
        //
        // THERE IS NO ENHANCE BUTTON ANY MORE, on this slide or anywhere. It was here,
        // then removed, then restored within one day, and each move was chasing the
        // same defect: the button wrote three boxes this slide does not show, so
        // pressing it looked like nothing happening. The fix in the end was neither
        // placement — it was to stop asking the user to press it. See `enhance` above.
        fields: [
            {
                // The brief. It reaches the model on its OWN wire now (`Input_Brief`,
                // prepended to Global Metadata — decision A, Fabio 2026-09-02): before
                // that it fed the enhancer and nothing else, so the one sentence
                // carrying the user's whole intent was paraphrased by a 4B and then
                // thrown away.
                id: 'positive', type: 'text', rows: 5, label: 'Your song',
                // A SONG BRIEF, not a picture (Fabio, 2026-09-02: "a late-night drive
                // through empty streets… what the fuck is that, mate? Are we prompting
                // for an image?"). The old line was a visual scene borrowed from the
                // image flows' register, and it taught the wrong thing on the one
                // control that sets the tone for the rest.
                //
                // AND IT MUST NAME A SUNG SONG (Fabio, 2026-09-07). Its replacement was
                // "Dark heavy soundtrack for a horror movie trailer" — a fine brief while
                // this flow still owned instrumentals, and wrong the moment MPI-694 split
                // them out: a soundtrack has no singer, so the placeholder was teaching a
                // brief this flow no longer serves and Sound & Music does. A voice, and
                // words to sing, are what this flow is now the only route to.
                placeholder: 'A soaring pop-rock anthem about leaving a small town behind, big chorus, female lead vocal.',
            },
            {
                // 18 families, and the option's `v` IS THE GENRE PHRASE — the same
                // shape the roster uses. NOT an int into an MpiAnySwitch bank:
                // `MpiAnySwitch` holds 5 arms and `MpiAnySwitch10` holds 10, so 18 fit
                // neither and chaining two banks would cost ~21 nodes for one string.
                //
                // The phrases are OURS. MiniMax's 1,000 template captions are
                // unlicensed and their own skill forbids copying them, so we conform to
                // their taxonomy and write our own prose for it. Each ends in a full
                // stop: `Cat_Style` joins this to the custom box with a space, so the
                // two must read as separate sentences.
                id: 'Input_Style', type: 'select', label: 'Style',
                default: 'Contemporary pop ballad, radio-ready production.',
                options: [
                    { v: 'Contemporary pop ballad, radio-ready production.', label: 'Pop ballad',
                      info: 'The fallback family — reach for it when the brief is a mood rather than a genre.' },
                    { v: 'Alternative pop-rock, live band instrumentation with guitars up front.', label: 'Pop / alt rock',
                      info: 'Guitars, bass and kit playing together, with a chorus built to be sung back.' },
                    { v: 'Dance pop with disco and funk instrumentation, four-on-the-floor groove.', label: 'Dance / disco funk',
                      info: 'Live groove — slap bass, clipped guitar, horn stabs over a steady kick.' },
                    { v: 'Club electronic dance music, house and trance production.', label: 'Club / EDM',
                      info: 'Synthesised and programmed: risers, drops and a sidechained pulse.' },
                    { v: 'Electronic synth pop with ambient textures and processed atmospheres.', label: 'Synth / ambient pop',
                      info: 'Softer and more spacious than club — texture carries it, not the drop.' },
                    { v: 'Hip-hop and rap, sampled or programmed beat with a rhythmic vocal lead.', label: 'Hip-hop / rap',
                      info: 'The vocal is rhythmic rather than sung; the beat is the arrangement.' },
                    { v: 'Modern R&B and neo-soul, laid-back groove with rich extended harmony.', label: 'R&B / neo-soul',
                      info: 'Behind the beat, jazz-leaning chords, vocal runs and stacked harmonies.' },
                    { v: 'Soul, blues and gospel with organ, choir and a raw lead vocal.', label: 'Soul / blues / gospel',
                      info: 'Older and rawer than neo-soul — church organ, choir answering the lead.' },
                    { v: 'Jazz swing and big band, brass section over an upright rhythm section.', label: 'Jazz / big band',
                      info: 'Swung time, sectional brass, an upright bass walking underneath.' },
                    { v: 'Contemporary folk and acoustic, fingerpicked guitar and close-miked vocal.', label: 'Folk / acoustic',
                      info: 'Small and intimate — a few instruments, played rather than produced.' },
                    { v: 'Country and Americana with pedal steel, acoustic guitar and close harmony.', label: 'Country / Americana',
                      info: 'Pedal steel and storytelling; harmony sung a third above the lead.' },
                    { v: 'Roots and traditional music from around the world, played on regional acoustic instruments.', label: 'Roots / world',
                      info: 'Reggae, afrobeat, cumbia and their neighbours — regional instruments and grooves.' },
                    { v: 'Metal and heavy rock, distorted guitars and a driving double-kick rhythm section.', label: 'Metal / heavy rock',
                      info: 'High gain, tight low end, tempo held by the kit rather than the riff.' },
                    { v: 'Cinematic pop ballad with orchestral backing behind a lead vocal.', label: 'Cinematic pop ballad',
                      info: 'A ballad with strings behind it — the voice still leads.' },
                    { v: 'Cinematic orchestral epic, full symphonic scoring.', label: 'Cinematic epic',
                      info: 'Score, not song — the orchestra is the lead. Good with Instrumental on.' },
                    { v: 'Traditional vocal stage repertoire, operatic and musical-theatre delivery.', label: 'Stage / operatic',
                      info: 'Trained, projected delivery — theatre and opera rather than pop singing.' },
                    { v: 'East Asian modern pop production with contemporary arrangement.', label: 'East Asian modern',
                      info: 'Mandopop, C-pop, K-pop and J-pop production values.' },
                    { v: 'East Asian ballad in the heritage style, traditional instrumentation and phrasing.', label: 'East Asian heritage',
                      info: 'Traditional instruments and phrasing rather than modern pop arrangement.' },
                    // CUSTOM — the option that REVEALS the box below (Fabio,
                    // 2026-09-02). Its `v` is the EMPTY STRING, and that is the whole
                    // trick: every other `v` is a genre phrase `Cat_Style` joins to the
                    // custom box, so "no preset phrase" IS the empty one and the user's
                    // own sentence arrives alone. A sentinel word would have to be
                    // stripped somewhere, and that somewhere is a node that can drift.
                    { v: '', label: 'Custom',
                      info: 'Describe the style yourself instead of picking a family.' },
                ],
            },
            {
                // Appended to the style phrase VERBATIM, as its own sentence.
                id: 'Input_Style_Custom', type: 'text', rows: 3, label: 'Your own style',
                placeholder: 'An era, an instrument, a reference sound — "late-70s Laurel Canyon, twelve-string and pedal steel".',
                default: '',
                // Belongs to the `Custom` option alone, so it is hidden unless that
                // option is picked. `isNot` rather than seventeen `is` clauses that
                // would need an eighteenth the day the list grows.
                hiddenWhen: { field: 'Input_Style', isNot: '' },
            },
            {
                // 0 = AUTO, and it has to have an unset state: MiniMax's own contract
                // says not to fabricate a precise BPM, so a box with no zero would ship
                // an invented exact tempo on every run. At 0 the graph OMITS the tempo
                // clause entirely and the rewriter infers it. Ceiling is 250, not a
                // textbook 220 — Fabio has mastered tracks at that tempo and a 220 cap
                // would clip real material.
                //
                // DEFAULT 120, not 0 (Fabio, 2026-09-02). Auto is still one keystroke
                // away and the `note` is what makes it reachable. `inline` because it is
                // three digits: stacked, it got a box with room for trillions.
                id: 'Input_Bpm', type: 'number', label: 'Tempo', suffix: 'BPM',
                min: 0, max: 250, step: 1, default: 120, inline: true,
                note: 'Set it to 0 and the model picks the tempo to suit the song.',
            },
            {
                // 🔴 A GUILLOTINE, NOT A LENGTH — and the label now says so (Fabio,
                // 2026-09-02: *"maximum length becomes cut off at or something like
                // that, with a default of 5 minutes"*).
                //
                // MEASURED 2026-09-02. `seconds` is NOT derived from the lyrics. The AR
                // text encoder generates the acoustic sequence autoregressively and ENDS
                // WHERE IT WANTS, on `<|audio_end|>`; `max_duration` only sets
                // `decode_limit`, the frame at which an unfinished track is cut off
                // mid-phrase. One caption at four seeds returned 33.84 / 53.24 / 38.64 /
                // 90.0 (capped) — the length is the model's, and it is not steerable by
                // asking: naming a duration in the prose produced no ordering at all
                // (20s→35.48, 45s→52.20, 75s→32.12). Describing MORE music does nudge it
                // longer (~30s median sparse vs ~55s dense), which the enhancer now does
                // as a side effect of writing an arrangement, but it is a nudge and
                // cannot be sold as a length control.
                // Full table: `.agents/mpi-kanban/tasks/MPI-664/plan.md` § 3.
                //
                // So the honest control is a CEILING set high enough to never fire by
                // accident, and the default IS that ceiling (Fabio, 2026-10-01, MPI-1005:
                // a song cut at 3 min after a ~10 min render; "leave the cut-off at its
                // maximum"). It was 300. 360 is the MODEL'S OWN ceiling, not a round
                // number: `MAX_AUDIO_FRAMES / FRAMES_PER_SECOND` = 9000 / 25
                // (`comfy/ldm/minimax_music/ar.py:21`), and the node clamps to it anyway.
                //
                // No fade yet: nothing observed has reached the cap, so a fade would be
                // machinery for an event that has not happened.
                // ponytail: add the fade the first time a real run is audibly truncated.
                //
                // No seconds -> frames conversion either. This is an `MpiFloat` straight
                // into the encoder, so the LTX Extend `MpiMath` pattern does not apply.
                //
                // `format: 'duration'` reads `m:ss` — the long "2 minutes 30 seconds"
                // ran over the slider in this 236px column (Fabio, 2026-09-02).
                id: 'Input_Duration', type: 'slider', label: 'Cut off at',
                min: 30, max: 360, step: 5, default: 360, format: 'duration',
            },
            {
                // A SET-ONCE MACHINE FACT (Fabio, 2026-09-02: "move Low VRAM off the
                // creative step"). It drives the tiled/plain VAE decode switch and
                // nothing about it belongs beside a question about how the song should
                // feel. OFF by default, and the note says when to reach for it rather
                // than restating the label — "Low VRAM", on its own, tells someone who
                // has never seen an OOM nothing about whether it is for them.
                id: 'Input_Low_Vram', type: 'toggle', label: 'Low VRAM',
                icon: 'gpu', default: false,
                note: 'Turn this on if you run out of memory, or if your card has little VRAM.',
            },
            // ── WRITTEN BY THE ENHANCER, SHOWN TO NOBODY ───────────────────────────
            // The three caption blocks. They were three visible boxes until Fabio
            // settled the one-box design (2026-09-02: *"the announce button, the mood,
            // the vocal, and the arrangement all go away"*), and they stay DECLARED
            // because the graph still needs all three:
            //
            //   · `default: ''` is what makes `_seedField` emit them at all. A field
            //     with no default is skipped by the seeding loops, the id never reaches
            //     `injectionParams`, and THE GRAPH'S BAKED VALUE RUNS — here, the
            //     bench's own lo-fi caption, overriding the user's brief outright.
            //   · they are the enhancer's `to` targets, and a target that is not a
            //     declared field has nowhere to be written.
            //
            // `hidden: true` is therefore not decoration: deleting these four lines
            // each would silently restore the bench caption. See `hiddenFieldIds`.
            { id: 'Input_Mood', type: 'text', rows: 7, label: 'Mood', default: '', hidden: true },
            { id: 'Input_Vocal', type: 'text', rows: 7, label: 'Vocal', default: '', hidden: true },
            { id: 'Input_Arrangement', type: 'text', rows: 7, label: 'Arrangement', default: '', hidden: true },
        ],
    },
    // MPI-694 "Sound & Music" (`sound-and-music`) left the Library in MPI-1012: it is the
    // Stable Audio 3 MODEL in the prompt box now (models.js; old ids: js/data/retiredFlows.js).
];

/** @returns {FlowDef[]} All flow descriptors. */
export function listFlows() {
    return FLOWS.slice();
}

/**
 * @param {string} id
 * @returns {FlowDef|null}
 */
export function getFlowById(id) {
    return FLOWS.find(a => a.id === id) || null;
}

// ── Flow dep-status cache (populated by syncModelInstalled, modelRegistry.js) ──
// Map of flowId → Map of depId → installed:boolean. Flows run NO sync of their own —
// the model sync stats their deps in the same /comfy/models/check payload (that route
// is id-agnostic: it takes {id, deps} and stats filenames, never touching MODELS) and
// hands the slice back here. Empty until the first sync lands: a flow with
// requiredDeps therefore reads NOT-installed until proven present, which fails
// CLOSED (a badge that says "get it" is recoverable; a Run that dies inside ComfyUI
// with "lora not found" is not). MPI-304.
const _flowDepStatusCache = new Map();

/**
 * Record a sync's per-dep result for one flow. Called by syncModelInstalled only.
 * @param {string} flowId
 * @param {Map<string, boolean>} depMap - depId → installed
 */
export function setFlowDepStatus(flowId, depMap) {
    _flowDepStatusCache.set(flowId, depMap);
}

/**
 * @param {string} flowId
 * @returns {Map<string, boolean>|null}
 */
export function getFlowDepStatus(flowId) {
    return _flowDepStatusCache.get(flowId) ?? null;
}

/**
 * Every flow's requiredDeps, resolved to dep objects, keyed by flowDepKey(). The
 * shape /comfy/models/check wants — used by the sync payload AND by the backend
 * uninstall guards to learn which deps a flow still needs. Unknown dep ids are
 * dropped (filter(Boolean)) exactly as the model resolver does.
 * @returns {Array<{id: string, flowId: string, deps: Object[]}>}
 */
/**
 * Every dep id a flow needs on top of its models: its own `requiredDeps`, plus the
 * deps of every plugin it declares in `requiredPlugins` (MPI-580).
 *
 * A required plugin folds into the flow's dep set rather than gaining a gate of its
 * own, because a plugin has no install state to check — its deps ARE its install
 * state (pluginsRegistry.js). Folding therefore reuses the whole MPI-304 machinery:
 * the same badge, the same Run guard, the same install button. Without it a Flow
 * installs and runs with its plugin absent, and fails deep inside ComfyUI.
 *
 * @param {FlowDef} flow
 * @returns {string[]} dep ids, de-duplicated
 */
function flowDepIds(flow) {
    const out = new Set(flow?.requiredDeps || []);
    for (const pluginId of (flow?.requiredPlugins || [])) {
        for (const depId of (getPlugin(pluginId)?.requiredDeps || [])) out.add(depId);
    }
    return [...out];
}

export function flowDepUniverse() {
    return FLOWS
        .map(a => ({ id: flowDepKey(a.id), flowId: a.id, depIds: flowDepIds(a) }))
        .filter(a => a.depIds.length)
        .map(a => ({
            id: a.id,
            flowId: a.flowId,
            deps: a.depIds.map(depId => DEPS[depId]).filter(Boolean),
        }));
}

/**
 * Resolved dep objects for ONE flow's requiredDeps (install-side; the flow twin of
 * getModelDependencies). Feeds downloadService.start(flowDepKey(id), deps).
 * @param {FlowDef|string} flowOrId
 * @returns {Object[]}
 */
export function getFlowDependencies(flowOrId) {
    const flow = typeof flowOrId === 'string' ? getFlowById(flowOrId) : flowOrId;
    if (!flow) return [];
    return flowDepIds(flow).map(depId => DEPS[depId]).filter(Boolean);
}

// ── Model slots (MPI-590, generalised MPI-599) ────────────────────────────────
//
// The user's picks, flowId → model ids, at most one per slot. SESSION-ONLY,
// deliberately: a pick that outlived the app would silently run a later sheet on the
// NSFW bake because of a click made days ago — the whole reason option 1 (treat the
// NSFW card as satisfying the SFW one) was rejected.
//
// One ARRAY per flow, not one id: a flow may have SEVERAL choosable slots (the
// scribble flow picks an SDXL checkpoint for its render phase AND an edit model for
// its blend phase), and a single-id store made the second pick overwrite the first.
// The picked id names its own slot — a model appears in one role, never two — so
// nothing has to carry a slot index around.
const _modelChoice = new Map();

/**
 * `requiredModels` as SLOTS: every entry normalised to `{ label, models }`.
 *
 * A slot is one ROLE the flow's graph plays a model in — "Image model", "Edit model" —
 * and its `models` are the interchangeable candidates for that role. A plain string
 * entry is the one-candidate shorthand, which is most flows.
 *
 * `models[0]` is the RECOMMENDED candidate: declaration order is preference order, and
 * it is what an empty install resolves to. The bare-array form MPI-590 shipped is still
 * accepted — it predates labels and reads as the generic "Model" slot.
 *
 * @param {FlowDef} flow
 * @returns {{label: string, models: string[]}[]}
 */
export function flowModelSlots(flow) {
    return (flow?.requiredModels || []).map((entry) => {
        if (typeof entry === 'string') return { label: 'Model', models: [entry], loras: false };
        if (Array.isArray(entry)) return { label: 'Model', models: entry, loras: false };
        return {
            label: entry.label || 'Model',
            models: entry.models || [],
            // OPT-IN, and it must stay opt-in (MPI-608). `flow_ltx_extend` and
            // `flow_ltx_foley` both carry `Input_Lora_1..6` nodes and deliberately declare
            // no rack, so filling every slot that HAS the nodes would silently start
            // injecting the user's LTX LoRAs into two shipped flows.
            loras: entry.loras === true,
        };
    });
}

/**
 * ONE resolved model id per slot — the id that actually runs, and the id every
 * consumer (badge, install keys, required-models list, install progress) must use.
 *
 * Order: the user's pick for this slot, else the first installed candidate, else the
 * recommended one (so a user with NONE of them installed is offered a real default to
 * install rather than an empty row).
 *
 * The pick wins even when it is NOT installed, and that is the point (MPI-599): the
 * picker is how a user chooses what to DOWNLOAD, so a pick that only counted once the
 * weight was on disk could never express "install that one instead". The cost is that
 * picking an uninstalled candidate while another is installed flips the flow to
 * unavailable until it downloads — correct (they asked for it), session-only, and one
 * click back.
 *
 * @param {FlowDef|string} flowOrId
 * @returns {string[]}
 */
export function flowModelIds(flowOrId) {
    const flow = typeof flowOrId === 'string' ? getFlowById(flowOrId) : flowOrId;
    if (!flow) return [];
    const installed = state.s_installedModelIds || [];
    const picks = _modelChoice.get(flow.id) || [];
    // A cloud candidate (MPI-918) bills the user, so an installed LOCAL one always wins, and
    // a cloud one runs unpicked only when nothing local is installed (Fabio, 2026-10-01). The
    // agent's spend card and the slot's price label say so before anything is sent.
    return flowModelSlots(flow).map(({ models }) =>
        models.find(id => picks.includes(id))
        || models.find(id => installed.includes(id) && !isCloudCandidate(id))
        || models.find(id => installed.includes(id))
        || models.find(id => !isCloudCandidate(id))
        || models[0]);
}

/**
 * True for a slot candidate that runs at a cloud provider (MPI-918): it is offered only
 * with a key saved, carries no LoRA rack, and runs the Flow's edit stage through
 * `cloudEdit` (flowService.js).
 * @param {string} modelId
 * @returns {boolean}
 */
export function isCloudCandidate(modelId) {
    return !!MODELS.find(m => m.id === modelId)?.provider;
}

/**
 * Every slot the user actually gets a say in — more than one candidate — as
 * `{ label, models, recommended }`, in declaration order, for the slide-over to mount
 * one dropdown per entry.
 *
 * Candidates are listed whether or not they are installed (MPI-599). Offering only what
 * is on disk meant a user with NOTHING installed silently got `models[0]`: the flow
 * downloaded the safe default and never mentioned there had been a choice.
 *
 * @param {FlowDef|string} flowOrId
 * @returns {{label: string, models: string[], recommended: string}[]}
 */
export function flowModelChoices(flowOrId) {
    const flow = typeof flowOrId === 'string' ? getFlowById(flowOrId) : flowOrId;
    if (!flow) return [];
    // `index` is the slot's position in `requiredModels`, kept because filtering loses it
    // and the PHASE number is that original index — a cogwheel or a rack keyed off the
    // filtered index would address the wrong phase the moment a single-candidate slot
    // sits before a multi-candidate one (MPI-608).
    // A cloud candidate with no key saved is not offered: its "install" is the key, which
    // the Library's install button cannot fetch (MPI-918).
    const installed = state.s_installedModelIds || [];
    return flowModelSlots(flow)
        .map((slot, index) => ({ ...slot, index }))
        .map(slot => ({ ...slot, models: slot.models.filter(id => !isCloudCandidate(id) || installed.includes(id)) }))
        .filter(slot => slot.models.length > 1)
        .map(slot => ({ ...slot, recommended: slot.models[0] }));
}

/**
 * Every model phase that carries a USER LoRA RACK, as `{ phase, modelId }`.
 *
 * `phase` is 1-based and matches the graph's `Input_Lora_Phase<N>_<i>` titles; `modelId`
 * is the id that will actually run in that slot, resolved through the any-of set by
 * `flowModelIds` so the rack follows the picked member (MPI-590) rather than whichever
 * id the descriptor happens to list first.
 *
 * This replaced the single `settingsModel` string (MPI-504). One string could only ever
 * name one rack, so a flow choosing a model PER PHASE — scribble-to-object picks an SDXL
 * render model AND a Klein blend model — could never fill both. Keyed by phase and not by
 * model family on purpose: an any-of slot swaps klein-4b for klein-9b without the graph
 * being retitled.
 *
 * @param {FlowDef|string} flowOrId
 * @returns {{phase: number, modelId: string}[]}
 */
export function flowLoraPhases(flowOrId) {
    const flow = typeof flowOrId === 'string' ? getFlowById(flowOrId) : flowOrId;
    if (!flow) return [];
    const resolved = flowModelIds(flow);
    return flowModelSlots(flow)
        .map((slot, i) => ({ phase: i + 1, modelId: resolved[i], loras: slot.loras }))
        // A cloud pick loads no LoRA (MPI-918): its graph phase is pruned away.
        .filter(entry => entry.loras && entry.modelId && !isCloudCandidate(entry.modelId))
        .map(({ phase, modelId }) => ({ phase, modelId }));
}

/**
 * Record the user's pick for this session. Ignored unless the id is a candidate in one
 * of the flow's slots — nothing else can be picked, and a stale id would otherwise
 * shadow the resolution order forever. Replaces any earlier pick in the SAME slot and
 * leaves the other slots' picks alone.
 * @param {string} flowId
 * @param {string} modelId
 */
export function setFlowModel(flowId, modelId) {
    const flow = getFlowById(flowId);
    if (!flow) return;
    const slot = flowModelSlots(flow).find(s => s.models.includes(modelId));
    if (!slot) return;
    const kept = (_modelChoice.get(flowId) || []).filter(id => !slot.models.includes(id));
    _modelChoice.set(flowId, [...kept, modelId]);
}

/**
 * The injection params the RESOLVED models contribute — what makes a pick reach the
 * graph instead of only the badge (MPI-590). Empty for every flow that declares no
 * `modelParams`, which is every flow but Character Sheet.
 * @param {FlowDef|string} flowOrId
 * @returns {Object}
 */
export function flowModelParams(flowOrId) {
    const flow = typeof flowOrId === 'string' ? getFlowById(flowOrId) : flowOrId;
    if (!flow?.modelParams) return {};
    return Object.assign({}, ...flowModelIds(flow).map(id => flow.modelParams[id] || {}));
}

/**
 * Availability = every requiredModel SLOT satisfied AND every requiredDep present.
 *
 * requiredModels are MODEL ids; s_installedModelIds is already partial-aware
 * (populated via isModelUsable, modelRegistry.js) so ≥1-op-installed models count.
 * A slot is an ANY-OF SET (MPI-590), and `flowModelIds` already resolves each slot to
 * an installed member when it has one — so filtering its output IS the any-of test,
 * and `missing` still names ONE id per unsatisfied slot, which is what the install
 * callers need.
 * requiredDeps are DEP ids (MPI-304) — flow-only weights/nodes no model requires;
 * their disk status comes from the flow dep-status cache above. Both gate the same
 * badge and the same Run guard: the user cannot open a flow until it has BOTH.
 *
 * `missing` stays MODEL ids only — every existing caller treats it as such
 * (flowService's toast, MpiFlowLibrary's _installMissing → getModelDependencies).
 * Missing deps ride alongside in `missingDeps`; `available` accounts for both.
 *
 * @param {FlowDef|string} flowOrId
 * @returns {{available: boolean, missing: string[], missingDeps: string[], reason?: string}}
 */
export function flowAvailability(flowOrId) {
    const flow = typeof flowOrId === 'string' ? getFlowById(flowOrId) : flowOrId;
    if (!flow) return { available: false, missing: [], missingDeps: [] };
    // MPI-532 — a Flow package that failed validation: nothing to install, only a reason.
    if (flow.disabledReason) return { available: false, missing: [], missingDeps: [], reason: flow.disabledReason };
    const installed = state.s_installedModelIds || [];
    const missing = flowModelIds(flow).filter(id => !installed.includes(id));
    const depStatus = _flowDepStatusCache.get(flow.id);
    const missingDeps = flowDepIds(flow).filter(id => depStatus?.get(id) !== true);
    return { available: missing.length === 0 && missingDeps.length === 0, missing, missingDeps };
}
