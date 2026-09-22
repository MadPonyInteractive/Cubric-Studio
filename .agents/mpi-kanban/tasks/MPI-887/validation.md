# MPI-887 Validation

## What shipped

The Choose-media overlay gained a second destination. An **Add to history** toggle in its
head, opt-in per opener, turns a pick into an **entry on the open card's history** instead
of a reference chip in the Prompt Box. It is a toggleable `MpiButton` shaped like the
FILTER button beside it: it shipped as an `MpiCheckbox` switch first and Fabio rejected
that on sight (2026-09-22) - a form switch read as a settings row dropped into a row of
picker controls. Armed, the icon takes the Vision accent, the same way FILTER lights when
a filter is on. That is the only route by which an image living in a different
gallery card can reach **Composite**, whose slot takes an entry already in the open card's
history and nothing else (`MpiToolOptionsComposite.js`).

Both of the overlay's sources honour it: a picked card, and a file imported from disk
through its upload card — which is the "outside image" of the card title.

## Two decisions worth keeping

**The picked media is COPIED, not referenced.** Deleting a history entry deletes its file
on disk (`MpiGroupHistoryBlock`'s delete handler), so two cards pointing at one path would
mean deleting either one guts the other. `POST /project-media/:id/copy-item` clones the
sidecar with the media, so the entry keeps the prompt, seed and model that made the
picture. An IMPORT is not copied: `uploadMediaFile` has already written the file and its
sidecar into this project and nothing else owns them.

**MPI-377 is not reopened.** That card asked for a dropped file to become a history entry
and was rejected — "an imported photo is not a generation" — shipping as the Place slot
instead. Nothing here changes what a drop does. This is a deliberate, opt-in gesture with
a switch the user flicks, and it defaults off.

## Evidence

    node --test tests/project-copy-item.test.cjs
      3 pass, 0 fail
      - copy lands its own media + sidecar, keeps the prompt, source untouched
      - 404 on missing source media, 400 with no item
      - add-from-cards still builds a card per copy after the extraction

    npx playwright test tests/desktop/media-picker-to-history.spec.js \
        --config=playwright.desktop.config.js --output=<short dir>
      4 passed (23.1s)
      - the Add to history toggle turns a pick into a history entry on the open card, as a copy
        (appended AND selected; survives to project.json; its own file on disk;
         source card's file and history untouched; sidecar prompt carried over)
      - with the toggle off the pick is still a reference chip, no entry added
      - an imported file lands as an entry too, and makes NO second gallery card
      - an opener with one destination gets no toggle

    npm test
      1768 tests, 1766 pass, 0 fail (1 skipped, 1 todo — tests/agent-video-attachment.test.cjs,
      a pre-existing MPI-867 todo, untouched by this card)

    npx playwright test tests/desktop/media-picker-cards.spec.js \
        tests/desktop/media-import-outside-gallery.spec.js
      6 passed (48.6s) — the two suites nearest this change, both green

    npx eslint <the five touched source files> --max-warnings=0
      clean

## Fabio's own run

2026-09-22, in the app: **"The functionality worked, by the way."** The only change he
asked for was the control - the switch became the toggle described above, and the label
became his phrasing, "Add to history". Still open: his look at the replacement.

## What this unblocks

The composite half of the agent's result-review rule (MPI-877's neighbour): the agent can
now tell a user how to reach Composite for a cross-card fix, because the user can actually
perform it. The agent still cannot use Composite itself (`agentLoop.mjs`), which is
unchanged and deliberate.

## Master went red on this card's own commit, and the fix

CI run 35720792152, shard 4: all three app-driving tests in
`tests/desktop/media-picker-to-history.spec.js` died on
`TypeError: Cannot read properties of null (reading 'click')` at the `+` card lookup.

**Cause, not symptom.** The `+` card exists only when the PromptBox MOUNTS, which needs an
installed prompt-capable model. Every dev box has weights; the runner has none, so the boot
sync writes every `installed` flag false and the box never mounts. The evidence block above is
honest about what it ran - it is just that a green local desktop run cannot see this class of
failure at all. That is `docs/red-master.md` cause 1 and `docs/testing-desktop-specs.md`
trap 5, both of which I should have read before writing a desktop spec, and did not.

**Fix:** the documented pair, same shape as `focus-mode.spec.js` - `pinOneModelInstalled()`
pins one flat model usable through a getter the boot sync cannot overwrite, and
`provokeNoWeights()` answers `/comfy/models/check` with every model absent and runs the real
sync, so the spec now reproduces the runner HERE instead of only in CI.

**Proven both ways.** With the pin commented out the spec fails locally with CI's exact error
at the same line; with it restored, 4/4 green against the provoked weightless condition - a
stronger result than the original run, which passed only because this box has weights.
