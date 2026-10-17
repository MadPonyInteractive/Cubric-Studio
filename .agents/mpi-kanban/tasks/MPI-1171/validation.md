# MPI-1171 validation

- `node --test tests/child-safety.test.cjs`: 32/32 pass, incl. the new test (a `drawn` item is not looked at, an upload is; "a beautiful lady ... wearing lingerie" passes the words, "a girl ... 12 years old ... lingerie" refuses).
- Shipped in 5743d8b0f; master CI green on 77149de3e and 8b4eeaadd.
- Live (Fabio, 2026-10-17): the same Scribble run, "wearing lingerie" over a stick figure on the blank canvas, was refused twice before (`[childSafety] YES to "Does this picture show a person who is, ..."`) and went through after reload.
