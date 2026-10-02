# Chatterbox: how to prompt it

Chatterbox reads a line of text aloud in the voice of a sample. One model card,
`chatterbox`, one op: `tts` (Text to Speech). It used to be the Text to Speech Flow; it is a
prompt-box model now, so you reach it with `modelId: "chatterbox"`, `operation: "tts"`, never a
`flowId`.

## Pick it when

- The user wants a line spoken in a particular voice: theirs (a recording), a sample they
  give you, or a voice from the app's library.
- The line is in a language other than English: it speaks 23 (the op's `params.languages`).
- Not when the line must be PERFORMED. Chatterbox reads; it does not act. A laugh, a sigh, a
  cough or a pause written into the line is read out or dropped, never performed. DramaBox
  (a Flow, when the user has it) performs a line and builds a voice from a description.
- Not for music or sound effects: those are Stable Audio 3 (`stable-audio-3`).

## The voice: `audio1`, required

The op cannot run without a voice in its one media role, `audio1`. It is the voice the line is
spoken IN, taken from a short sample: a few seconds of one person speaking clearly.

- The user gave you a sample, or names a card that is one: pass it as
  `media: [{ role: "audio1", image: "<the ref>" }]` (the same `image` field carries a sound).
- No sample: pick a library voice. `describe_model` lists them on the `audio1` role: a name,
  a gender, an age, and that voice's variation ids. Pick the one that fits the speaker ("an
  old man": Elderly Male) and send `media: [{ role: "audio1", voice: "<id>" }]`.
- Never invent a voice id, and never send a description of a voice in the prompt instead: it
  would be read aloud.

## Settings

- `language`: the language the line is WRITTEN in, by name ("French", "Japanese"), one of
  `params.languages`. Leave it out and the run uses the user's last language on this model,
  else English. English runs the English-only model, every other language the multilingual
  one; the app picks between them from this one setting, so there is nothing else to send.
- The voice sample may be in any language: the line comes out in `language`, in that voice.
- Portuguese comes out as Brazilian Portuguese.
- No negative prompt, no batch, no enhancer. One line per run.

## The prompt shape

The prompt is the line itself, exactly as it should be heard, and nothing else. It is read
word for word.

- Write the words, with the punctuation that shapes them: a comma is a short pause, a full
  stop a longer one, a question mark lifts the end.
- Spell out what is awkward to read: numbers and abbreviations as words ("twenty twenty-six",
  "doctor") when the reading matters.
- No stage directions, no speaker names, no quotation marks around the whole line, no notes
  in brackets. All of them get spoken.
- Keep one run to a few sentences. A long script is several runs, one card each, which also
  lets the user redo one line.

## Examples

Right, `language: "English"`:

> Hello, and welcome to Cubric Studio. Let's make something.

Right, `language: "French"`, the line written in French:

> Bonjour et bienvenue. On commence quand vous voulez.

Wrong:

> A cheerful young woman says hello and welcomes the viewer.

That describes a voice and a delivery; Chatterbox would read the whole sentence out.

Wrong:

> [laughs] Oh, you came back!

The bracket is read or dropped, and nobody laughs. Without DramaBox, leave the sound out and
say so in one line ("Text to Speech can't laugh, so I left it out.").

## What to tell the user

The result is an audio card in the gallery. Say whose voice it is in (their sample, or the
library voice you picked, by name) and the language, in one line. If the voice is not what they
wanted, the fix is a different sample or library voice, not a different prompt.
