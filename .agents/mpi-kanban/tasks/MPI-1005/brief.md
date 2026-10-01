# MPI-1005 Brief - Song asks with a real card

Umbrella: MPI-1000. Raised by Fabio during MPI-1002's look, 2026-10-01.

## What Fabio asked

> Couldn't the review lyrics button just be an actual button that opens flows right away instead
> of giving instructions to the agent? Buttons like this should just be commands that run as soon
> as we click them. [...] the agent is spending tokens for nothing if the button can just do its
> job right away. I like the fact that it comes in a nice box.

He said yes to building it (2026-10-01), as its own card under MPI-1000, before 2.0.

## Why (what MPI-1002's look showed)

- Today Song's ask is PROSE in `docs/agent/flows.md` ("Song, in this order": song in the chat,
  `[options: Review lyrics | Just do it]`, no `generate` until they answer). The options are text
  chips: a click sends "Review lyrics" as a user message, so Cosmo runs a whole turn (it re-read
  list_models, a project note, app:formats, minimax-music's settings and app:flows before acting).
- The ask only happens if the model obeys. It did not once: DeepSeek opened Song on turn one and
  asked afterwards, so Review lyrics had nothing to open (fixed by rewording in `fb506e1fb`, but
  still prose).
- The step line read "Starting generation" over an open; Fabio thought a run had started and told
  Cosmo to run it (label fixed in `fb506e1fb`: the done frame says "Opened <Flow>").

## Wanted

Cosmo composes and calls `generate` for Song with the fields filled. The APP shows a card in the
chat: the lyrics in the box he likes (what will actually be sung, from the field), then
**Review lyrics** and **Just do it**. Review lyrics opens the Song at "Write the song" at once;
Just do it runs it at once. No agent turn for the click. Typing instead of clicking (e.g. "change
verse 2") answers the card: it closes and the typed message is what Cosmo reads next.

## Also: the cut-off stays at its maximum (Fabio, 2026-10-01)

> we should leave the cut-off at its maximum. It's frustrating having to wait almost 10 minutes for
> a song to finish, only to find out that it got cut off at 3 minutes and it still had more to go on.

Cosmo set `Input_Duration` ("Cut off at", slider 30-360 s, default 300) to 3 minutes on his own;
the render took ~10 min and the song was cut mid-way. Pick (confirm the hand-default half with
Fabio): Cosmo never sends `Input_Duration` unless the user names a length (guide line, and/or drop
it from what the agent is shown), and the field's default goes to the slider max, 360.

## Noticed

- Cosmo's chat lyrics carry stage notes in tags (`[Verse 1 - Her]`) and round-bracket directions;
  he strips them when filling the field. With the card showing the FIELD text, what you read is
  what gets sung.
