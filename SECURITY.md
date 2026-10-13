# Security Policy

## Supported Versions

Cubric Studio (formerly Cubric Vision) ships one release line from `master`.
Security fixes land in the next release; only the latest release on
[GitHub Releases](https://github.com/MadPonyInteractive/Cubric-Studio/releases)
is supported.

## Reporting A Vulnerability

Report it privately through GitHub:
[Report a vulnerability](https://github.com/MadPonyInteractive/Cubric-Studio/security/advisories/new).
If you cannot use GitHub, email contact@madponyinteractive.com.

Do not open a public issue with exploit details, private tokens, credentials,
or user data.

## How Your API Keys Are Protected

The app holds keys for DeepInfra, RunPod and any AI provider you connect
(OpenRouter, OpenAI or a custom endpoint). The code is `main/secretsStore.js`.

- **Encrypted at rest**, with the operating system's secure storage (Electron
  `safeStorage`: DPAPI on Windows, the Keychain on macOS, the keyring on Linux).
  On a Linux machine with no keyring, a weaker AES-256-GCM fallback is used.
  Keys are never stored as plain text.
- **Write-only from the app's screens.** The interface can save, test or clear
  a key; no channel reads one back, so a saved key is never shown again. Outside
  agents connected over MCP cannot read keys either.
- **Never in your files.** Keys are not written to project files, browser
  storage, logs or bug reports, and logs and bug reports are scrubbed of tokens
  (`routes/secretRedaction.js`) as a second guard.
- **Sent only to their own service.** Each key goes only to the provider it
  belongs to. There is no Cubric account, server or sync that holds keys.

Every time the app goes online is listed on the
[privacy page](https://cubric.studio/privacy/). There is no analytics or
telemetry.

## Verifying A Download

Download only from
[GitHub Releases](https://github.com/MadPonyInteractive/Cubric-Studio/releases).
Each file's SHA-256 is shown next to it on the release page. The builds are not
code-signed yet, so your operating system may warn on first launch.

## Secrets And Local Files

Never commit API tokens, Hugging Face tokens, local model-upload scripts,
private keys, `.env` values, or user project data. The repo history was cleaned
before public release; keep it clean.

## Portable Artifacts

Portable artifacts contain readable source and dependencies. Treat artifact
distribution as a release-channel decision, not a source-code secrecy boundary.
