# MPI-792 - Local ComfyUI install looks frozen

## Report (user, 2026-09-17)

Installing the local ComfyUI engine "kind of stops and doesn't give useful feedback". The
blinking progress sweep is not enough; many parts of the install look stuck, users close the
app thinking it is broken, reopen it, and mess up the install. Ask: keep giving feedback
through the WHOLE install - text that changes, bar colours per phase, a spinner in the parts
with no numbers.

## Why it goes quiet (measured, not guessed)

1. **Before the first byte.** `_runEngineDownload` HEADs every missing UW dep one at a time
   (`getUniversalWorkflowDepsTotalSize`, 5 s timeout each) and only LOGS the total. Nothing is
   broadcast meanwhile; on a slow or filtered network that is minutes on "Preparing download...".
   The number feeds nothing.
2. **Unpacking (Windows).** node-7z without `$progress` delivers per-file `data` events in
   bursts as 7za flushes stdout (probe: max gap 1.2 s on a 646 MB archive; a multi-GB DLL in
   the real portable holds the label still far longer). With `$progress: true` a percent tick
   arrives every <= 205 ms.
3. **After unpacking.** The subtitle keeps the last "Extracting: <file>" while the install
   waits on the parallel UW downloads. Stale text over a moving bar.
4. **uv path (Linux/macOS).** A pip step can print one line and then nothing for 30+ minutes
   (build-experience-log.md, "Performance reality"). The UI only changes on an output line.
5. **Labels.** uv stage ids (`uv-venv`, `comfy-install`) all show as "Extracting: ...";
   `engine:patching` shows the raw word "patching"; "Installing custom node requirements"
   has not run pip since MPI-413.
6. **First engine start.** The curated pip pass shows a static "can take several minutes".

## Shape of the fix

Client (`MpiEngineInstall`, `MpiStartingComfy`, new `js/utils/elapsedTicker.js`):
- step tracker Download / Install / Finish, monotonic
- the bar only when a number is honest (download bytes, unpack percent); a spinner otherwise
- bar colour follows what it measures: bytes = heat, unpack = frost, finish = ok
- download line gains an ETA; uv stage ids get real labels
- an elapsed clock that always ticks, plus rotating "still working" hints after 15 s of quiet
- a permanent "keep Cubric open" line during the install

Server (after MPI-791 commits - it holds `routes/engine.js` / `downloadManager.js` / `shared.js`):
- drop the unused HEAD pre-sizing
- 7z `$progress` -> `engine:extracting { percent }`, throttled
- broadcast "downloading remaining components" after unpack
- per-node counter for the custom node step, human label for patching
