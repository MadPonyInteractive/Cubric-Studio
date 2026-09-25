# Seedance 2.0: performance and dialogue

Read this whenever a person acts, reacts or speaks. It feeds the **Subject** and **Action** parts of the prompt, and the spoken lines in `{}`.

## Acting is behaviour, not emotion

A named emotion ("she is sad", "he looks angry") gets a mask: raised brows, a grimace, a face performing the word. What reads as real is a person **trying to get something**, **being blocked**, and **doing something about it**. The feeling shows up on its own, in the body.

So for each person on screen, decide:

- **What they want, from whom, right now:** a verb aimed at someone. "Make him admit it", "get out of the room without a scene", "hide that the letter matters". Never a state like "be nervous".
- **What stands in the way:** the other person, a witness, their own pride.
- **How they go about it:** press, charm, stall, plead, threaten, joke. When one way fails, a person switches. Each switch is a visible beat: a pause, a posture change, a new tempo, a shift of gaze. Two to four beats make a scene; none makes it flat.

Then write only what a camera can see.

| Instead of | Write |
|---|---|
| she is sad | her head drops, her shoulders shake slightly, her fingers twist the hem of her sleeve, her eyes fill but do not spill |
| he is angry | both fists close, his jaw sets, his chest rises and falls hard, he speaks through his teeth |
| she is nervous | she checks her watch twice, her fingers tap the table, her eyes dart to the door and back |
| he is relieved | a long breath out, his shoulders drop, a small smile he tries to hide, his gaze lifts to the distance |
| they are happy | the corners of her mouth rise before she can stop them, her step lightens, she laughs once |

## The body

- **Centre of gravity:** high and still (confidence, threat) or low and folded (fatigue, fear).
- **Tempo:** quick and ragged, or slow and economical. The most dangerous person in a room usually moves least.
- **Breath:** high and fast in panic, low and slow in control. Sound must match the body: a character still out of breath from running cannot deliver a line steadily.
- **A task for the hands:** people rarely just talk. They wipe a glass, count money, fix a strap, and talk over it. The strongest accent in a scene is when they **stop** the task mid-line.
- **Distance:** under half a metre is love or violence; a metre is trust; three metres is business; further is distance in every sense. When someone closes or opens the gap, the scene turns.
- **Status:** still head, slow moves, long looks and taking space read as high; fidgeting, touching the face, asking permission with the eyes read as low. The interesting moment is when it breaks.

## The eyes

Dead eyes are the quickest tell of a generated face. Give every face eye life:

- The gaze moves: it drifts, flicks away in thought, finds a detail, returns.
- Blinks fit the state: quick bursts under stress, slow lids in control.
- The eyes are wet and catch the light.
- **The eyes lead:** they reach the target a moment before the head turns.
- Stillness is a choice, not a freeze: a calm, unblinking character still shifts the gaze slowly.

## Listening

The performance is between the lines. Write the listener, not just the speaker:

- The reaction starts **before** the other person finishes.
- A hard question gets a pause before the answer: the thought is visible first.
- News lands: give the listener a beat to take it in.
- Energy answers energy: a shout gets a counter-shout or a pointed quiet, never nothing.

## Several people

- Reactions travel in a wave: one gets it first, the next a beat later, one not at all. Identical simultaneous reactions look fake.
- The most valuable frame after an event is the face of whoever saw it.
- Constant small movement, then everyone freezes at the threat: the contrast is the punctuation.
- Nobody crosses a room without a reason: toward something or away from it.

## Dialogue

- A spoken line goes in curly braces, after who says it and how: `she says quietly, not looking up, {You're late.}`
- Only the words inside the braces are spoken: no extra words, no names that are not in the line.
- Lips move only for the speaker; everyone else listens in silence. No voices from off screen unless asked.
- One language per clip. Name a less common one: `says in Italian {...}`.
- Say how the line is delivered: pace, volume, what the body does during it. The quietest line is often the most frightening.
- Describe the voice in words when it matters: `a low, rough, unhurried voice of a man in his sixties`. The app cannot hand the model a voice sample.
- A pause is only worth writing if something happens in it: a decision, a look, a refusal to answer.
- Keep dialogue in one continuous take where the scene allows: a single-scene conversation holds together better unbroken.

## Close-ups need less, not more

On a close-up, big expressions become mugging. Let the eyes and one small action carry it: `in close-up she barely moves; her eyes flick to the photo and away, and her thumb stops turning the ring`.

## A recurring character

For a character who appears in several clips, keep one short description of how they behave (their tempo, a habit with the thing that triggers it, how they hide what they feel, what breaks that mask) and one fixed line describing their voice. Reuse both in every prompt, adapting only the behaviour to the scene. The app does not store these; keep them in the conversation, and read them back from the user's earlier cards when needed.

## Failures and fixes

| What came back | Fix in the prompt |
|---|---|
| A face that performs the emotion | Remove the emotion word; give a want and a task for the hands |
| A blank face while the other speaks | Write the listener's reaction starting mid-line |
| The same tone throughout | Mark the beats; a different tactic each |
| Gestures that act out the words | Let the gesture come before the thought, contradict the words, or leave it out |
| An outburst from nowhere | Build it: restraint first, then the break |
| Everyone reacts at once | Stagger the reactions |
| An empty pause | Put a look or a decision inside it, or cut it |
| Too much face in a close-up | Less movement; the eyes and one small action |
| Glassy, fixed eyes | Write the eye life explicitly |
