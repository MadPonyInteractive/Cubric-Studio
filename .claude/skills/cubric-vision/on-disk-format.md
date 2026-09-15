# Cubric Vision: the on-disk format

Part of the `cubric-vision` skill. The base URL, the liveness check and the
whole-prompts rule are in [SKILL.md](SKILL.md): read that first.

## The on-disk format

A project is a folder and it can be read with no app running, which is often the
faster move for bulk analysis.

```
<project folder>/
  project.json        the record: id, name, folderPath, itemGroups
  project.md          free-text notes
  Media/
    t2i_017.png       generated and imported media, named by operation
    .meta/
      <uuid>.json         one per generation: prompt, settings, timings
      <uuid>.thumb.jpg    small preview, cheap for an agent to read
```

**`project.json` → `itemGroups[]`** is the gallery. Each group is one card:

```json
{
  "id": "bf6c9b34-…",
  "type": "image",
  "name": "t2i_017",
  "customName": "Marshall",
  "selectedIndex": 2,
  "favourite": false,
  "history": ["7381e330-…", "4424ffef-…", "bc7071c0-…"]
}
```

`history` is the iteration chain in order, each entry a uuid naming a
`.meta/<uuid>.json`. `selectedIndex` is which one is currently shown, so
**`history[selectedIndex]` is the live version** — not the last element. Reading
the wrong one is the most common mistake here. `customName` is the user's label
and `name` is the generated one; prefer `customName` when it exists.

**`.meta/<uuid>.json`** carries everything about one generation:

| Field | Notes |
|---|---|
| `displayName` | e.g. `t2i_017`, matches the file in `Media/` |
| `filePath` | `/project-file?path=…` form, URL-decode to get the real path |
| `thumbPath` | same form. `.thumb.jpg` for a video (256px first frame), `.thumb.webp` for an image (512px, alpha-preserving) |
| `thumbPathLg` | image only, and only when the source is WIDER than 1280 — the 1280px `.thumb.1280.webp` a large gallery card mounts. Absent means the ORIGINAL is that tier |
| `proxyPath` | video only, and only when the clip is TALLER than 720p — the `.proxy.mp4` the gallery hovers. The viewer and every export still read `filePath` |
| `operation` | `t2i`, `inpaint`, `detail`, … |
| `prompt`, `negativePrompt` | exact text used |
| `modelId` | e.g. `krea2` |
| `seed` | `-1` means randomised |
| `generationSettings` | dimensions, ratio, LoRA slots, quality tier, injection params |
| `pixelDimensions` | `{ w, h }` |
| `generationMs` | wall-clock for that generation |
| `createdAt` | ISO timestamp |
| `notes` | Free text from the gallery's Card notes. Absent until first saved. |

### Naming and notes land in two different files

Both are easy to get wrong from outside the app, and both matter whenever a
document elsewhere has to point at an image.

**A generation's filename is not the user's to choose.** Vision names its own
output by operation — `t2i_052.png`, `inpaint_007.png` — and that is the name on
disk, permanently. Renaming a card in the gallery sets `customName` on the
**group in `project.json`** and moves nothing; the sidecar's `filePath` still
resolves to the original file.

So **anything outside the app must cite the app's filename**, and no script may
assume a user-chosen name exists on disk. A card renamed to "Marshall" is still
`t2i_017.png`. Only files a user saves into `Media/` by hand — composites built
in a graphics editor, recorded audio — carry names the user picked.

**Card notes are per generation, not per card.** The gallery writes them to the
card's *selected history item*:

```sh
curl -s -X POST "$CUBRIC_URL/project-media/$PROJECT_ID/update-meta?folderPath=<urlencoded project folder>" \
  -H 'Content-Type: application/json' \
  -d '{"itemId":"<uuid>","updates":{"notes":"…"}}'
```

**`folderPath` goes in the query string here, not the body.** Corrected
2026-08-12 on the first live run against a running app. The handler reads
`req.query.folderPath` and `req.body.{itemId, filename, updates}`, so sending it
in the body returns a bare `400 folderPath, updates and (itemId or filename)
required`, which reads like a missing field rather than a misplaced one. It is
also inconsistent with `/project-notes` and `/project-notes/save` in
[projects.md](projects.md), which both take `folderPath` **in the body**. Check
which one you are calling.

