# MPI-1239 validation

Bug: a user's adult prompt ("a 25-year-old man ... delicate features without childlike proportions ...")
was refused as `sexual`. `childlike` is a CHILD word (age 10); `NEGATED` read only not/no/never/non
and did not list `childlike`, so "without childlike" and "not childlike" both counted as a minor.

Fix (`js/data/childSafety.js` `NEGATED`): `childlike` joins the negated words; `without` negates a
minor word only, never clothing ("without clothes" still reads as nudity).

Evidence:
- the reporter's full prompt through `checkChildSafety(..., { video: true })`: `sexual` before, `ok` after.
- `node --test tests/child-safety.test.cjs`: 33/33 pass, incl. the new MPI-1239 test both ways
  (negated child words pass; "a childlike figure, nude", "a 12-year-old without clothes",
  "a teen without underwear" and a negation beside a real "a child" still refuse).
- `npm test`: 3506/3509 pass. The one failure is `extra-model-folders.test.cjs`, which lists this
  machine's real model folders (environment leak), unrelated to this change.
- `npx eslint` on both files: clean.
