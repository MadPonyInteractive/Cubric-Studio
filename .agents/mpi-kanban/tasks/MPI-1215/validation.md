# Validation

- `node --test tests/hf-token.test.cjs`: 6/6. Real secretsStore (AES-GCM fallback) + its fork bridge + routes/forkBridge + the /licences/verify handler, HF faked: no renderer get channel; token not plaintext on disk; nothing saved + nothing typed = 400 no-token; a failing typed token is not saved; a passing one is saved and the next verify sends the saved token (`usedSaved: true`); a dead saved token answers bad-token + usedSaved, and a pasted one that passes replaces it.
- `npm test`: 3479 pass, 0 fail. `npm run lint`: clean.
- Isolated Electron run (own userData, own Documents, own port; never :3000), Klein 9B gate:
  - nothing saved: token field shown, copy says a passing token is saved.
  - token saved over `secrets:set-hf-token`: field hidden, copy says Verify uses the saved token, "Verify and install" enabled with nothing typed.
  - Verify with the (fake) saved token: real Hugging Face 401, field back, message "Your saved token was rejected... paste a different token above; it replaces the saved one."
- Isolated run, Settings > External Connections: "Saved, encrypted..." + Clear; Clear leaves `has-hf-token` false and the row reads "None saved".
- Website `privacy/index.html` said "The token is not saved": rewritten in the website repo, committed locally, NOT pushed (public; ships with the app release).
