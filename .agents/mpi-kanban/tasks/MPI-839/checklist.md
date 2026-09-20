# MPI-839 - checklist

- [ ] Capture the origin project once at dispatch in `js/services/generationService.js`; stop
      re-reading `state.currentProject` on the completion path (lines 1186, 1331, 1372).
- [ ] When the origin project is no longer the open one, register the card server-side through
      `updateProjectJson()` instead of `addGroup` (the renderer only owns the OPEN project's
      `itemGroups`, and `persistGroups` writes the whole array back).
- [ ] The in-flight placeholder must not appear in the project the user switched TO.
- [ ] Test: a completion whose `state.currentProject` changed mid-run saves to the origin
      folderPath and leaves the open project's `itemGroups` untouched.
- [ ] Live: dispatch a clip, switch project mid-render, confirm the card lands where it was asked.
