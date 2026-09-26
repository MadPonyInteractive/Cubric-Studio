# MPI-867 checklist

- [x] cardReference replaces cardAttachmentSource (image + video + gif by reference)
- [x] gallery drag payload carries thumbPath
- [x] agent panel drop: card by reference, OS file imported as a card first, no-project toast, stopPropagation
- [x] mediaImportService honours a caller groupId
- [x] agentLoop video line mirrors the image line (groupId, list_cards, thumb url)
- [x] tests rewritten; the todo gate passes (plus agent-card-reference.test.cjs updated for the no-copy landing rule)
- [x] docs/agent-chat.md + docs/gallery.md updated
- [ ] Fabio checks the drops in the app (user-ux)
