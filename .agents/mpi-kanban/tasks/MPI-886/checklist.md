# A card dropped on the agent chat should arrive as the CARD, not a copy of its picture

- [ ] `MpiAgentChat`'s drop sends a card as a reference (`reference: true`, `itemId`,
      `groupId`) instead of a data URL. An OS file drop keeps staging as it does now.
- [ ] `routes/agent.js` honours it for images the way it already does for video —
      `ownedMedia` guard included, since the loop ships what it registers to the engine.
- [ ] `agentLoop` registers it as a card ref, so `_lookOnce` hits the stored look and
      `generate` does not re-place it as a new picture.
- [ ] The chat line tells the model it holds a CARD, and what its selected entry is.
- [ ] An edit of a dragged card lands in that card's history with no mask painted —
      MPI-877 routes on the mask alone today.
- [ ] `list_cards` returning the same card afterwards must not mint a second ref.
- [ ] Fabio drags a card in and asks for an edit.
