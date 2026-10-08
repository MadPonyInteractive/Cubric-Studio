# 3D Scenes (MPI-623) — dev_mode only

> A 360 pano becomes a scene the user walks around in to take EXACT-camera stills (behind a house,
> up a tree, through a shut window). Everything here sits behind `APP_CONFIG.dev_mode` until it
> ships. This doc holds what is BUILT; the remaining design (viewer, Take picture, Build here, the
> Pano Flow) is the card's plan: `.agents/mpi-kanban/tasks/MPI-623/plan.md` § Design, A1-A9.

## A scene card is an image card

- An image card is a Scene card when ANY item of the card carries **`scenePath`** (a
  `/project-file?path=` URL of the manifest). `splatPath` (a `.ply`) also counts and is reserved
  for a future Wan bake (`Output_Splat`, Phase 1); nothing writes it today.
- **Read scene-ness off the CARD, never the selected entry:** `getSceneItem(group)`
  (`js/utils/assetKinds.js`) drives the open intercept (`MpiGalleryBlock` `open-group` ->
  `PAGE_SCENE`), the 3D badge, the `scene` kind filter and the add-to-project copy. Pictures
  taken in a scene become history entries of the card; selecting one must not turn the card back
  into a plain image.
- The workspace: `PAGE_SCENE` -> `MpiSceneBlock` -> `MpiSceneCanvas` (three ^0.186.1, render on
  demand). The canvas owns the only GL context and its `el.destroy()` disposes the renderer, forces
  the context loss (`renderer.forceContextLoss()`, not left to GC) and zeroes the canvas;
  `tests/desktop/scene-workspace.spec.js` proves 10 visits leave no live context.

## The viewer

- `MpiSceneBlock` loads the card's scene through `js/services/scene/sceneViewer.js`
  (`loadScene` -> `createPanoMesh`) into `MpiSceneCanvas.getScene()`. Ported from spike 0a, whose
  renderer matched the Python reference (rule C hole IoU >= 0.9995, colour <= 0.13/255, 435+ fps at
  1080p on a 4060 Ti; MPI-623 `research/spike-0a.md`): the same grid, colour looked up by DIRECTION
  per fragment, a raw shader with no colour management, the same camera maths (`applyPose`).
