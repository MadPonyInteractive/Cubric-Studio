# MPI-1100 validation

Rule text only. Check: every symbol the rule names exists in the code (grep), the README route resolves, board validates.

- Symbols grepped 2026-10-12: `enqueueGeneration` (generationService.js:542), `activeGenerations` (services/activeGenerations.js), `MpiQueuePanel` Transfers section (MpiQueuePanel.js:37), `state.downloadJobs` / `state.uploadJobs` (state.js:101/103), `MpiProgressBar` (Primitives/), `runSceneOp` (commandExecutor.js:1494). All exist.
- Shipped in `d6f9750fb` (docs/board-only push).

## Existing silent actions found (reported to Fabio, NOT fixed here)

1. Agent/MCP GIF verbs (`gif.cutout`, `gif.make`, `gif.edit`, `gif.to-video`, `sheet.make`), `js/shell/gifJobs.js` `runGifJob`; `cutoutGif` runs BiRefNet/SAM3 on the GPU via `runGifCutoutTrack`, outside the queue. Silent.
2. Gallery right-click Make GIF, `MpiGalleryBlock.js` fetch `/gif/make`. Partial (result appears, nothing during).
3. Gallery Download of 2+ cards, `mediaActions.js` -> IPC `save-files-to-folder` (`main.js`), sync copy loop. Silent, result discarded.
4. Model file drop onto a folder, `MpiFolderDrop.js` -> `/comfy/import-model` multi-GB copy. Partial (end toast only).
5. Describe on the endpoint backend, `describeAction.js` -> `/llm/describe`. Partial (end toast only).
6. Agent `agent.describe` on the endpoint backend, `agentDispatch.js`. Silent.
7. Project card Cleanup assets, `projectUI.js` -> `/project/cleanup-assets`. Partial (end toast only).
