# Stable Audio 3: how to prompt it

Stable Audio 3 makes a sound from a description. One model card, `stable-audio-3`, one op:
`t2a` (Sound & Music). It used to be the Sound & Music Flow; it is a prompt-box model now, so
you reach it with `modelId: "stable-audio-3"`, `operation: "t2a"`, never a `flowId`.

It makes four kinds of sound:

- **Music**: a backing track or an instrumental piece.
- **Instrument**: one instrument playing, a riff, a phrase or a texture.
- **Sound effect**: a noise or an event, such as a door, rain, an engine or a room tone.
- **One-shot**: a single hit in near-silence, such as a stick, a snare or an impact.

## Pick it when

- The user wants music with no singing, a sound effect, an ambience, or a single hit.
- Not when anyone sings. Words that are sung are the Song Flow's (MiniMax Music), and this
  model does not claim them. A request for "a song" with lyrics goes there.
- Not for speech. A spoken line is Text to Speech (the `chatterbox` model) or DramaBox.

## Settings

- `category`: one of `Music`, `Instrument`, `SFX`, `One-shot` (the op's `params.categories`).
  It is not a style hint: it picks which checkpoint runs. `Music` and `Instrument` run the
  larger model; `SFX` and `One-shot` run the small one built for effects. Always send it,
  matched to what the user asked for. A door slam sent as `Music` comes back as music.
- `duration`: the length in seconds, 1 to 190 (`params.duration`). It is exact: ask for 4 and
  the file is 4 seconds long, to within a tenth of a second. Leave it out and the run uses
  the user's last length on this model, else 10.
  - A one-shot is short: 1 to 3 seconds.
  - A sound effect is as long as the event: a door slam 3 or 4, rain or a room tone 15 to 30.
  - A backing track is as long as the user says; when they say nothing, 30.
- No media, no negative prompt, no batch. One sound per run; for several takes send
  `count`, and each comes back as its own card.
- There is no prompt enhancer for this model, on purpose. What you write is what it hears.

## The prompt shape

Describe the SOUND: the thing itself, what it is made of, and the space it is in. Not a
picture, not a story, and not a list of quality words. One or two sentences.

1. The source: what makes the sound, as concretely as you can ("a heavy wooden door", "an
   upright piano", "a steel spoon on a ceramic mug").
2. The action or the playing: what happens ("slams shut", "plays slow broken chords").
3. The space and the tail: where it is and how it rings out ("in a stone corridor, long
   tail", "dry, close", "in a small tiled bathroom").
4. For music only: the style, the instruments, the mood, and a tempo in BPM when it matters.

Write what you want, never what you do not: there is no negative box, and "no drums" puts
drums in the description.

## Examples

Sound effect, `category: "SFX"`, `duration: 4`:

> A heavy wooden door slamming shut in a stone corridor, long tail.

Ambience, `category: "SFX"`, `duration: 20`:

> Steady rain on a tin roof with two distant rolls of thunder, night, no wind.

One-shot, `category: "One-shot"`, `duration: 2`:

> A single dry drumstick click, close and bright, no room.

Instrument, `category: "Instrument"`, `duration: 12`:

> A nylon-string guitar playing a slow, warm fingerpicked phrase in a small wooden room.

Music, `category: "Music"`, `duration: 60`:

> Warm lo-fi hip hop beat with dusty vinyl drums, mellow electric piano chords and a soft
> bass line, 80 BPM, relaxed late-night mood.

Wrong, for any category:

> amazing, high quality, masterpiece, 4k

Quality words describe no sound, and the model has nothing to make from them.

## Adapting what the user asked for

- "Make a sound of X": decide the category yourself from X, and the length from the event.
  Do not ask which category; it is your call and you say it in the reply if it matters.
- "Background music for my video": `Music`, the clip's own length when you know it.
- "A drum hit", "a click", "a whoosh": `One-shot`, short.
- A user who wants vocals over the track: tell them in one line that this model makes no
  singing, and offer the Song Flow.

## What to tell the user

The result is an audio card in the gallery. Say what you made and how long it is, in one
line. A run takes seconds for a short effect and longer for a long track; a 190 second
piece can take a few minutes.
