# MPI-935 - Model downloads trust the Windows certificate store

## Problem

Antivirus suites that scan HTTPS (Kaspersky, ESET, Avast, Bitdefender) re-sign every TLS
connection with their own root CA, which they install into the **Windows** certificate store.
Browsers trust it. Our downloads do not:

- `main.js` forks `server.js` (Electron's Node, 24.14.0 on Electron 41).
- `routes/downloadManager.js` downloads through `node-downloader-helper`, which uses Node
  `https` - and Node trusts only its **bundled** Mozilla CA list.

So on those machines every model download dies with `SELF_SIGNED_CERT_IN_CHAIN` while the rest
of the app (and the user's browser) works. MPI-427 only *names* this error
(`_TRANSPORT_ERROR_PATTERNS`, `downloadManager.js` ~1338); it does not fix it.

A competitor shipped exactly this fix on 2026-09-16 ("downloads now use the same connection
stack as your browser, which trusts what Windows trusts"), found on their own machine.

## Measured 2026-09-26

`ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe`:
`tls.getCACertificates` and `tls.setDefaultCACertificates` are both functions;
`getCACertificates('system')` = 123 certs, `'bundled'` = 144. The `--use-system-ca` flag is
accepted.

## Fix (root cause: which CA list the server trusts)

At `server.js` startup, before any request, trust bundled + system:

```js
const tls = require('tls');
tls.setDefaultCACertificates([...tls.getCACertificates('bundled'), ...tls.getCACertificates('system')]);
```

(or fork with `execArgv: ['--use-system-ca']` in `main.js` - pick one, not both). This covers
EVERY outbound call in the server process (downloads, HEAD size probes, HF/R2, DeepInfra,
GitHub engine archive), not just the model downloader - fix the primitive, not a call site.

Keep MPI-427's classifier: a genuinely bad certificate must still fail, just with the right
message.

## Verify

- Unit: after startup, `https.get` against a server whose CA exists only in a test
  "system" list succeeds (or: assert the default CA set length = bundled + system).
- Live, if a machine with one of those AVs is available: model download succeeds with HTTPS
  scanning ON. Without one: a local proxy (mitmproxy) with its CA installed into the Windows
  user store reproduces the failure before the fix and passes after.
- Release note line for the next build.
