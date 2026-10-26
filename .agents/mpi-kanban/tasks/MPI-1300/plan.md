# MPI-1300 Plan — Phone companion

Build the approved phone page (`research/mockups/phone.html`) inside the app, phase by phase, with
the app's real components (`ComponentFactory`, BEM, tokens from `styles/01_base.css`, icons from
`js/utils/icons.js`) — never the mockup CSS. Everything stays behind the dev gate
(`APP_CONFIG.dev_mode`, the same switch `devOnly` Flows use) until the last phase lands; no partial
phone feature reaches a user (brief § Rollout).

## Current State

2026-10-26: Phase 1 committed (6137c0e29), eye-tested. Phase 2 BUILT, uncommitted, waiting on
Fabio's eye-test (incl. one real Cosmo turn: the live card, Stop and the result card could not be
driven without billing his key). Next action after his "1": tick checklist, `mpi-handoff` or Phase 3.
Gotchas: run every `playwright-cli` call from one working directory; an isolated instance shares
the real projects folder and the running engine, so browse read-only.

Facts the plan rests on (checked 2026-10-26):
- `server.js` serves the repo root with `express.static(__dirname)` behind `localOnly(port)`
  (`routes/localOnly.js`): a typed URL in a PC browser on `127.0.0.1:<port>` passes (Sec-Fetch-Site
  `none`, then `same-origin`). So a phone page is reachable from the PC browser with no listener work.
- The desktop renderer enters at `index.html` → `js/init.js`. A phone page needs its OWN entry so it
  never boots the desktop shell (`js/shell.js` parks boot behind the engine-install modal).
- Reusable as-is (no Electron calls): `MpiQueuePanel`, `MpiRemote`, `MpiRunpodSettings`,
  `MpiLlmSettings`; `MpiSlideOver` width is `min(460px, 100vw - 48px)`.
- Electron-only, never on the phone: `secretsClient.js`, `maskTempStore.js`.
- Live latents reach only the desktop renderer (`docs/preview-bus.md`).
- Test on `npm run app:isolated` (own profile + port), never `:3000`.

## Phase 1: Phone page on the PC browser

Goal: Fabio opens `http://127.0.0.1:<isolated port>/phone` in his PC browser, turns on DevTools
device emulation, and sees the phone shell from the mockup — top bar (mascot, project name ▾, pod
pill, settings cog), the Cosmo / Gallery / Queue tab bar, and switching between three screens.

- [x] Find the import boundary. Clean in a plain tab: factory, `dom.js`, `events.js`, `state.js`,
  `storage.js`, `clientLogger.js`, `icons.js`, `MpiButton`. The renderer reaches Electron through
  `window.require` (nodeIntegration, no preload), mostly guarded; never import `projectService`,
  `secretsClient`, `maskTempStore`, `js/shell/*` on the phone.
- [x] `phone.html` (loads `styles/01_base.css` only) + `js/phone/init.js`.
- [x] `GET /phone` in `routes/phone.js`, gated by new `routes/devMode.js` `devMode()`; registered
  BEFORE `express.static` so `/phone.html` is gated too. `tests/phone-route.test.cjs` (3 tests;
  proven to bite: static-first order serves 200).
- [x] `MpiPhoneShell` Block: top bar (logo, project `MpiButton`, pod pill `MpiButton`, settings),
  screen slot with per-tab placeholder text, three tab `MpiButton`s with the heat underline.
  Project name from `/connector/current-project`, pod from `/remote/mode`. preloadStyles + types.js.