- Coordinates: the world is y-DOWN (OpenCV, as the fill layers' `w2c`); a pose is
  `{ pos, yaw, pitch, mm }` in y-UP spot coords (+X right, +Z forward, origin = the pano camera).
  The lens is full-frame `mm` across the frame WIDTH, so `applyPose` re-runs on the canvas's
  `resize` event. `el.getPose()` / `el.setPose()` on the Block.
- Fly: `scene.fly.*` hotkeys, a DOWN and an UP entry per key (W/S/A/D, Q/E down/up), gated to
  the Scene page; `agentMode.toggle` is gated OFF it so A only flies. Drag looks. Frames are drawn
  on demand, a loop only while a key is held. `tests/desktop/scene-viewer.spec.js`.
- Not yet: rule C, the fill layers, frame guides, the picture panel. When it gains reverse
  depth, three ^0.186 calls the option `reversedDepthBuffer` (0.170's `reverseDepthBuffer` is
  ignored there without a word).

## Companions and the manifest

A scene is a SET of files beside the item's sidecar in `Media/.meta/`:

| file | what |
|---|---|
| `<id>.scene.json` | the manifest `scenePath` names |
| `<id>.scene.pano.png` | the 8K equirect texture (8192x4096) |
| `<id>.scene.pano_depth.f32` | equirect depth: raw little-endian float32, `h` rows x `w = 2h`, no header |

```json
{ "version": 1,
  "pano": { "image": "pano.png", "depth": "pano_depth.f32", "w": 2048, "h": 1024, "sky": 37.8 },
  "layers": [] }
```

- The manifest names its siblings **by suffix, never by id**, so the add-to-project copy renames
  the whole set under the new id without editing it (`routes/projects.js`, add-from-cards).
- Every `<id>.scene.*` file matches `DERIVATIVE_RE`, so delete, the orphan sweep and GC treat the
  set like thumbs. A scene suffix must never contain `.thumb.`/`.proxy.`/`.splat.`/`.wave.`.
- `w`/`h` are the DEPTH grid (the texture is larger). `sky` is the depth file's max: the node
  pushes every invalid (sky) pixel to twice the farthest real depth. That rule is outlier-led
  (one far pixel moves the dome); a viewer wanting a steadier dome should use a percentile.
- The shape is the spike's records `scene.json` (`D:\WORK\MPI-623-spike\single_shot\viewer\records\`),
  so `layers[]` will take pinhole records: `image`, `depth` (0 = not kept), `w`, `h`, `w2c`
  (16 floats, OpenCV), `fx`, `fy`, `cx`, `cy`.

## Convert to 360 pano

Gallery right-click, offered when `canConvertToPano(group)`: an image card with no scene whose
selected entry is a plain still at EXACTLY 2:1 (the app cannot tell a pano from a banner, so it
offers and the user says which). The flow:

1. `MpiGalleryGrid` emits `convert-pano`; `MpiGalleryBlock` runs `convertToPano`
   (`js/services/scene/sceneConvert.js`) with an info toast, and a module-scoped set refuses a
   second Convert of the same card while one runs.
2. `runSceneOp({ op: 'sceneConvert', imagePath })` -> `{ imageUrl, depthUrl }` (`/view` URLs).
3. `POST /project-media/:projectId/scene?folderPath=` `{ itemId, imageUrl, depthUrl }` downloads
   both over the /view proxy (so a Pod's output reaches the app), writes the manifest, and writes
   `scenePath` to the sidecar LAST. Any failure removes every `<id>.scene.*` it wrote: the card
   stays a plain image rather than one that opens onto missing files. An unknown id is a 404,
   because `updateItemMeta` would otherwise mint a sidecar.
4. The client mirrors `scenePath` on the live item and emits `gallery:item-updated` (the card-notes
   pattern); the card repaints with its badge and the next left-click opens Scene.

## The engine ops

Both are universal ops (the 4-file registration) run by **`runSceneOp`** (`commandExecutor.js`),
never `runCommand`: a depth-only run has no image URL and `generationService` treats an empty
result as a CANCEL, and Convert must not make a card.

| op | graph | in | out |
|---|---|---|---|
| `sceneConvert` | `scene_convert.json` | `Input_Image` | `Output_Image` (8K) + `Output_Depth` |
| `sceneLift` | `scene_lift.json` | `Input_Image` (a fill), `Input_Known_Depth`, `Input_Fov_X` | `Output_Depth` |

- **`Output_Depth`** is a `PreviewAny` holding the path the node wrote under `output/scenes/`;
  `splatViewFileInfo(path, 'scenes')` turns it into a `/view` file dict (the `Output_Splat`
  contract, which is what makes it work on a Pod whose disk the app cannot open).
- **sceneConvert** upscales with wrap-padded AnimeSharp 4x (`MpiWrapPad` 32 -> model ->
  `MpiWrapCrop`) only when the input is UNDER 4096 wide, then scales to 8192x4096; wider inputs are
  only resized (a 4x model on a 4K+ pano builds a 16K+ intermediate). The switch is in the graph
  (`MpiCompare` + lazy `MpiIfElse`). Depth: `MpiPanoDepth` at 2048 (12 MoGe views merged).
- **sceneLift**: `Input_Known_Depth` is a float32 file of the render's camera z (0 = unknown) the
  size of the fill. Its node is an **`MpiString`**, a `PATH_MEDIA_CLASSES` member, so the engine
  stages the file into the local `input/` or uploads it to a Pod like any media path; a plain text
  node would hand a Pod a path on the user's disk. `MpiLiftDepth` fits `z = a * MoGe + b` on the
  known pixels (eroded 9 px) and keeps the holes grown 5 px, minus depth edges; output 0 = not kept.
- Measured on a 4060 Ti: pano depth 46 s (2.8 GB VRAM), sceneConvert from a 2K pano 92 s,
  sceneLift 2-4 s. The nodes reproduce the spike exactly (validation.md, MPI-623).

## Nodes and weights

- `ComfyUi-MpiNodes` `scene.py` (category `MpiNodes/Scene`): `MpiPanoDepth`, `MpiLiftDepth`,
  `MpiWrapPad`, `MpiWrapCrop`, `MpiWrapSoften`, `MpiWrapCutMerge`; MoGe v1 vendored in `scene3d/moge/`
  (MIT; DINOv2 parts Apache-2.0), pure torch, no runtime download. Its `__init__.py` import is
  unguarded: a scene import failure takes every MpiNodes node down, so its deps (`cv2`, `scipy`)
  must stay in `dev_configs/python_deps.in`.
- Weights: dep **`moge-vitl`** (`moge/moge_vitl.safetensors`, 1.17 GB on R2) - Ruicheng/moge-vitl's
  pickle `model.pt` re-saved as safetensors (every tensor equal); `scene.py` pins its config as
  `MOGE_VITL_CONFIG`. `noMirror: true` (our bytes, no upstream twin) until re-hosted on HF.
  **Not `engineAsset`** (that would put 1.17 GB on every engine): the dev-only **3D Scene**
  plugin (`scene-convert`, `pluginsRegistry.js`) owns it, so it installs from the Library and the
  GC guards keep it; Convert warns when the plugin is not installed.
- The `moge` model folder: mapped on the Pod by mpi-ci `start.sh` (release:check's MPI-143 guard;
  live on the `dev` runtime channel, not yet promoted), locally by the yaml `yamlHelper.js` derives
  from the deps. An existing install's yaml learns a new folder type at the next engine start:
  `syncExtraModelPathsYaml` (`routes/shared.js`) rewrites it when it differs from the builder's.
