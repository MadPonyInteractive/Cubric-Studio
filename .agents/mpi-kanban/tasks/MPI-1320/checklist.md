# MPI-1320 checklist

- [x] Gallery: Q / status bar / flash open the Cue as a docked right panel (not the slide-over)
- [x] Dock starts under the topbar (52px, same as the agent panel) and ends at the status bar
- [x] Dock pushes the gallery, prompt box and controls; topbar controls stay uncovered
- [x] Dock stays open across gallery visits; hidden in history workspaces and focus mode
- [x] History / Scene / 360 / landing keep the slide-over; over a Flow the gallery falls back to it (MPI-822)
- [x] Fabio follow-up: the accent rule before "N ASSETS" is gone; a queue toggle sits after the info toggle
- [x] lint + `npm test` green (3790 pass); desktop specs flow-queue-hotkey (now asserts the dock geometry), queue-flash, scene-queue-hotkey pass
- [x] Fabio: look-and-feel pass in the real app ("Looks freaking fabulastic", 2026-10-28)
