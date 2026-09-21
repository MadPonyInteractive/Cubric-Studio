# MPI-882 - validation

## The defect, measured on the live box

Fabio's app raised `"Doodle.safetensors" was not found in your LoRA/upscale folders` on
every Klein 4B generation, while Model Settings showed all six LoRA slots empty. Doodle is
not a user slot: it is baked into `comfy_workflows/klein_t2i.json` node `101`
(`MpiStyleLoras`), so it is validated on every run whatever style is chosen.

`app.log` (2026-09-21 12:55:36):

```
value_not_in_list: lora_1: 'flux2-klein\styles\4b\Doodle.safetensors' not in (list of length 243)
[WARN] [comfy] Local LoRA missing from model folders: Doodle.safetensors
...
Prompt executed in 0.62 seconds        <- the style nodes were skipped, no image
```

Four of Klein 4B's eight style weights were absent from
`G:\CubricModels\loras\flux2-klein\styles\4b\` — Anime, Chibi, Doodle, Vintage — and those
are exactly the four basenames Klein 9B's rack also ships, one folder over.

## Root cause

`resolveComfyPath` (`routes/shared.js`) resolved a dep by BASENAME anywhere inside its
bucket when the declared path held no file. Measured against the real disk before the fix:

```
klein-style-doodle  -> G:\CubricModels\loras\flux2-klein\styles\9b\Doodle.safetensors | installed = true
klein-style-vintage -> ...\9b\Vintage.safetensors | installed = true
klein-style-anime   -> ...\9b\Anime.safetensors   | installed = true
klein-style-chibi   -> ...\9b\Chibi.safetensors   | installed = true
```

So the installer skipped four downloads, `/comfy/models/check` reported klein-4b fully
installed, and the model stayed in every picker — while ComfyUI, whose loader enum IS the
path relative to the search root, could not name the file the graph asked for.

## The fix

1. `routes/shared.js` — a dep resolves at the relative path it declares (custom root, then
   the default root the yaml keeps searchable). No basename search.
2. `routes/remotePodState.js` — `_resolveLocalModelPath` tries the dropdown value's own
   path in each searched root before falling back to a basename walk, so a remote upload
   cannot ship the sibling rack's weight under the right name.
3. `js/services/commandExecutor.js` — a missing file that belongs to a SHIPPED dep now says
   the model's download is incomplete and points at the Model Library, and both
   missing-file branches call `syncModelInstalled()`, so install state re-reads itself
   instead of staying wrong until the next boot.
4. `docs/download-manager.md` — the resolver section now describes the declared-path ladder.

## Evidence

- `node tests/dep-path-agreement.test.cjs` → exit 0, 7 cases, including the two new ones:
  `the deep weight at its declared path → true`, `a same-named weight in the SIBLING rack →
  false`. The pre-existing `the weight nested ELSEWHERE inside the right bucket` case flipped
  from `true` to `false` — that expectation WAS the bug.
- `npm test` → 1741 tests, `fail 0` (the one `⚠` is MPI-867's pre-existing todo).
- Route-level, real disk, after the fix: `localModelsCheck` on Klein 4B's style rack returns
  `model installed = false`, with muppets/cartoon/jojo/aesthetic `true` and
  anime/chibi/doodle/vintage `false`. `klein-4b` is a flat model with no `variants`/`engines`
  block, so `isModelUsable` is `model.installed !== false` → false → it leaves every picker
  and the Model Library offers it for install, with only the four missing files to fetch.
- Blast radius on this disk: a sweep of all 122 resolved deps across every model found
  exactly FOUR that the old ladder adopted from a wrong path — the four Klein 4B styles. No
  other model's install state changes.

## Deliberate trade

A user who nested one of OUR weights somewhere of their own now reads not-installed and
re-downloads it. That is the truth for a graph that names the declared path: the old answer
left them with a model that could not run.

## Left to the user

The four 4B weights are on the CDN with the byte counts `loraDeps.js` declares (Anime
92426264, Chibi 92426632, Doodle 23122832, Vintage 92427896). Restart the app (the resolver
lives in the main process) and press Install on Klein 4B in the Model Library to pull them.
