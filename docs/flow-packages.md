# Flow packages — third-party Flows as data-only folders

> A **Flow package** is a folder holding a manifest, a ComfyUI graph and preview images.
> There is no code in it. Drop it on the Flow Library, or copy it into `user_flows/`, and
> the Flow appears next to the built-in ones. No registry file is edited (MPI-532).
> Packages are **Flows**, never "flow plugins": "plugin" already means a capability model here.

Code: `services/userFlows.js` (scan, validate, install) · `routes/userFlows.js` (list,
install, serve files) · `js/services/userFlowService.js` (register into the renderer
registries) · `MpiFlowLibrary` (tiles, drop target, Refresh). Tests:
`tests/user-flows.test.cjs`, `tests/desktop/flow-packages.spec.js`.

## Layout

```
user_flows/<id>/          the folder name MUST equal the manifest id
  flow.json               the manifest
  workflow.json           ComfyUI graph in API format (ComfyUI: Export (API))
  preview.webp …          every file the manifest names; flat, no subfolders
```

## `flow.json` — `cubric/flow-package/v1`

```jsonc
{
  "schema": "cubric/flow-package/v1",
  "id": "head-swap",                  // 2-41 chars: a-z 0-9 -. Registered as user:head-swap
  "version": "1.0.0",                 // x.y.z
  "author": "…", "homepage": "https://…", "licence": "…",   // recorded, not shown yet
  "compat": { "minAppVersion": "2.0.0" },                  // optional floor
  "flow": {                           // a FlowDef, minus id / operation / workflow
    "title": "Head Swap", "description": "…",
    "preview": "preview.webp", "video": "hero.mp4",       // package filenames
    "requiredModels": ["qwen-edit"], "requiredDeps": ["…"],
    "mediaType": "image", "type": "edit",
    "inputSchema": { … }, "steps": [ … ], "fields": [ … ]
  },
  "op": {                             // the command entry the Flow runs
    "label": "Flow: Head Swap", "progressLabel": "Swapping head",
    "mediaType": "image", "requiresImages": 2,
    "mediaInputs": [{ "key": "image1", "mediaType": "image", "title": "Input_Image", "required": true }],
    "injector": "headSwap", "filePrefix": "flowHeadSwap"
  }
}
```

**`flow` fields** (anything else is an error): `title`, `description` (both required),
`preview` (required), `video`, `requiredModels` (required list, may be empty),
`requiredDeps`, `requiredPlugins`, `modelParams`, `mediaType` (`image|video|audio`, the
OUTPUT), `type` (`create|edit|enhance`), `inputSchema`, `result`, `steps`, `fields`,
`derived`, `enhance`, `chain`. Their meaning is the built-in Flow's: the `FlowDef` typedef
in `js/data/flowsRegistry.js`, and [playbooks/add-flow/01-descriptor-and-ops.md](playbooks/add-flow/01-descriptor-and-ops.md).

**`op` fields** (anything else is an error): `label` and `mediaType` (required),
`progressLabel`, `requiresImages`, `requiresVideo`, `mediaInputs` (each
`{ key, mediaType, title: "Input_…", required }`), `promptRequired`, `injector`,
`filePrefix`.

**The app fills in:** `flow.id` = `flow.operation` = `user:<id>`; the graph path
`user-flows/<id>/workflow.json`; `op.universal = true`; `op.filePrefix`, when omitted, as
`flow` + the title in PascalCase (`flowHeadSwap`). Saved files use that prefix, never the
key: a colon is not legal in a Windows filename. It must be one camelCase word of up to
24 characters.

**Not offered to packages:** a `byModel` graph switch (a package carries ONE graph) and
progress stages (the bar runs without a total).

## Ids a package may use

Only what the running app declares: model ids (`js/data/modelConstants/models.js`), dep
ids (`js/data/modelConstants/dependencies.js`), plugin ids (`js/data/pluginsRegistry.js`),
and injector names (`js/services/workflowInjectors/index.js`):

| `injector` | Does | Writes these params itself |
|---|---|---|
| `headSwap` | Head Swap's two boxes → the box nodes | `box1`, `box2` |
| `resize` | Resize node params | `width`, `height`, `upscale_method`, `keep_proportion`, `pad_color`, `crop_position`, `divisible_by`, `flip`, `rotation` |
| `ltxSigmas` | LTX denoise → a sigma schedule | `Input_Denoise` |

