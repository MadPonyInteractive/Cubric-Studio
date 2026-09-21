# MPI-873 — An agent submit cannot name its project; it inherits whatever is open

Found live on 2026-09-21 while MPI-864 was generating tile art, and Fabio named it himself:
*"Are our tools and skills only pointing agents to the open project? Is that the problem?"*
Yes. It is a design gap in the route, not a mistake in the skill text.

## What happens

`POST /connector/generate` takes no project. Its own docblock says it "Runs in whatever
project the app currently has open", and `POST /connector/open-project` is a SEPARATE call
that mutates global app state. So an agent's target is **ambient**. Between the open and the
submit, anything can move it — the user, a peer agent session, the app itself — and the run
lands somewhere else. Nothing errors, because from the route's point of view nothing is
wrong.

**The measured timeline**, both halves of one session:

| Time (UTC) | What | Where it landed |
|---|---|---|
| 10:03 | `open-project` → `Deepinfra model tests` | — |
| 10:04–10:05 | three `t2i` submits | `Deepinfra model tests` ✔ |
| 10:43–10:54 | five `outpaint` flow submits | **`Cubric Studio Mascots`** ✘ |

Fabio had moved the app to another project in between, which is entirely his right. The
agent had no way to see it and no way to say otherwise. He then had to move five cards by
hand.

## Why the obvious fix is not one

"Re-open the project before every submit" is the same race with a smaller window: the open
and the submit are still two calls against one piece of global state, and the second agent
in the workspace makes it worse, not better. It also stamps on the user's own view every
time an agent runs.

## The shape that fixes it

An optional `folderPath` on the submit itself, resolved per-dispatch, so a run names its own
target instead of inheriting one. Absent → today's behaviour, so nothing existing breaks.

Points to settle when this is taken:

- Does a named project have to be OPEN for the run to land, or can the route write to a
  closed project's `project.json` (`updateProjectJson()` only, never `fs.writeJson`)?
- The same question applies to `place-preview-asset`, which already takes `folderPath` —
  that asymmetry is half the trap: the staging call names its project and the submit that
  consumes it does not.
- `/connector/open-project` stays, for the case where the agent genuinely wants to move
  the user's view.

## Files

`routes/connector.js` (`/connector/generate`), `js/shell/agentDispatch.js`, and the skill
docs that state the ambient behaviour: `.claude/skills/cubric-vision-generate/SKILL.md`,
`.claude/skills/cubric-vision/projects.md`.

Related: [[MPI-874]], found in the same run — `cardName` silently ignored on a Flow submit.
