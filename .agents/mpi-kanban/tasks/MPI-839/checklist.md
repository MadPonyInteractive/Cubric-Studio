# MPI-839 - checklist

- [x] Capture the origin project once at dispatch in `js/services/generationService.js`; stop
      re-reading `state.currentProject` on the completion path (lines 1186, 1331, 1372).
- [x] When the origin project is no longer the open one, register the card server-side through
      `updateProjectJson()` instead of `addGroup` (the renderer only owns the OPEN project's
      `itemGroups`, and `persistGroups` writes the whole array back).
- [x] The in-flight placeholder must not appear in the project the user switched TO.
- [x] Test: a completion whose `state.currentProject` changed mid-run saves to the origin
      folderPath and leaves the open project's `itemGroups` untouched.
- [x] Freeze the project at ENQUEUE too (`config._originProject`): a job PENDING in the Cue
      queue across a project switch froze at dispatch, into whichever project was open by then.
- [x] Live: dispatch a clip, switch project mid-render, confirm the card lands where it was asked.
      FAILED the first time and found the REAL end of this bug: the closed-project write sent the
      IN-MEMORY card, whose `history` holds item OBJECTS, where disk holds item IDS. Accepted by
      the route, then dropped by the reconciler on the next open of that project, which SAVED the
      project without it. One serialiser now (`serializeGroup`), and the route refuses the wrong shape.
