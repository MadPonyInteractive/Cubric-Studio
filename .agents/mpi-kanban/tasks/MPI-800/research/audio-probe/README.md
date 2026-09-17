# Is the app actually emitting sound? (2026-09-17)

Fabio reported silence in the gallery — his clips and mine, nothing playing sound. These
three scripts answer it without ears, and the answer was **the app is fine**.

| script | what it proves |
|---|---|
| `list-audio-sessions.ps1` | Every Windows render session per device: owning process, state (1 = active), live peak. Core Audio COM through `Add-Type`, no modules. Run it WHILE something plays — an idle session reads `state=0 peak=0` and looks identical to a broken one. |
| `electron-audio-probe.mjs` | Inside the Electron renderer over CDP: element `muted`/`volume`, `webkitAudioDecodedByteCount`, an AudioContext analyser peak, and `enumerateDevices()`. `app:isolated` has no CDP port, so launch Electron directly with `--remote-debugging-port` (and `env -u ELECTRON_RUN_AS_NODE`, or main.js dies on `app.getPath`). |
| `play-hold.mjs` | Loops a clip in that renderer for N seconds so the session is ACTIVE while the PowerShell sampler runs. |

Findings, in the order they killed a hypothesis:

1. The files carry audio. `volumedetect` prints `n_samples: 0` on filter INIT and the real
   count at the END — read the last one, or every clip looks silent.
2. Fabio heard the same file over a plain `python -m http.server` in another browser, so the
   file, the AAC decoder and the default output device are all fine.
3. In Electron: audio decodes, nothing is muted, the AudioContext runs, analyser peak ~0.26.
4. `list-audio-sessions.ps1` while playing: the app's session on **SteelSeries Sonar - Gaming**
   is `state=1 peak=0.2598`. Real audio leaves the app into the Windows endpoint.

So the loss is inside SteelSeries Sonar, past the endpoint. Two facts that matter for the
next look: the app never calls `setSinkId`, so it always follows the Windows default (here the
Sonar Gaming virtual device, 96 kHz, 8 channels); and a DEV build's process is `electron`, not
`CubricStudio.exe`, which is why Sonar never lists it under the product name.
