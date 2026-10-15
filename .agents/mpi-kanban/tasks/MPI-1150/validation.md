# MPI-1150 validation

**Ask (Fabio, live, 2026-10-15):** Video Edit, Change the background on a monkey riding a horse:
"Which person" does not fit; "Which characters" would be better.

**Change:** `js/data/flowsRegistry.js` `Input_Who` label `Which person` -> `Which characters`; its info
line now names a person, an animal or a cartoon ("the monkey and the horse"). The `{who}` default
(`the person`), the placeholder and the graph are untouched. Doc quote updated in
`docs/playbooks/add-flow/ui/carousel-frame/fields.md`.

**Evidence:** `node --check js/data/flowsRegistry.js` clean; `node --test` over every test that loads
`flowsRegistry` -> 107 pass, 0 fail. Shows in the app on its next start.
