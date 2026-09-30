# MPI-950 Validation

Verify mode: auto. 2026-09-30 (Agent 76).

## Evidence

- `npm test`: 2467 tests, 2465 pass, 0 fail, 2 skipped (the DeepInfra live tests, no key).
- `npm run lint` (`eslint . --max-warnings=0`): exit 0.
- Read: `tests/agent-cards.test.cjs` "a stack is ONE row, its cards are not listed loose, and it
  reads as its members" and "list_cards registers a stack as a set the fan-out expands".
- Open stack: `tests/agent-stacks.test.cjs` "an open stack sends the member on screen, and the
  stack around it"; `tests/agent-loop.test.cjs` "an open stack names itself, its card on screen,
  and the way to all of them".
- Results: `tests/agent-loop.test.cjs` "a fan-out names ONE result stack on every card, and its
  note names the stack"; `tests/agent-stacks.test.cjs` "an agent fan-out stacks its NEW cards
  only: never an edit, a sound, or a closed project".
- Budget: tool schemas 18,412 bytes. The list_cards stack clause (+90) was paid for by cutting how
  it reads the project (-48); TOOLS_BUDGET 18,370 -> 18,412 (measured). System prompt 10,419 of 10,460.
  `docs/agent-chat.md` now carries Fabio's remove-before-you-add rule.

Not run: a live agent turn against the app. Fabio can eye it after close: open a project with a
stack, ask Cosmo what is in it; open the stack and say "this one"; ask it to turn a stack of
pictures into clips (the clips land as one new stack).
