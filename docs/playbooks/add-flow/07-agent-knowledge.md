# 07 — Make it known to the in-app agent (Cosmo)

> Part of the [add-flow playbook](README.md). Do this for EVERY Flow, before the live run in
> [05](05-verify.md). The model half is [../add-model/07-agent-knowledge.md](../add-model/07-agent-knowledge.md);
> the audit that produced both (what the agent reads, traced to the code) is MPI-1003.

A Flow the agent was never told about is a Flow it cannot use, and **nothing fails**: the user asks
for a song, Cosmo answers "I work with images and video only", and the Flow sits installed. The
in-app agent (`services/agentLoop.mjs`, contract [../../agent-chat.md](../../agent-chat.md)) knows a
Flow through exactly three things, and no gate forces it to read the third:

| It reads | Comes from | Carries |
|---|---|---|
| `list_models` → `flows[]` | `_listModels` (`js/shell/agentDispatch.js`) | `id`, `title`, **`does`**, `installed`, `opensForUser` |
| `describe_model <flow id>` | the same entry, whole | `fields`, `media` roles, `boxParams`, `frame`, `opens` |
| `read_knowledge app:flows` | `docs/agent/flows.md` | everything in words: when to reach for it, what a field means, ask first |

The model-guide gate (`GUIDE_NOT_READ`) fires only for a model op, so a Flow has no forced briefing.
`flows.md` is read on a prompt rule alone ("Flow rule"). **Whatever the agent needs to use this Flow
right must be in one of the three rows, and the system prompt is not a fourth** (§ 4).

## 1. Decide what the agent does with it

| The Flow | Declare | The agent |
|---|---|---|
| Needs nothing only the user has | nothing | `generate { flowId, fields, media }` runs it |
| Needs the user's hands (a drawing, a placement), or a result they must read before the GPU spends | `agentOpens: '<a middle step kind>'` (or `'run'`) on the `FlowDef` | never runs it: fills what it can, opens the Flow at that step, the user presses Generate (Draw It In, Scribble `paint`; Object Stamp `cutout`) |
| The user should approve what the agent wrote first (Song's lyrics) | `agentReview: '<field id>'` on the `FlowDef` (MPI-1005) | sends `generate` as usual; the APP shows that field on a card with Review / Just do it, and the click opens or runs it with no agent turn |

Any Flow can also be opened with `open: true` when the user wants to adjust it or it lacks something
only they have (a voice sample): nothing to declare. Ask-first was prose in `flows.md` until
MPI-1005, and the model skipped it once: declare `agentReview`, never an `[options]` paragraph.
The card's button reads "Review lyrics" (Song's words); a second reviewing Flow names its own.

Pin the decision in `tests/agent-flow-handover.test.cjs`: an opening Flow goes in the `want` map
(id → the step kind, which must exist in its `steps`), a running Flow in the `runs` list. Two more
places NAME the opening Flows in words and go stale silently: `flows.md` § Flows the user finishes,
and the Docs site's agent page (a sibling repo; `.claude/rules/sibling-repos.md`, and never push it).

## 2. The one line it picks by

`does` is `flowDoes(description)`: the **first sentence** of the `FlowDef` `description`, cut at its
first dash or colon. On a title like "DramaBox" it is all the agent has; with only the title in the
catalogue, a voice with no sample went to an uninstalled Flow over the installed one.

Write that sentence as what a user would ASK FOR, verb first, no brand: "Describe a song and hear it
sung", "Text to speech you direct in words". Everything after the first dash or colon is slide-over
copy and never reaches the agent. A Flow PACKAGE ([../../flow-packages.md](../../flow-packages.md))
gets the same line from its manifest `description` and cannot edit `flows.md`, so for a package this
sentence and the field labels are the whole briefing.

## 3. What a field looks like to the agent

`agentFieldSpecs` (`js/utils/declaredFields.js`) sends `id`, `label`, `type`, `default`, `options`
(`{v, label}`), `min`, `max` for every declared field, step fields included (not `button`, and not a
`hidden: true` field, which is left out whole and whose caller value `resolveFlowFieldValues`
ignores). Anything else is **dropped on purpose**: `info`, `note`, `placeholder`, `rows`, `tags`,
`hiddenWhen`, and a step's `hint`. This answer is the largest thing the agent reads, and
`tests/connector-flow-dispatch.test.cjs` asserts the prose and widget keys never leak. So, per field:

