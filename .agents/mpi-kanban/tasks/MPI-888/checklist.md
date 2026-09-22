# MPI-888 — checklist

Started 2026-09-22 on Fabio's word, straight out of MPI-877 round 3. Round 3's own two
faults came back GREEN — the edit landed as a history entry with latents drawing in the
open workspace, and the prompt named nothing outside the mask. What was still wrong was
the *result*, and the conversation that followed found three causes, none of them MPI-877's.

Prompt text only. No dispatch, no routing, no UI.

## 1. Stop forcing the mask

The Masking rule (`agentLoop.mjs:1162`) funnels every regional change into a painted mask.
Fabio: *"any edit can be just an edit. It doesn't need to be a localised edit … The mask is
more effective, but shouldn't always be forced on the user."*

- [x] One question, three answers — **does the request name a PART of the picture?**
      - no part named ("make it night", "make it a painting") → whole-image, no question
      - a part **with preservation words** ("without changing anything else", "keep the
        size, only this area") → they already chose; ask for the mask, do not offer
      - a part with no preservation words ("change the hair colour", "change the pose")
        → one line offering both, recommending the mask, and **wait**
- [x] The three bounds, or it becomes a salesman: at most three routes, one line each
      (op + model + why); only at a genuine fork; **always recommend** — never
      "here are your options, which?"

## 2. Fix the worked example — it is the prompt that failed

`agentLoop.mjs:1162` teaches `"convert the boy into a demon: glowing red eyes, sharp horns,
pale grey skin, a sinister grin"` as the prompt the model *needed*. It was written down
last session without ever being rendered. Fabio rendered it: the adjective list REPLACED
the subject and lost the boy's likeness, while his own plain *"convert the boy into a demon
version of himself"* kept more of it.

- [x] Swap the example for the one that worked.
- [x] State the shape it demonstrates: for the edit family the instruction is a **verb plus
      a target**; adjectives are added only when the user named them.

Highest-leverage line in the rule — the model copies the example.

## 3. A fallback ladder

Fabio found `inpaint` beat `kleinEdit` on this picture, and a simpler prompt beat a longer
one: *"different cases sometimes need different approaches."* Nothing in the rule says what
to do when a masked result comes back wrong.

- [x] Say which op and why before sending.
- [x] On a bad result: reach for a **different op** or a **simpler prompt** — never more
      adjectives.

## 4. Prove it

- [x] `tests/agent-loop.test.cjs` — one test per item above, each backed out on its own.
      A spec covering three fixes proves one otherwise.
- [x] `docs/agent/masking.md` carries the same rules (the doc is the corpus entry; the
      system prompt is what binds in the composing turn — both, not either).
- [x] `npm test` and both lints.

## Not in scope

- The agent reviewing its own result and offering a **composite** — blocked on MPI-887,
  which is what makes a composite reachable at all. Teaching a fix the user cannot perform
  is worse than saying nothing.
- The **workspace-awareness** theme Fabio raised in the same conversation (the agent reads
  the open workspace; it moves the view to where it renders; it fills a Flow and hands it
  over). Uncarded, by agreement, pending his go.
