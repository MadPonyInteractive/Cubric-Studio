# MPI-753 validation

## Change

`js/components/Compounds/LandingPages/MpiModelManager/MpiModelManager.js:71`: the second
filter group's label reads `Tier` instead of `Size`. `git diff -U0` shows that one line and
nothing else. `.mpi-model-library__filter-label` sets `text-transform: uppercase`, so it
renders `TIER`, matching `MEDIA`.

## Scope checks

- No test, doc or other string names the label (searched `js/`, `tests/`, `docs/` for
  `filter-label`, `size-filter`, `Size filter`).
- Internal names kept as they are (`#size-filter-slot`, `sizeTier`): they are not
  user-visible, and renaming them is not part of this change.

## Not verified by the agent

The live look. The user's app on `:3000` is off limits; a reload of the Model Library there
shows the change.
