# MPI-827 Checklist

- [x] `submitFlowGeneration` builds a `placeholderGroup` and passes it in `opts`,
      ALWAYS (not gated on whether a flow overlay is live)
- [x] Same shape `agentDispatch.js` already builds: `id: tempId`, `type` from the
      flow's `mediaType`, `name: 'Generating...'`, `isGenerating: true`, width/height
      from `injectionParams` with a 1024 fallback
- [x] The MPI-306 "no placeholder" comment block is replaced, not left contradicting
      the code
- [x] `_previewPlayer`'s `ownsFrames` note in `MpiBaseFlow.js` no longer claims a
      flow run mounts no gallery placeholder
- [x] Source contract test written (`tests/flow-gallery-placeholder.test.cjs`) and
      PROVEN red on pre-fix code — 5/5 assertions fail against HEAD
- [x] `npm test` and `npm run lint` pass
- [ ] Fabio's app check: run a flow from the AGENT while standing in the Gallery;
      a card appears and its latents paint

Found while implementing, folded in (same premise, same change):

- [x] `previewClipPlayer.js`'s **ownsFrames invariant** documented the old premise
      ("a Flow run deliberately mounts NO gallery placeholder"). Verified the
      invariant still HOLDS — only `MpiGroupHistoryBlock` and `MpiGalleryGrid` set
      `ownsFrames: true`, so a flow run now has exactly ONE owner where it
      previously had none. Comment corrected, no logic change.
- [x] `MpiGalleryGrid.js` carried the same stale claim; corrected.
- [x] `tests/flow-defer-commit.test.cjs` asserted the OLD behaviour
      (`!/placeholderGroup/`). Inverted with the reason written in, not deleted.
