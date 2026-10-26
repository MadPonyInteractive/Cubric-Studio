# MPI-1300 — Phone companion

Agreed with Fabio 2026-10-26. Testers asked for phone control; the photographer tester already
drives the desktop through a remote-desktop app while out shooting, to edit a photo or clip he just
took and hand the client a result on the spot.

**Reverses** `docs/redesign/PRODUCT.md` § Out of scope "Mobile or web mirror. Desktop only." — that
line needs Fabio's word before it is edited.

## Shape (decided)

- **No app store, no hosting.** The desktop app serves a phone page; the user scans a QR code once
  and keeps it as a home-screen icon. Each user's PC hosts its own.
- **Reach from anywhere = Tailscale**, installed by the user (GUI, no terminal). Cubric runs no relay.
  A hosted relay (push notifications, no extra install) is an OPEN question, gated like the cloud tier.
- **Cosmo is the phone's main surface.** Workspaces (masking, paint, video edit, storyboard) stay on
  the desktop for v1; masking is the first candidate for a phone layout later.

## Screens

| Screen | New or reused |
|---|---|
| Chat with Cosmo — camera/upload button; a live card per generation showing latents + Stop | new |
| Gallery — project grid, full-screen viewer, Save / Share / Send to Cosmo, project switch | new |
| Queue — the existing `MpiQueuePanel` (no Electron calls), rows get small live latents | reused |
| Remote / RunPod slide-over — `MpiRemote`, `MpiRunpodSettings` (no Electron calls) | reused |
| Settings slide-over — GATED: keys, folder pickers, engine/model installs read "change this on your PC" | reused |
| Pairing — QR code on the desktop, paired-phones list with Remove | new |

## Desktop-side work

1. "Phone access" switch, off by default; a second listener only while on. `server.js` binds `127.0.0.1` today.
2. Per-phone token from QR pairing; revocable.
3. Allowlist of phone routes (chat, upload, cards, queue/cancel, remote pod, gated settings). The
   connector's file-path and install routes are NOT exposed. Hiding a setting and refusing its route is ONE list.
4. **Live latents to the phone:** frames reach only the desktop renderer (`docs/preview-bus.md`), and
   ComfyUI sends them only to the submitting client — the renderer forwards `preview:frame` through the server.
5. **Big uploads:** `POST /agent/message` attachments are dataUrls in JSON; a concert clip needs a real upload route.
6. **Attachments land as cards on arrival** — today one is copied into the project only when a generate uses it.

## Known limits

- The desktop app must be open on the PC.
- Cosmo needs the user's configured agent model/key; the phone cannot set keys (`secretsClient.js` is Electron-only — kept that way on purpose).
- Install-to-home-screen as a real PWA and push notifications need HTTPS; v1 ships without notifications.

## Design — APPROVED 100% (Fabio, 2026-10-26)

`research/mockups/phone.html` (open it, it loads the repo's fonts/icons/images by relative path;
`phone.png` is the screenshot). Built from `phone.tpl.html` by `build.mjs` (fills `{{i:name}}` from
`js/utils/icons.js`). The real build uses the app's components (`ComponentFactory`, BEM), not this CSS.

## Rollout (Fabio, 2026-10-26)

Built slowly across normal releases, **hidden behind a dev gate** the whole way (like a dev-gated
Flow): the Phone access section in the desktop app's Settings does not show for users until every
phase lands. Then it is announced and shipped in one go. No partial phone feature reaches a user.

## Also asked (2026-10-26)

- **Test as we build in the PC browser** with DevTools device emulation: the phone page must open at
  `http://127.0.0.1:<isolated port>/<phone route>` on the desktop too, not only over the network listener.
- **A playbook for agents** working on the phone companion (where the phone routes live, the allowlist,
  how to test with DevTools emulation) — `docs/playbooks/`.