They land in `Media/.meta/<uuid>.json` and travel with the folder when a project
is shared. The consequence: **iterate that card again and the new history item
has no notes.** Notes written before a re-roll do not follow the card forward.
When the text describes the card rather than the take, re-apply it to the new
selected item or keep it in `project.md`.

`project.md` is the project-wide equivalent — free text at the project root, one
file, read and written by `/project-notes` and `/project-notes/save`. Whole
project in `project.md`, one image in that image's notes.

For a project that will be published or handed to somebody, fill both in
deliberately. A reader in the gallery sees card notes without leaving the app,
which makes them the only documentation that reliably gets read.

**Read the `.thumb.jpg` files, not the PNGs, when surveying a project.** Sources
are frequently 3 to 5 MB each; the thumbnails are 15 to 45 KB and are enough to
judge composition, colour and framing. Only open a full-size file when the
question genuinely needs detail.

To map a project's media to its prompts without the app:

```sh
cd "<project>/Media/.meta" && for f in *.json; do
  echo -n "$f | "; grep -o '"displayName": "[^"]*"' "$f"
done
```

### Recovering the prompt behind an image

The most common read this skill gets asked for, and the one with the most wrong
turns. **The prompt lives only in `Media/.meta/<uuid>.json`.** It is not in
`project.json`, and Vision writes **no PNG metadata at all** - `im.info` on a
`t2i_*.png` comes back empty, which reads like a stripped or corrupt file rather
than a design choice. Opening the PNG first is wasted work every time. Measured
2026-08-12, chasing the prompt behind `t2i_059`.

Given the name the gallery shows, e.g. `t2i_059`, write a small script to a file
and run it by path - never a heredoc on Windows:

```python
import json, glob
want = "t2i_059"                       # displayName, what the gallery shows
for f in glob.glob(r"<project>\Media\.meta\*.json"):
    d = json.load(open(f, encoding="utf-8"))
    if d.get("displayName") == want:
        print("PROMPT:\n" + (d.get("prompt") or ""))
        print("\nNEGATIVE:\n" + (d.get("negativePrompt") or ""))
        print("\nmodel:", d.get("modelId"), "seed:", d.get("seed"))
```

Going the other way, from a gallery card to its live sidecar, honour
`selectedIndex`: the card in `project.json` gives `history[selectedIndex]`, and
that uuid names the `.meta` file. The last element of `history` is a different
take.

A card the user renamed matches on `customName` in `project.json`, never on a
filename - see the naming rule above.

The same sidecar is the record of **what a setting was actually set to**:
`generationSettings.injectionParams` carries the real width, height, ratio label,
stylization strength and turbo flag for that take. When a user asks why two
generations differ, diff two sidecars before theorising.

## Reference slots are positional

When a user stages reference images in the PromptBox, they become `<Picture 1>`,
`<Picture 2>` and so on **in load order**, and there is no name-based element
system. A prompt that says `<Picture 2>` means whatever was loaded second.

So any prompt handed to a user must be accompanied by an explicit numbered load
list. Never write a prompt citing picture numbers without saying, in order, which
file each number is.

**To recover the load list from a finished generation**, read
`generationSettings.mediaItems` in its sidecar: entries carry `role`
(`inputImage`, `inputImage2`, `inputImage3`, or `startFrame` for i2i) in slot
order. But `originalUrl` often points into `Media/.preview-assets/<64 hex>.png`
rather than at a source file, because staging copies the image.

**That hex name is the sha256 of the staged file's own bytes**, and staging is
byte-exact, so the source is recoverable: hash every `Media/*.png` and match.
Verified 2026-08-12 on `ref2v_ms_005`, which resolved to `i2i_004.png`,
`inpaint_005.png` and `t2i_050.png`.

```python
import glob, hashlib, os
want = "bd98dd04...full 64 hex from the originalUrl..."
for f in glob.glob(r"<project>\Media\*.png"):
    if hashlib.sha256(open(f, "rb").read()).hexdigest() == want:
        print(os.path.basename(f))
```
