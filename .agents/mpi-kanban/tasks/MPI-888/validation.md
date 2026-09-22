# MPI-888 — validation

Built 2026-09-22. Prompt text only — `services/agentLoop.mjs` and `docs/agent/masking.md`,
with three tests in `tests/agent-loop.test.cjs`. No dispatch, no routing, no UI.

## What shipped

**A new `Route rule`, above the Masking rule.** One question — *does the request name a PART
of the picture?* — with three answers, because two of the three are not a choice at all:

| The ask | Route | Asked? |
|---|---|---|
| no part named ("make it night") | whole picture | no |
| a part **plus words protecting the rest** ("without changing anything else") | masked | no — they chose |
| a part, no such words ("change her hair to red") | either | yes, one line, recommend, wait |

Three bounds so the third row never becomes a menu: at most three routes, only at a genuine
fork, always recommend one.

**The Masking rule now starts after that fork** rather than declaring it. Its opening —
*"a change confined to a REGION … is a masked edit"* — was the funnel, and is gone. It now
opens *"once a mask is the route (Route rule)"*. Everything else about what a mask does is
unchanged.

**The worked example is now the prompt that rendered well.** It was
`"convert the boy into a demon: glowing red eyes, sharp horns, pale grey skin, a sinister
grin"` — written down last session as the prompt the model *needed*, and never rendered
before it was written. The adjective list is still in the rule, as the counter-example, with
what it did: replaced the boy instead of transforming him, and the likeness went with it.
The shape it demonstrates is stated so it generalises: **a verb and a target; add a detail
only when the user named it.**

**A fallback ladder.** A bad masked result moves to a **different op** or a **simpler
prompt**, never more adjectives on the same one — and the agent says which op it is sending
before it sends.

`docs/agent/masking.md` carries all four: a new `## Which route` section, `### Keep it
short`, `### When it comes back wrong`, and step 1 of `## The flow` now settles the route
before asking for a mask. Both surfaces, not either — the doc is fetched in the asking turn
and the system prompt is what binds in the composing turn, which is the MPI-877 lesson.

## Evidence

Three tests, and **each fix was backed out on its own** — a spec covering three fixes proves
one otherwise:

| Backed out | exit | fail | which test |
|---|---|---|---|
| the Route rule never existed | 1 | 2 | `the Route rule offers the two routes…` **and** `a bad masked result moves…` — the ladder lives inside the Route rule, so this is correct, not collateral |
| the failed prompt is the worked example again | 1 | 1 | `the worked example is the prompt that rendered well…` |
| no fallback ladder | 1 | 1 | `a bad masked result moves to another op or a shorter prompt…` |
| nothing (control) | 0 | 0 | — |

No unrelated test failed under any back-out.

- `node --test tests/agent-loop.test.cjs` — 86 tests, 85 pass, 0 fail, 1 skipped
  (`LIVE:` needs `DEEPINFRA_API_KEY`).
- `npm test` — **1765 tests, 1763 pass, 0 fail, 1 todo**, exit 0. The todo is the
  pre-existing MPI-867 entry in `agent-video-attachment.test.cjs`, which prints an
  `AssertionError` and is counted by node as `todo`, not `fail`.
- `npm run lint` and `npm run lint:components` — both exit 0.

## What this card does NOT cover

- **The agent reviewing its own result and offering a composite.** Blocked on **MPI-887**:
  Composite's slot only takes an entry already in the open card's history
  (`MpiToolOptionsComposite.js:16`), so for an edit that landed as a separate card there is
  no composite to teach. Teaching a fix the user cannot perform is worse than saying nothing.
  The structural and perceptual halves of that review are specified and unbuilt.
- **Workspace awareness** — the agent reading the open workspace and its active entry,
  moving the view to where it renders, and filling a Flow for the user to check and run.
  Raised by Fabio in the same conversation, uncarded by agreement, pending his go. The
  channel for the first of those already exists: `agentService.js:105` posts `pinned` (what
  the settings panel is showing) every turn, and the workspace is one more key on it.

## Not verified here

Whether the offer reads well in a live turn. It is prompt text: the tests prove the rule is
present and says what it must, never that the model obeys it. That is a `user-ux` check and
it belongs to Fabio, the same way MPI-877's did.

# Live read 1 — Fabio, 2026-09-22 — RED (recorded under MPI-890's read)

Ask, with a card open: *"make the sky a bit reddish, like dawn, like the sun is setting, and
place some red eyes in the forest, peeking behind the trees."* It forked a masked job per
ask, in eight paragraphs. Full transcript: `tasks/MPI-890/validation.md` § Live read 1.

The rule was **obeyed, and it is wrong**. Its one question — "does the request name a
PART?" — let "the sky" pass as a part. Fabio: "An edit model can do multiple things at once.
The sky change would need to be on the full image. The eyes in the forest could possibly be
masked, but there's no point. This can be done in one go." Two lessons the rewrite must
carry, not emphasis on the old test:

1. **Several asks in one message are ONE edit.** An edit model makes them in one pass. Never
   split them into a job each.
2. **A change of light, sky, time of day, weather, season or style is WHOLE-IMAGE** even
   when it names a thing — it falls on everything in the frame. "Names a part" is the wrong
   test; "does the change stay inside one area?" is the right one.

Plus: the fork, when there is one, is ONE line (this read was eight paragraphs), and the
Masking rule's "click the card in the gallery to open it" must not be said to a user the App
state line says is already in the card (MPI-890 fault 3 — it is the rule's own words).

**Rewritten 2026-09-22 (session 8fc9b288):** the Route rule's question is now "does the change
stay inside ONE area of the picture?", with light / sky / time of day / weather / season /
style named as whole-picture, several asks named as ONE edit, Fabio's words quoted, and the
fork capped at "one line, never a paragraph". The Masking rule skips "click the card in the
gallery" when the App state line says the user is already in it. `docs/agent/masking.md`
§ Which route and its step 2 say the same, since the agent reads it at runtime.

Evidence: new test "a sky or lighting change is whole-picture, and several asks are ONE
edit" (it also asserts the OLD question is gone); the existing Route test moved to the new
question. `npm test` 1796 / 0 fail. The live read is Fabio's, alongside MPI-890's live check 2.