- [x] Safe-area + viewport: `viewport-fit=cover`, `env(safe-area-inset-*)`, `100dvh`; project and
  settings 50px, tabs 66px; the pod pill is 34px (the mockup's is 32 — becomes a tap target in Phase 3).
- [x] Playbook started: `docs/playbooks/phone-companion/README.md` + index row.

Ownership: `phone.html`, `js/phone/**`, `routes/phone.js`, `server.js` (one `app.use` line),
`js/components/Blocks/MpiPhoneShell/**`, component registration files the playbook
(`.claude/rules/components.md`) names for a new Block.

**Verify:** `npm test` + `npm run lint` green; a unit test that `/phone` is 404 with `dev_mode`
off and 200 with it on; on `npm run app:isolated`, `playwright-cli` at 390×844 opens `/phone`,
screenshots each tab, and the console shows no errors. Then Fabio's eye-test in his own browser.

## Phase 2: Chat and Gallery screens

- [x] Cosmo screen (`MpiPhoneChat`) over `/agent/*` + the stream: messages, composer, photo button
  (dataUrl), install/batch/spend Yes-No cards, live card (sweep + Stop via new `agent:job`).
- [x] Result card actions: Save, Share (only when `navigator.share` exists), Again.
- [x] Gallery (`MpiPhoneGallery`, `GET /phone/cards`, server-side kind filter, Load more), project
  switch / create sheet in the shell, Viewer (`MpiPhoneViewer`: swipe, versions, Save / Share / To Cosmo).
- [x] `GET /phone/agent-prefs` relay (`agent.prefs`); tests in `tests/phone-route.test.cjs` (6).
- [ ] Fabio's eye-test, incl. one real Cosmo turn (bills his LLM key).

**Verify:** unit tests for any new route; isolated app + DevTools emulation: send a prompt, see the
card land in both the phone gallery and the desktop gallery. Eye-test.

## Phase 3: Queue, Remote and Settings slide-overs

- [ ] Queue tab mounts `MpiQueuePanel` at phone width; Stop buttons ≥ 44px.
- [ ] Pod pill opens `MpiRemote` / `MpiRunpodSettings` in `MpiSlideOver`; cog opens Settings.
- [ ] ONE allowlist module (`routes/phoneAllowlist.js`) — the single source for "hidden on the phone"
  AND "refused from the phone". Gated rows (API keys, model folders, installs) read "On your PC".

**Verify:** a test that every gated setting's route is in the deny side of the list; eye-test.

## Phase 4: Live latents on the phone

- [ ] The desktop renderer forwards `preview:frame` (throttled, small JPEG/WebP) through the server;
  the phone subscribes on its SSE. Live card + queue rows show step N/M + latents.

**Verify:** isolated app on a real generation (local engine or a pod — a pod costs money, ask
first): latents move on the phone page; Stop at step 3 stops the job.

## Phase 5: Uploads land as cards

- [ ] Real upload route (streamed multipart, video-sized) replacing dataUrl attachments from the phone.
- [ ] An upload becomes a project card on arrival, before any generate uses it.

**Verify:** unit test for the route; a 200 MB clip uploads from the phone page and appears in the
desktop gallery at once.

## Phase 6: Phone access, pairing and the network listener

- [ ] Desktop Settings "Phone access" section (dev-gated): switch off by default, QR + one-time code
  with expiry, paired-phones list with Remove (mockup screen 08).
- [ ] Second listener (LAN / Tailscale interface) only while the switch is on; per-phone revocable
  tokens; the listener answers ONLY the Phase 3 allowlist. `localOnly` keeps guarding `:port`.
- [ ] Privacy policy check (a new outbound path?) and `docs/redesign/PRODUCT.md` § Out of scope —
  edit only with Fabio's word.

**Verify:** tests for token issue / revoke / refused-route; a real phone over Tailscale. Eye-test.

## Phase 7: Docs, playbook, release gate

- [ ] `docs/phone-companion.md` (subsystem doc, ≤200 lines) + entry in `docs/README.md`.
- [ ] Agent playbook `docs/playbooks/phone-companion/README.md`: where phone routes live, the
  allowlist, the dev gate, testing with DevTools emulation on the isolated port (Fabio asked).
  Started in Phase 1 and grown each phase.
- [ ] Lift the dev gate only when every phase has landed — Fabio's call, announced as one release.

## Plan Drift

- 2026-10-26: the pod pill shows Pod/Local only. The desktop has no live $/h readout to reuse;
  the price comes with the Remote panel in Phase 3.
- 2026-10-26: the pod pill uses `MpiButton` `secondary` (filled) — the mockup's hairline pill
  would mean redrawing a button's chrome in a consumer. Marked `REDESIGN-DEVIATION`.
- 2026-10-26: fixed `MpiButton` `labelPosition: 'left'` (no other user) — it rendered the icon
  first because the template AND the CSS both reversed the order. `'top'` has the same double
  flip but every ratio picker is drawn on it; left alone (brief § Noticed).
- 2026-10-26 (P2): the phone could not read the agent's connection/model/mode (desktop localStorage)
  → `agent.prefs` relay + `GET /phone/agent-prefs`. Stop had no handle (`agent:tool` ids are not
  requestIds) → `AgentLoop` emits `agent:job { toolCallId }` (docs/agent-chat.md SSE table).
- 2026-10-26 (P2): the PC's CHOICE cards (lyrics, voice, model, tiles) say "answer on your PC" on the
  phone — sharing MpiAgentChat's `CHOICE_CARDS` table is Phase 3 work. REDESIGN-DEVIATION marked.
- 2026-10-26 (P2): stacks show as their member cards (the phone has no stack view); the viewer's
  To Cosmo is a filled primary, not the mockup's cream label (consumer may not recolour a button).
- 2026-10-26 (P2): a message sent from the phone shows on the PC's chat only after it reloads
  (the server sends no `agent:user` for a sender's own turn). Not fixed; note for Phase 3.
- 2026-10-26: `electron-builder.yml` ships `**/*`, so `phone.html` reaches builds — the 404 gate
  is what keeps it from users. No packaging step needed in Phase 7.

## Verification

**Verify mode:** user-ux — every phase ends with Fabio's look in his browser (Phase 6: on a phone).

## Preservation Notes

- The playbook (Phase 7) is grown phase by phase; a phase is not done until its testing steps are in it.
- `docs/redesign/PRODUCT.md` "Out of scope: Mobile or web mirror" contradicts this card — needs Fabio's word.
