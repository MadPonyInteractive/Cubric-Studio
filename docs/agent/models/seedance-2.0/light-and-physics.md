# Seedance 2.0: lighting and physical motion

Read this when the light has a job (a backlight, a single window, night, a harsh noon) or when the action is physical (running, lifting, pouring, cloth, dust, a vehicle). It feeds the **Lighting** and **Action** parts of the prompt.

## Lighting is a lock, not a mood word

A mood word ("moody", "cinematic lighting") lets the model light the scene evenly from the front, which is the look it falls back to. Name the light instead:

- **The source:** low sun, a single window, a streetlamp, a fire, overhead fluorescent tubes.
- **Its direction:** from camera-right, from behind the subject, from above.
- **The camera's side:** is the camera on the lit side or the shadow side of the subject?
- **What stays dark:** the face, the far wall, the corners.
- **What the exposure favours:** the bright background, or the face.

`Low sun from behind her and to camera-right, the camera on her shadow side; a gold rim along her hair and shoulders, her face in soft shadow, the bright field behind her holding its detail.`

### Backlight

The most wanted and most often lost look. It needs all of these:

- The subject stands between the camera and the brighter background.
- The camera is on the shadow side.
- The face stays dark; only rims, edges, wet highlights and eye glints show detail.
- A lock: `no front light, no fill on the face`.

If a result came back flat, push harder: `exposed for the bright background, the face allowed to fall into deep shadow, the silhouette and the rim carry the image`.

### Night and practical light

Name every light that exists in the scene and let the rest be dark: `the only light is the phone screen, cold blue on his chin and hands; the room behind him black`. Unnamed fill is what makes night look like day.

### In i2v

The first frame already has its light. Hold it: `the light keeps the direction it has in the first frame`. Change it only when the user asks, and then say what changes and where the new source is.

## Physical motion

Seedance renders motion convincingly when the prompt gives it cause and effect: mass, contact, momentum, the thing that moves a beat later. Write the physics, not the adjective.

- **Weight:** `weight settles into his heels`, `the bag drags her shoulder down`.
- **Contact:** feet land and push off; hands grip and press; a wheel bites into gravel.
- **Follow-through:** `the coat swings on after she stops`, `hair lags behind the turn`.
- **Resistance:** `the door resists, then gives`, `the rope pulls taut before it lifts`.
- **Material:** water sheets off and pools; dust drifts with the wind in every depth layer; steam thins as it rises; glass cracks along a line before it breaks.

Body mechanics, when a body moves:

- Walking: the heel lands first, the weight rolls forward, the hips sway, the toes push away.
- Running: real ground contact, knees lifting, arms swinging against the legs, a forward lean, strides that are not identical.
- Carrying or swinging something heavy: the arm shows the weight, the wrist angles under it, the swing speeds up and slows down.

### Name the body part, and how much

Say which part moves, how far, how fast and how hard: `slowly raises her right hand to shoulder height`, `turns his head sharply to the left`, `pushes hard off the floor with both hands`. And say how one action carries into the next: `using the momentum of the turn, she raises the hand`.

### Prefer continuous movement

The model is most reliable with steady, continuous movement: a walk, a slow turn, a reach, a lift. Big bursts (a sprint start, a high jump, a roll, a fight flurry) are where limbs and objects break. When the user asks for one, keep it, and give it the most physical detail in the prompt: the contact, the weight, the recovery.

### States, not transitions

Describe the body already in the action (`mid-stride`, `arm extended in the throw`, `halfway through the turn`) rather than every step on the way (`opens the cupboard, lifts out the bowl, carries it across, sets it down`). A long process collapses; a chain of clear states lands.

## Never write

- "Moody lighting" or "cinematic lighting" with no source and direction.
- "Moves", "goes", "becomes": say how.
- Motion with no contact, as if the subject floated.
- A second light source you did not mean: every named light appears.
