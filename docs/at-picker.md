# The `@` picker: how a text box references things

`@` is the app's one reference symbol (rule: `.claude/rules/dos_and_donts.md` § `@`, Fabio
2026-10-27). Wherever a user types text that names something the run will use, typing `@` opens a
list of those names at the caret, and a pick writes the tag in. This file is the contract behind
that rule: where the picker lives, what it matches, what a pick writes, and what is not covered.

## Where it lives

| Text box | What `@` lists | Popup | What a pick writes |
|---|---|---|---|
| Prompt box, positive prompt only | staged references (slots with a `tag`), then Box names (MPI-1181) | its own, `MpiPromptBox.js` `_syncRefPicker` (`.mpi-prompt-box__ref-picker`) | `refTagHandle(tag, model, slot)` + a space |
| A declared Flow `text` field with `tags` | that field's closed list (Song's Lyrics: nine section tags) | `attachMentionPicker` (`js/utils/mentionPicker.js`), wired in `declaredFields.js` | `[Tag]` on its own line |
| Any other text box | whatever its caller passes as a live `getTags()` | `attachMentionPicker` | the caller's `wrap` (angle by default) |

The negative prompt never opens it: tags address references, and a negative prompt has none.

## One matcher

`matchRefTagQuery(value, caret, tags)` in `js/data/commandRegistry.js` decides what a half-typed
`@` matches, for both popups. Its edge cases are the contract:

- `@` must follow the start of the text, whitespace or `( [ " '`, so an email address never opens it.
- Word characters after `@` narrow the list; a space or punctuation closes it.
- A tag's own spaces need not be typed: `@pic` reaches `Picture 1`, case-insensitive.
- No match closes the popup instead of offering everything; an empty list opens nothing.

Keys: Up/Down move, Enter or Tab picks, Escape closes; picks fire on `mousedown`, because a click
would blur the textarea and close the popup first. The shell's Tab hotkey stands aside while
either popup is open: `MENTION_PICKER_OPEN_SELECTOR` in `js/managers/hotkeyRegistry.js` matches
the fixed marker class `mpi-mention-picker` (never the caller's BEM class) and
`.mpi-prompt-box__ref-picker`.

## What a pick writes: the words the model reads

A tag is worthless if the graph strips it or the model ignores it. `refTagHandle` turns a slot tag
into the model's own way of naming a picture:

| Model declares | `Image 2` is written as |
|---|---|
| `capabilities.atRefTags` (Seedance 2.0) | `@image2`: `<...>` reads as a sound effect there |
| slot without `tagInProse` (reference-to-video ops such as Wan 3.0; Box names) | `<Image 2>` |
| `tagInProse` slot, `capabilities.qwenRefTags` (Qwen-Image 2.1) | `<image2>` |
| `tagInProse` slot, `capabilities.ordinalRefTags` (FLUX.3) | `the second image` |
| `tagInProse` slot, nothing else (FLUX.2, Klein, Krea2, Qwen Edit, Seedream) | `image 2` |

A new vendor form is a new capability read here: look up the vendor's rewriter or prompt guide,
never guess (`docs/playbooks/add-model/04-ops-and-controls.md`). A model that reads no reference
(MOSS-Image) gets no tags, so `@` offers nothing there.

Square brackets for Song are load-bearing: `Strip_Voice_Markers` cuts every `<...>` run before the
encoder, so the first Lyrics picker (voice names in angle brackets) wrote a no-op the user followed
on two live runs (MPI-664).

## Two popups on purpose

`MpiPromptBox` kept its own copy when `mentionPicker.js` was extracted (Fabio, 2026-09-10): it is
wired into that organism's draft, mode and emit plumbing. Both behave the same. Repoint it at the
util the next time that file is open for a real reason; the diff is a deletion. Never add a third.

## Gates, and what is not covered

| Covered by | Checks |
|---|---|
| `tests/ref-tag-picker.test.cjs` | the matcher, and that every MODEL op with 2+ references tags its slots (MPI-1312) |
| `tests/mention-picker.test.cjs` | the splice, the Lyrics list, the marker class |
| `tests/desktop/prompt-box-edit-ref-picker.spec.js`, `tests/desktop/flow-section-tag-picker.spec.js` | both popups live |

- **Nothing tests a Flow.** The add-flow checklist line is the only gate
  (`docs/playbooks/add-flow/README.md`).
- **A Flow text box cannot name the Flow's own staged pictures yet.** Declared `tags` is a closed
  list. That is new work: card it, never improvise a syntax.
