# Seedance 2.0: one take or several shots

Read this when the user wants more than one shot, when a scene has dialogue back and forth, when the action is fast, or when a clip has to hold continuity across a cut.

## Default: one continuous take

A single take is the safest clip: one camera, one lens, one light, continuity for free. Write one take unless:

- the user asks for cuts, a montage, an insert, a reverse shot, or a cut-heavy style (trailer, music video, memory, chaos);
- the action cannot be staged from one camera position;
- a detail has to be seen close (an insert) while the scene also needs its space;
- two people's reactions have to be seen from different angles.

## Writing several shots

Label each shot and describe it in order: `Shot 1:`, `Shot 2:`, `Shot 3:`. Each shot carries:

- its camera: shot size, lens in degrees, at most one movement;
- who is in it and where, from its first frame;
- its action;
- its sound.

Name the transition at the start of each new shot: `Hard cut to`, `Cut to`. Hard cuts are the default. A match cut, an insert, a reverse shot or a whip can be named when the user wants one. Fades, dissolves and crossfades only when asked.

**Never give timestamps or durations**, not `0-3s`, not `[4s-8s]`, not `0:03`. ByteDance states the model handles precise timing badly and it can break the clip. Let the order of the shots and the weight of the action set the pace. If the user wants one part longer, say so in words: `a long, held close-up`.

Keep it to a few shots in a clip of this length. Each shot needs time to land; a crowded clip becomes a slideshow. Never let the model add cuts of its own: `cuts only where written`.

```text
An old woman in a green cardigan and a teenage boy in a school blazer sit across a wooden chessboard in a park at dusk.
Shot 1: Medium two-shot, fixed camera at table height, 47-degree field of view; the board centre frame, the woman screen-left and the boy screen-right, both leaning in. She slides her queen forward with one finger, then sits back and folds her arms. <a wooden piece taps the board>
Shot 2: Hard cut to a close-up of the boy, 29-degree field of view, camera about 5 metres away, the park lights compressed into soft discs behind him. His eyes flick from the board to her face and back; his jaw tightens. He says {That's not fair.}
Warm low sun from behind the woman, the camera on the shadow side, rim light on both profiles. Quiet realistic drama, sharp, natural colour, stable picture. The pieces stay where they were across the cut; no duplicate characters; subtitle-free, no logo, no watermark.
```

## Continuity across a cut

A cut must not reset the scene. What held before the cut holds after it:

- the same people, and no one new unless the user asked;
- the same place, and left and right the same way round unless the camera moved to the other side;
- the same gaze targets and body facing;
- the same light direction;
- the same clothes, props in the same hands, the same wet, dirt, blood or dust;
- the action carrying on, not restarting.

Put the risky ones in a lock: `the glass stays in her left hand across the cut`, `same jacket and helmet across the cut`.

## Lens across shots

Either one lens for the whole sequence (say so once: `47-degree field of view in every shot`), or a lens per shot that changes only with the kind of content (a face after a wide place), and only at a hard cut. Never a lens change inside a shot.

## Each prompt is one sealed clip

The model remembers nothing between clips. A prompt never says `as before`, `again`, `continues from the last shot`, `the other man`, or a scene number. It restates what matters: who, what they look like, where they are, the light.

For a sequence of clips, repeat each character's same identifying features and the same light in every prompt, word for word. Consistency comes from repeating the anchors, not from referring back.

## Dialogue scenes and action scenes

- **A conversation in one place:** one continuous take, or a clip that carries on from the last, holds together best. Cutting a quiet exchange into many shots breaks its rhythm.
- **Fast action, a chase, a turning point:** better as separate clips, each one clear, cut together afterwards. Inside one clip, give each shot one action.

## In i2v

The image is the first frame of Shot 1. A cut leaves it behind, so the next shot must say what it shows: who, where, which camera. Cut in `i2v` only when the user asks.
