# MPI-1032 checklist

- [x] read_card: each madeFrom input resolves to its own card (itemId + groupId) through the existing sidecar scan (`_sidecarsOf`, one pass), so `look` reads and writes the stored description
- [x] madeFrom rows name the input's groupId (archived cards left out), so the agent can read that card
- [x] A turn queued behind its OWN conversation's running turn opens with a held line saying it was typed before the last reply; a message answering a review card is not held
- [x] Tests: agent-cards (input carries groupId; look read + kept on the input's sidecar) and agent-sessions (held only for the same conversation). Both negative-controlled: fail on HEAD's service, pass on the fix
- [x] docs/agent-chat.md updated (list_cards row + queue paragraph). docs/agent-findings.md NOT touched: it sits at its 200-line cap; the live evidence is in agent-chat.md
- [x] npm test 2725/2727 pass, 0 fail; eslint clean on the changed files
- [ ] CI green on the code commit
- [ ] Live check: next Cosmo look at a card's input reads `look CACHED` in app.log after the first (needs the app restarted on this code)
