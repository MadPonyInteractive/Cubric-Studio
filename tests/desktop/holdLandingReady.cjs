// Main-process preload for shell-window-no-late-resize.spec.js (MPI-1230), loaded with
// `electron -r` so it is in place BEFORE main.js runs.
//
// It holds main's `shell:landing-ready` listener for 3s, provoking the late reveal a CI
// runner's software decoder produces. It used to be installed by an `app.evaluate` right
// after `electron.launch`, but launch() returns while main.js is still in its synchronous
// top-level load: the inspector answers that evaluate from inside it, the result promise
// it awaits is only weakly held, and a GC during the load collects it - V8 replies
// "Promise was collected", which Playwright reports as "Execution context was destroyed"
// (MPI-1351). A preload never races main.js at all.
//
// createWindow() registers its listener synchronously after `new BrowserWindow`, so it is
// there one tick after creation.

const { app } = require('electron');

globalThis.__heldLandingReady = 0;
app.on('browser-window-created', (_e, win) => setImmediate(() => {
  const ipc = win.webContents.ipc;
  const listeners = ipc.listeners('shell:landing-ready');
  if (!listeners.length) return;
  globalThis.__heldLandingReady += listeners.length;
  ipc.removeAllListeners('shell:landing-ready');
  ipc.once('shell:landing-ready', (...args) => setTimeout(() => listeners.forEach(l => l(...args)), 3000));
}));
