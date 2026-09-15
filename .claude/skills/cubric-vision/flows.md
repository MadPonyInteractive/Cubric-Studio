# Cubric Vision: Flows and text-to-speech

Part of the `cubric-vision` skill. The base URL, the liveness check and the
whole-prompts rule are in [SKILL.md](SKILL.md): read that first.

## Running a Flow (and text-to-speech)

**A Flow is not a model, and `modelId` can never name one.** Flows run as an
operation with `model.id: null`, so head-swap, outpaint, character sheet and
both text-to-speech surfaces are unreachable through `modelId`. They take
`flowId` on the same endpoint, `/connector/generate`, instead (MPI-658):

```bash
curl -s -X POST "$CUBRIC_URL/connector/generate" \
  -H 'Content-Type: application/json' \
  -d '{"flowId":"drama-box","fields":{"positive":"A British woman says, \"Hello and welcome.\" She laughs softly.","Input_Duration":8}}'
```

`flowId` and `modelId` are **alternatives, not a merge** — sending both is a
`BAD_REQUEST` rather than a silent pick. A flow takes no `operation`: the
descriptor already names it.

| Key | Notes |
|---|---|
| `flowId` | The FlowDef id — `chatter-box`, `drama-box`, `ltx-extend`, … |
| `fields` | Declared field id → value. Every id must be one the flow declares; an unknown one is a `BAD_REQUEST` naming what it does declare. Omitted fields take the flow's default. |
| `media` | `[{ role, url }]`, **by reference, never bytes** — see Supplying your own audio |

**`fields` ids are not `injectionParams`.** They are the flow's own declared
controls, and the `Input_` prefix is what decides where each lands: `positive`
and `negative` reach the op as themselves, anything starting `Input_` is
injected into the graph. Values are clamped to the declared `min`/`max`, and
computed fields follow whatever you set — pick a language on Text to Speech and
its multilingual arm switches with it.

The authority for a flow's ids, defaults and options is its FlowDef in
`js/data/flowsRegistry.js` (grep `id: '`). Read it rather than guessing: a wrong
option value is rejected by ComfyUI with "Value not in list".

Extra failure codes on this path:

| Code | Meaning |
| --- | --- |
| `UNKNOWN_FLOW` | No flow with that id. |
| `OP_UNAVAILABLE` | The flow's models or deps are not installed — the message names what is missing. |
| `MEDIA_REQUIRED` | A required media slot is empty. Names the slot. |
| `BAD_REQUEST` | An undeclared field id, or a media role the op does not have. |

**A flow run draws no in-progress card.** Unlike a model submit, nothing appears
in the gallery until it finishes — the real card lands on completion. Silence is
not a failure.

### Supplying your own audio, image or video

Stage the file first, then pass back the url. Bytes never go through
`/connector/generate`.

```bash
curl -s -X POST "$CUBRIC_URL/project-media/$PROJECT_ID/place-preview-asset?folderPath=<urlencoded project folder>" \
  -H 'Content-Type: application/json' \
  -d '{"dataUrl":"C:/AI/Mpi/MadPony-Identity/voices/narrator.wav","ext":".wav"}'
```

**`dataUrl` takes a plain absolute path**, despite the name — it also accepts a
real `data:` url, a `/project-file?path=…` url, or `http(s)`. The route returns
`{ filePath, sha256, absPath }`; `filePath` is the `/project-file?path=…` url to
hand to `media`. The store is content-addressed, so staging the same bytes twice
costs one file.

`folderPath` goes in the **query string** here, like `update-meta`
([on-disk-format.md](on-disk-format.md)).

**Use `.wav`, `.mp3`, `.flac`, `.ogg`, `.aac` or `.m4a` for audio.** `.opus` is
not in the app's audio extension lists and will not classify as audio — the app's
own voice picker decodes to WAV for exactly this reason. Convert before staging.

### The two text-to-speech flows

Both are Flows, both output audio, and they are not interchangeable.

**`chatter-box` — "Text to Speech".** Speaks your line in a voice you supply.
The voice sample is **required**: its graph blocks without one, and ComfyUI
reports SUCCESS with no output, so the skill refuses the run up front with
`MEDIA_REQUIRED` instead.

```bash
curl -s -X POST "$CUBRIC_URL/connector/generate" \
  -H 'Content-Type: application/json' \
  -d '{"flowId":"chatter-box",
       "fields":{"positive":"Hello and welcome to Cubric Studio.",
                 "Input_Language.language":"English (en)"},
       "media":[{"role":"audio1","url":"<filePath from place-preview-asset>"}]}'
```

- `positive` — the line to speak.
- `Input_Language.language` — one of 23, written exactly as the FlowDef lists it
  (`English (en)`, `Japanese (ja)`, `Chinese (zh)`, …). Defaults to English.
  Portuguese delivers **Brazilian** Portuguese.
- `media` role `audio1` — the voice to speak in. Required.

Verified end to end 2026-08-29 on an isolated instance: a staged `.wav` handed in
as `audio1` returned `flowChatterBox_001.flac` (24 kHz mono) in 38.9s, as a real
`type: "audio"` gallery card. Its sidecar carries `flowId`, `flowInputs` with the
media by reference, and the derived language arm — so **Reuse reopens the flow
with the agent's own inputs restored**.

**`drama-box` — "DramaBox".** Text to speech you direct in words, with the voice
reference **optional**: leave `media` off and it invents a speaker from the line
alone. It holds a supplied voice more closely than Chatterbox does.

- `positive` — put the spoken words **in quotes**; anything outside them is a
  stage direction it performs rather than reads aloud. `A British woman says,
  "Hello." She laughs softly.` Not `[laughs]` — the model wants prose.
- `Input_Duration` — seconds, 4 to 30, default 5. **A hard window: a line that
  runs past it is cut off mid-word.** Give a long line more seconds. Never 0.
- English only. Accent rides on the prompt and only trained accents land.

Both need their weights installed — roughly 4GB for Chatterbox's English arm,
15GB for DramaBox. `OP_UNAVAILABLE` names what is missing; the user installs it
from the Flows library.

**Not covered yet:** the app's shipped 56-voice library is pickable in the UI but
has no HTTP listing, so an agent supplies its own sample rather than naming a
stock voice.