| Field | What the agent gets | Do |
|---|---|---|
| `hidden: true` (Song's `Input_Mood`, `Input_Vocal`, `Input_Arrangement`, written by the Flow's enhancer) | nothing: `agentFieldSpecs` omits `hidden: true` fields (MPI-1002), so the agent cannot fill one blind | a field the enhancer fills needs no `flows.md` line; a field the AGENT must know about must not be `hidden` |
| `type: 'voices'` (a roster) | `default: [{type:'Any'}]` and the options, not what a row MEANS or how it pairs with the notes box | `flows.md`: what one row is |
| Meaning only in `note` / `info` / `hint` / `placeholder` ("a duet is likely, not certain"; a lyric-marker grammar) | nothing | `flows.md` says it, or the `label` carries it so no note is needed |
| A `label` that is UI copy ("Anything to add?") | only that | `flows.md` says what the VALUE is (Head Swap's `positive` is an expression, never an instruction) |
| `select` / `radio` | every `v` and label | nothing, but `v` must be the value the op takes |

Media slots arrive as the op's `mediaInputs` **keys**: `role`, `type`, `required`, `tag`. The slot's
label is not sent. Name a new key for what it holds (`voiceSample`, not `audio2`); Outpaint's `image1`
is the counter-example, a role the agent once guessed wrong and learned from a refusal.

## 4. `docs/agent/flows.md`

Add a paragraph **only when the Flow needs one**: when to reach for it over a model or another Flow
(and the pair a user may confuse, as Scribble and Draw It In), the § 3 rows, ask-first or opens.
A Flow that is run with plain fields the labels explain gets nothing.

- **Information only**: what to do and when. No dates, no names, no incident stories, no `$` price;
  a right/wrong example pair is fine. `tests/agent-prompt-budget.test.cjs` enforces it and caps an
  agent doc at 200 lines (`flows.md` was 82).
- **Never a new `docs/agent/<flow>.md`** and **never a rule in the system prompt.** Each app doc is an
  index line in the prompt, and prompt + tool schemas have fixed byte budgets in that same test,
  with almost no slack. Raising one is a decision made in the diff that needs it, never a drive-by.
- The agent cannot install a Flow (`install_model` answers `IS_A_FLOW`): a Flow added as a package
  (paid, like Head Swap and DramaBox) is named in `flows.md` § Picking one, and one that is not
  installed is added from the Flow Library.
- An outside agent (MCP, Claude Desktop) reads `.claude/skills/cubric-vision-flows/SKILL.md` instead,
  which has a recipe per Flow that needs a calling convention (Text to Speech, DramaBox). Add one only
  for that kind of Flow.

## 5. A new media KIND (audio was one)

The agent's idea of what the app makes is text in several places, and a new kind is false in all of
them until edited. Grep `git grep -n -i -E "image or video|image and video|images and video" -- services routes js docs/agent`.

| Site | Says | Change |
|---|---|---|
| `_buildSystemPrompt`, opening line (`services/agentLoop.mjs`) | "a desktop AI image, video and sound tool" | add the kind: a fresh chat declined a song while it read image and video, and worked only when `list_models` happened to be in context |
| Docs rule (same prompt) | "Image, video and audio advice is yours to give" | decide whether advice on the kind is the agent's or a docs link |
| `generate` description (`TOOL_DEFS`) | "Start a generation" (names no kind, so it needs no edit) | nothing, unless it names kinds again |
| Honest limits (same prompt) and `look`'s description | "I hear no audio", clips as sampled frames | what the agent can and cannot do with the kind |
| Chat result tile (`MpiAgentChat`) | `video` and `audio` get their element, anything else is drawn as an `<img>` and errors into "Did not finish" | a tile for the kind |
| MCP header and `generate` description (`routes/mcp.js`) | "making images, video and audio"; `generate`: "an image, video or audio" | outside agents read the same scope |
| `MEDIA_KINDS` (`js/data/recipes/registry.js`) | image, audio, video | only if a prompt recipe targets the kind |

Every byte of the first four is paid on every request. Raise the budget in `tests/agent-prompt-budget.test.cjs`
deliberately and say why beside the number; do not pay for a scope word with a longer rule.

## 6. Verify

1. **Read back what Cosmo reads.** Not the registry, the answer. From the repo root (the `[concat]`
   `EventSource` error and the module-type warning on stderr are harmless; a real failure is a stack
   trace with no output above it):
   ```bash
   node -e "const {getFlowById}=require('./js/data/flowsRegistry.js');const {flowDoes}=require('./js/shell/agentDispatch.js');const {agentFieldSpecs}=require('./js/utils/declaredFields.js');const f=getFlowById('<id>');console.log(flowDoes(f.description),'|',f.agentOpens??'runs');console.log(JSON.stringify(agentFieldSpecs(f)))"
   ```
   Read `does` as a stranger would, and the fields as if `flows.md` did not exist. Every field you
   could not fill from that line is a § 3 row. (A package Flow is not in `flowsRegistry`; read its
   manifest the same way.)
2. **Run the agent tests:** `node --test tests/agent-flow-handover.test.cjs tests/agent-prompt-budget.test.cjs tests/connector-flow-dispatch.test.cjs tests/connector-agent-tools.test.cjs`.
   A red budget means prompt or doc text went where § 4 says it cannot.
3. **The live ask, in words, never the Flow's name.** The user's to run (it spends their LLM key, and
   a run spends the GPU), in an isolated app (`npm run app:isolated`), never their live one on
   `:3000`: "can you make me a <what the Flow does>". Pass = the agent's step lines read the Flow (`app:flows`, then its settings), it
   picks the Flow rather than a model or a refusal, fills the fields as `flows.md` says, and does
   what § 1 decided (runs, opens at the step, or asks first). Give the user that one sentence to try.