An id the app does not have leaves the package **listed but disabled**, and the Library
names the reason: `Needs model "x", which this version of the app does not have.` Keeping
a Flow working across app versions is the author's job. A user who needs an abandoned
Flow can keep an older portable build.

Models listed in `requiredModels` bring their own install and licence gate, exactly as
for a built-in Flow.

## Graph rules (the title law)

The app writes values ONLY into nodes titled `Input_*`, and reads results ONLY from
nodes titled `Output_*`. Full contract: [workflow-authoring/injection.md](workflow-authoring/injection.md).
The validator checks, with no engine needed:

- at least one `Output_*` node; no two nodes share an `Input_*` / `Output_*` title;
- every `Input_*` node reaches an `Output_*` node; no link points at a missing node;
- a sampler with `noise_seed` needs a node titled `Input_Seed`;
- every `op.mediaInputs[].title`, every `Input_*` field id (the part before a `.`) and
  every `Input_*` key in `modelParams` matches a node title, case-insensitively, unless
  the op's injector writes that key. **This is why the validator exists**: the app skips a
  title with no node SILENTLY, so the Flow would run and ignore the value;
- no string widget holds an absolute path (`C:\…`, `/home/…`): it will not exist on the
  buyer's machine. Media loaders take their path from the app — leave them empty.

Node classes are NOT checked in the app, because no engine need be running. The linter
checks them.

## The one security rule — no markup

The renderer puts Flow text into HTML. A manifest key or string containing `<`, `>`, `"`
or `` ` `` rejects the WHOLE package. Use curly quotes (“ ” ‘ ’). Two exemptions, because
their values never reach the page: `placeholder` values, and anything under
`injectionParams` / `modelParams` (graph-bound; an enhance system prompt carries
`<|im_start|>`). A folder name with markup is not listed at all. Every other check is
there to help authors; this one is the security boundary.

## Install, refresh, remove

- **Drop** the package folder, or its `.zip`, on the Flow Library. In a zip, `flow.json`
  may sit at the root or inside one folder (how a zipped folder arrives). The package is
  unpacked into `user_flows/.staging/`, validated, and only then renamed into place, so a
  failed install leaves nothing behind. An id already installed asks **Replace Flow**. An
  invalid package shows its first error and writes nothing.
- **Copy** the folder into `user_flows/`, then restart or click the Library's **Refresh**
  (the icon at the end of the search row).
- **Remove:** delete the folder, then Refresh. The drawer's **Uninstall** frees the Flow's
  downloaded files (`requiredDeps`); it does not remove the package.
- **Where `user_flows/` is:** `<app folder>/user-data/user_flows/` on a released build;
  `%APPDATA%\Cubric Vision\user_flows\` when running from source. The server creates the
  folder on its first scan.
- **App updates keep it:** an update replaces the app and preserves `user-data/`
  (`PRESERVE` in `scripts/build-portable.mjs`). Pinned by `tests/user-flows.test.cjs`.
- A package whose files are unreadable, or that fails validation, still shows as an
  **Unavailable** tile. Its drawer names the reason and has no Run.

Routes: `GET /user-flows` (the scan, errors included) · `POST /user-flows/install
{ path, overwrite }` → always 200 with `status: installed | exists | invalid` · files at
`/comfy_workflows/user-flows/<id>/<file>` and `/comfy_workflows/display/user-flows/<id>/<file>`,
the paths every fetch site already uses, so no renderer call site knows about packages.

## Lint before you ship

From a checkout of the app repo:

```bash
node scripts/lint-flow-package.mjs path/to/head-swap
```

It runs the same validator the app runs (against that checkout's version), plus the
node-class check when a ComfyUI answers at `COMFY_URL` (default `http://127.0.0.1:8188`).
In this repo, `COMFY_URL=http://127.0.0.1:48188` checks against the app's own engine. Exit
0 = clean, 1 = problems (each one says how to fix it).

## Authoring notes

- Author on a ComfyUI whose node packs match the shipped engine (`dev_configs/node_lock.json`).
  MPI's bench is kept matched by `/mpi-bump-local-comfy`; the generated lockfile and
  installer for outside developers is **MPI-798**, due at the 2.0 release.
- A graph exported from a real project may carry your own file paths in its loader nodes.
  Clear them: the linter rejects them.
- MPI's paid Flows are packaged OUTSIDE this AGPL repo (MPI-781). A package is data, not a
  derivative of the app, so it can carry its own licence.
- Submitting a Flow for MPI to list: the public registry repo is **MPI-799**, due to open
  at the 2.0 release.
