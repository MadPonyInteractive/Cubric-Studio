# Seedance 2.0: blocking and the first frame

Read this when anyone or anything has to be in a particular place: two people facing each other, a subject beside a landmark, a composition the user described, or simply a shot that must open on its subject. It feeds the **Scene and first-frame blocking** part of the prompt.

Seedance places what it is told to place. What it is not told, it decides, and its default is often an establishing view with the subject arriving late, small, or facing the wrong way.

## The first frame

Say what the opening frame already contains. A clip is short; a second spent on an empty street is a tenth of it.

- Right: `In the first frame she already sits at the desk, screen-right, facing the window.`
- Wrong: `She walks into the office and sits at the desk.` The model may spend half the clip on the entrance.

If the user wants an empty opening or a reveal, write it deliberately and say when the subject enters. Otherwise the subject is present from frame one.

In `i2v` the supplied image IS the first frame. Do not describe it. Write only what moves, relative to what is there: `she stands and steps toward the door on screen-right`.

## Where, in words the model can measure

Give each subject that matters:

- **Screen side:** screen-left, screen-right, centre. Left and right are always the camera's.
- **Depth:** foreground, midground, background.
- **Distance to something:** in metres, or as a contact. `within 1 metre of the car`, `back against the wall`, `one hand on the door handle`, `boots at the kerb edge`.
- **Body facing:** where the torso points.
- **Gaze:** where the eyes point. This is a separate instruction from body facing, and both are needed whenever people relate to each other.
- **Movement direction**, if they move: `walks toward camera`, `crosses from screen-left to screen-right`.

Vague proximity words are where placement fails. Replace them:

| Vague | Measurable |
|---|---|
| near the tree | standing within 1 metre of the tree, one palm on the bark |
| by the taxi | in front of the taxi's rear door |
| next to each other | shoulder to shoulder, half a metre apart |
| around the fire | in a loose circle within 2 metres of the fire, all facing it |
| looking at him | eyes locked on him, head turned toward screen-left |

## Two or more people

State each person's place, facing and gaze, then the relation between them.

```text
The older man stands screen-left within 1 metre of the open car door, body facing the younger man, eyes on his face. The younger man stands screen-right in the midground, three metres away, body angled toward the car, eyes on the ground.
```

- Give each person a distinct visible feature (a coat colour, a hat, an age) and keep using the same words for them. Two unlabelled "men" can merge or duplicate.
- With several people in frame, add a lock: `no duplicate characters and nobody else in frame`.
- More than four clearly distinct people in one shot gets unstable. Split a crowd into a few named people and an unnamed background.
- Only put in the prompt the people who are in this shot. A name mentioned but not placed tends to be forced into frame.

## Landmarks

A landmark that matters to the story needs the subject physically tied to it, not "near" it. `She stands directly under the station clock`, `his boots inside the chalk circle`. If the landmark has to stay visible, say where in frame: `the lighthouse holds the left third of the frame`.

## Composition the user asked for

Translate composition words into placement:

- "rule of thirds": `the subject occupies the right third, open sky filling the left`.
- "symmetrical": `the doorway centred, the subject in its exact middle, facing camera`.
- "over the shoulder": `camera behind her left shoulder, her shoulder soft in the foreground, the man she faces sharp in the midground`.
- "profile": `profile to camera, facing screen-left`. Profile or three-quarter reads more naturally than straight to camera; frontal is for a reason (an address to the viewer, a confrontation).

## Checklist before sending

- Is the subject in the first frame, and does the prompt say so?
- Does every person who matters have a side, a depth, a facing and a gaze?
- Is every "near" replaced by metres or a contact?
- Are left and right from the camera, and consistent with each other?
- Is anyone named who is not in this shot?
