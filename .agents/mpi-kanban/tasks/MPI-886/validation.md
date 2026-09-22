# A card dropped on the agent chat should arrive as the CARD, not a copy of its picture

## Where it stands today — read, not inferred

- `routes/agent.js:130` — an image attachment goes through `tools.saveAttachment(name, dataUrl)`,
  which writes a COPY under `APP_USER_DATA/agent/attachments`.
- `routes/agent.js:122-128` — a VIDEO does not: `{ reference: true, mediaType: 'video', itemId }`,
  guarded by `ownedMedia(project.folderPath, att.url)`, nothing copied.
- `agentLoop.mjs:1783` — that video registers as `kind: 'result'` with its `itemId`, "under the
  same ref, and NOT as an attachment".
- `agentLoop.mjs:1788` — an image registers as `kind: 'attachment'`, name only, no `itemId`.
- `agentLoop.mjs:700` — "An attachment has no `itemId`, so no sidecar: it is described live every
  time." The card's stored look is right there and unreachable.
- `agentLoop.mjs:1334` — on `generate`, an attachment is PLACED into the project as a new picture.

Nothing is fixed yet; this card is the gap.
