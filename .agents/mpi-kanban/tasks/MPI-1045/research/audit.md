# MPI-1045 audit - every use of the image-describer plugin (2026-10-08)

Fabio's first step: every call site, and whether it already tells the user when the plugin
is missing. Grep: `image-describer|ENHANCER_PLUGIN_ID|DESCRIBER_MISSING|pluginAvailability|
pluginForOperation|PLUGINS` over js/ routes/ services/ tests/.

| # | Call site | Plugin missing today | After MPI-1045 |
|---|---|---|---|
| 1 | Right-click "Describe image", gallery + history (`js/utils/describeAction.js` <- `MpiGalleryBlock`, `MpiGroupHistoryBlock`). The menu row itself is never gated. | `ui:warning` toast "Image Describer is not installed - add it from the Model Library (Plugins)." | branch removed: the code can no longer occur |
| 2 | Agent `look` (`agentDispatch._describeImage`, relay `agent.describe`) | `DESCRIBER_MISSING` back to the agent, which tells the user | code gone from the docblock |
| 3 | `POST /connector/describe` (`routes/connector.js`, MCP / outside agents) | `DESCRIBER_MISSING` returned to the caller, no toast | code gone from the docblock + skill |
| 4 | Remote > Language Models, ComfyUI row for Enhancement AND Image descriptions (`MpiLlmSettings._comfyInstalled`) | row disabled "Install the Image Describer plugin"; a kept pick shows "Needs the Image Describer plugin" | gate removed: ComfyUI always offered |
| 5 | ComfyUI Enhance (`llmService.runComfyEnhance`: prompt box, Character Sheet, Music Maker auto-enhance, every `enhanceFlow` on ComfyUI) | **NO check.** A missing weight fails inside ComfyUI as a generic generation error. The silent one. | the weight is an engineAsset, so it is on disk wherever the engine is |
| 6 | MPI-1036 Video Edit Flow (unshipped) -> `describeImage` | would hit #1's DESCRIBER_MISSING inside the Flow | covered by #1 |
| 7 | Cue prompt line of a describe job (`generationService` `pluginForOperation(op)?.title`) | n/a (cosmetic) - showed "Image Describer" | falls back to the op's label for a text op ("Describe Image") |
| 8 | Install-complete toast (`notificationService` PLUGINS title lookup), Model Library Plugins tab (`MpiModelManager`) | generic over PLUGINS | the row and the toast simply stop existing |
| 9 | User Flow packages (`services/userFlows.js` known plugins) | a package naming `requiredPlugins: ['image-describer']` validates | would be refused as unknown; no FlowDef or package declares it |
| 10 | Uninstall GC (`routes/downloadManager.js _pluginRequiredDepIds`, both engines) | the plugin protected the weight from any model uninstall | Rule 1: universal deps (engineAsset) are always kept, local AND remote, and the orphan sweep refuses universal |

## The mechanism for "installed with ComfyUI"

`engineAsset: true` on the dep (MPI-222). Local: `getUniversalWorkflowDepIds` includes it,
`/engine/repair-deps` installs it at boot when missing. Remote: `js/shell.js
_installRemoteEngineAssets` (MPI-380) volume-installs every non-`bakedOnPod` engineAsset at
first connect, deduped against the volume - no Pod image rebuild. Precedent: SAM3 (1.75 GB).

Cost: a user with no Krea2, no Music Maker and no plugin downloads 4.88 GB on the next engine
start and the next Pod connect. Fabio's call (2026-10-08).

Kept: the dep entry (Krea2 + Flows declare it; the orphan sweep reads DEPS). The `imageDescribe`
op (universal, unchanged). Krea2's / Flows' own `requiredDeps` listing of the weight (harmless:
already on disk, never deleted).
