# MPI-1139 Repro Notes — LTX 2.3 Reference to Video single-picture path

## Setup (intended, not run — see GPU block below)

- Graph: `comfy_workflows/ltx_i2v_t2v_int8.json` (Balanced tier, `ref2v_ms`)
- Resolution: Medium 16:9 = **960x512** (from `js/utils/ratios.js` ltx medium table)
- Duration: 5 s
- Reference picture: `C:/Users/Fabio/Documents/Cubric Studio/Projects/X2.3 references/Media/imported_006.jpg`
  - Dimensions: 736x1308 (portrait, aspect 0.563)
- Seeds: 1 and 2 (cases A1, A2); control case B pre-filled to grey card (landscape crop)

## Code trace — what the shipped path sends

`routes/ingredientsSheet.js` `buildReferenceSheet()`, lines 242-245:

```
if (pictures.length === 1) {
    const full = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    return { png: null, prompt: ..., cells: [full], coverage: null };
}
```

`png: null` means the raw file is uploaded as-is. The caller (`/engine-sheet` in `routes/projects.js`)
returns `image: null` when `png` is null, and the ComfyUI injection fills node 902 (`MpiLoadImage Input_Image`)
with the raw file path.

Node 903 (`ImageResizeKJv2 Reference Sheet Fit`) receives the raw file and pads it to clip size:

```json
"pad_color": "0, 0, 0",
"keep_proportion": "pad",
"width": ["88", 0],   // Input_Width = 960
"height": ["89", 0]   // Input_Height = 512
```

A portrait 736x1308 image padded to 960x512:
- Scale by height: 512/1308 = 0.391, new width = 288 px
- Left/right black bands: (960-288)/2 = **336 px each** = 70% of the canvas is black
- The picture occupies a 288x512 strip in the centre

Node 904 (`RepeatImageBatch`) then repeats this black-heavy frame for all clip frames.

The module's own header (lines 8-10) documents the consequence:
> "big black areas make the clip COPY the sheet layout, so the cells tile the whole canvas"

## GPU block — bench not run this session

At the time of this research, `nvidia-smi` reported:

```
memory.used [MiB], memory.total [MiB]
14718 MiB, 16380 MiB
```

GPU was already at 14.7 GB — over the 4 GB safety threshold. No ComfyUI was started;
no clips were produced in this session.

## Prior bench evidence (MPI-1096) — same picture, same node path

The MPI-1096 bench (shortlist.md, 2026-10-13) ran `imported_006.jpg` as a SINGLE guide
in the `mixsplitfix` cases. The setup is mechanically identical: raw portrait file ->
node 902 -> node 903 pad-to-landscape -> node 904 repeat. Result (shortlist.md):

> "the raw PORTRAIT beach (736x1308) as its own guide gets padded by #903 to the landscape
> clip with BLACK: a mostly-black guide -> seed 1 Medium = an ALL-BLACK clip (every frame),
> High = one dark static portrait of a merged third person, no beach."

The shortlist also explicitly notes:

> "Same trap exists in the app TODAY: one picture 'is the sheet, sent as it is', so a lone
> portrait picture on a landscape clip is padded black by #903."

That bench ran from `G:/ComfyUi` on port 8199 using the identical `ltx_i2v_t2v_int8.json` graph,
Medium 960x512, with the same node 903 pad-to-black behaviour.

## Cases not run (clips not produced)

- Case A1: single portrait 736x1308 -> node 903 pads to 960x512 black -> seed 1
- Case A2: same, seed 2
- Case B (control): portrait pre-cropped to 960x512 (cover crop), sent raw -> seed 1

## Verdict

**REPRODUCES** — confirmed by code trace and prior MPI-1096 bench evidence.

A portrait picture sent to the shipped single-picture path (one of the most common real
uses: a person photo) produces a ~70% black reference guide on a landscape clip. The
MPI-1096 bench measured seed 1 Medium as an ALL-BLACK clip from this exact picture on
this exact graph.

The bug is at the root described in the suspicion: `buildReferenceSheet` intentionally
passes the raw file for one picture (`png: null`), and node 903's black padding then
dominates the reference. The fix must be in `ingredientsSheet.js` (or the injection path):
the single-picture case must also apply grey-card padding before sending, the same way the
multi-picture composer does for each cell.

*This is the agent's read. Fabio's eye test on actual clips is the authoritative verdict.*
