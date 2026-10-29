/**
 * floatLatentBridge.js — MPI-270
 *
 * Renderer half of the OS floating latent window. This document owns the
 * MPI-269 preview:frame bus; the float window is a separate BrowserWindow with
 * its own empty Events bus, so we forward frames to it over IPC. blob: URLs are
 * per-document and won't resolve there — we send each frame's JPEG bytes.
 *
 * Show gate: app minimized AND state.floatLatentWindow AND ≥1 running gen. Main
 * process owns minimize detection and the window lifecycle; this bridge answers
 * main's "should I show?" query and streams tiles/frames while it's open.
 *
 * Desktop-only: in browser dev mode there is no ipcRenderer, so every path
 * no-ops cleanly.
 */

import { Events } from '../events.js';
import { state } from '../state.js';
import { activeGenerations } from '../services/activeGenerations.js';
import { generationStore } from '../services/generationStore.js';
import { getModelById } from '../data/modelRegistry.js';
import { resolveMediaUrl } from '../utils/mediaActions.js';
import { clientLogger } from '../services/clientLogger.js';

let ipcRenderer = null;
try {
  if (typeof window.require === 'function') {
    ipcRenderer = window.require('electron').ipcRenderer;
  }
} catch { /* browser mode */ }

/** True while the float window is open (main told us to show). */
let windowOpen = false;

// WHERE THE LOOP RUNS (MPI-1345). The clip player (previewClipPlayer, MPI-571) runs
// in the FLOAT WINDOW, not here. It used to run here and forward a throttled sample
// of the loop, but this window is up exactly while the app is MINIMISED, and a
// minimised window is a hidden page: measured on this Electron, `visibilityState`
// goes 'hidden' and a 41ms interval stretches to ~1s gaps at once, then to about one
// tick a minute after 5 minutes (Chromium's intensive throttling). The tile showed one
// frame per sampler step while the gallery card — the same player, in a visible page —
// looped at the clip's rate. So the bridge has no timer: it forwards every frame ONCE,
// as it arrives, and the float window paces and loops it.
//
// Bytes, not data URLs: no base64 inflation, and each frame crosses the boundary once
// rather than once per loop pass. The bytes are read off the blob immediately, while
// the URL is certainly live — this bridge does not own these frames (the gallery card,
// History viewer or nothing does; see docs/preview-bus.md § Blob ownership).
const _sendChain = new Map(); // lane -> Promise, keeps one lane's frames in arrival order

// The lane's current clip window as bus URLs (not bytes), kept even while the window
// is closed, so a window opened mid-step starts on the moving clip instead of one
// still frame until the next burst. Strings only; URLs a retainer has freed since are
// skipped when read.
const _recent = new Map();    // lane -> string[]

// The tile footer's progress fill (MPI-1296). Same id-tagged tool:progress the
// status bar reads, kept per gen even while the window is closed so a tile opened
// mid-run starts at the real percent, not at zero.
const _progress = new Map();   // genId -> whole percent

function sendProgress(genId) {
  if (!windowOpen || !_progress.has(genId)) return;
  const lane = laneFor(genId);
  if (!lane) return; // a cloud/tool job has no tile
  ipcRenderer.send('float-latent:progress', {
    lane, genId, value: _progress.get(genId) / 100,
  });
}

/** Forget a lane's run (gen finished or cancelled). */
function clearLane(lane) {
  _recent.delete(lane);
  _laneGen.delete(lane);
}

function titleFor(entry) {
  return getModelById(entry.modelId)?.name || entry.modelId || 'Generating';
}

function runningGens() {
  return activeGenerations.list().filter((e) => e.status === 'running');
}

// The float window has two FIXED lanes: 'local' and 'remote', one tile each,
// and a gen's lane = its engine and NEVER changes. Frames route by their own
// engine tag (see preview:frame). started/complete/cancel carry no engine tag,
// so resolve from the store job by genId (store.genId === the activeGenerations
// id, set at dispatch — an exact match) and cache it. The first frame seeds the
// cache, so a later `complete` still resolves after the job is gone.
const _laneOf = new Map(); // genId -> 'local' | 'remote'

// The gen each lane's tile is showing, taken from the FRAME's own promptId — the
// resolution every other consumer of the bus uses. It used to be read back from
// `generationStore.activeGenId(lane)`, which answers a different question ("what
// is the store running on this lane") and on a busy queue answered null: the tile
// then lost the run's clip meta and its title, captioned "Generating" (MPI-1345).
const _laneGen = new Map(); // lane -> genId

/**
 * Lane for a gen with no engine tag (started/complete/cancel) — store lookup.
 * null for a gen that never reaches a ComfyUI engine: the 'cloud' and 'tool'
 * lanes have no preview socket and no tile. Folding them onto 'local' let a
 * Describe or a cloud edit finishing mid-render stop the local video's tile.
 */
function laneFor(genId) {
  if (_laneOf.has(genId)) return _laneOf.get(genId);
  const job = generationStore.list().find((j) => j.genId === genId);
  if (job?.lane !== 'local' && job?.lane !== 'remote') return null;
  _laneOf.set(genId, job.lane);
  return job.lane;
}

/** blob:/file URL → data URL, for the one-off final image on completion. */
async function blobUrlToDataUrl(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  const blob = await fetch(url).then((r) => r.blob()).catch(() => null);
  if (!blob) return null;
  return await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => resolve(null);
    fr.readAsDataURL(blob);
  });
}

/**
 * Forward one frame's bytes to the lane's tile, in arrival order. A frame whose URL
 * a retainer has already freed is skipped — the next one paints.
 */
function sendFrame(lane, genId, url, clip) {
  const bytesP = fetch(url).then((r) => r.arrayBuffer()).catch(() => null); // read NOW, while live
  const prev = _sendChain.get(lane) || Promise.resolve();
  const next = prev.then(async () => {
    const buf = await bytesP;
    if (!buf || !windowOpen) return;
    // add-tile is idempotent: creates the lane tile (with title/owner) if absent,
    // or relabels+takes ownership if the queue advanced on this lane.
    ipcRenderer.send('float-latent:add-tile', { lane, genId, title: titleFor(activeGenerations.get(genId) || {}) });
    ipcRenderer.send('float-latent:frame', { lane, genId, bytes: new Uint8Array(buf), clip });
  });
  _sendChain.set(lane, next);
}

/** Open the window with a tile per running gen, seeded with its current clip window. */
function openTiles() {
  for (const entry of runningGens()) {
    const last = activeGenerations.getLastPreview(entry.id);
    // Seed the cache from the engine-tagged held latent when we have it (exact),
    // else fall back to the store lookup.
    const lane = last?.engine ? (last.engine === 'remote' ? 'remote' : 'local') : laneFor(entry.id);
    if (!lane) continue; // cloud/tool run: nothing to preview
    _laneOf.set(entry.id, lane);
    _laneGen.set(lane, entry.id);
    ipcRenderer.send('float-latent:add-tile', { lane, genId: entry.id, title: titleFor(entry) });
    const urls = _recent.get(lane)?.length ? _recent.get(lane) : (last?.url ? [last.url] : []);
    const clip = activeGenerations.getPreviewClip(entry.id);
    for (const url of urls) sendFrame(lane, entry.id, url, clip);
    sendProgress(entry.id);
  }
}

export function initFloatLatentBridge() {
  if (!ipcRenderer) return; // browser dev — no OS window

  // Main asks whether to show (on minimize). Reply, and if yes, seed tiles.
  ipcRenderer.on('float-latent:query-show', () => {
    const on = state.floatLatentWindow === true;
    const gens = runningGens();
    const show = on && gens.length > 0;
    ipcRenderer.send('float-latent:show-state', { show });
    if (show) {
      windowOpen = true;
      openTiles();
    }
  });

  // Main closed the window (restore/focus/dismiss/last-tile). Stop forwarding.
  ipcRenderer.on('float-latent:closed', () => {
    windowOpen = false;
    _sendChain.clear();
  });

  // App-lifetime listeners (boot-once singleton, never torn down) — same pattern
  // as activeGenerations.js's bus listener. No cleanup array needed.
  // eslint-disable-next-line mpi/require-destroy-on-events
  Events.on('preview:frame', ({ engine, promptId, url }) => {
    if (!url) return;
    // The TILE is keyed by the engine tag → lane: one tile per engine, and a gen's
    // engine never changes. The GENERATION is the frame's own — byPromptId, as every
    // other consumer resolves it (docs/preview-bus.md § Subscribe). An unresolved
    // promptId (before the /prompt ack) is skipped there too.
    const entry = activeGenerations.byPromptId(promptId);
    if (!entry) return;
    const lane = engine === 'remote' ? 'remote' : 'local';
    if (_laneGen.get(lane) !== entry.id) _recent.delete(lane); // a new run on this lane
    _laneOf.set(entry.id, lane); // seed for complete/cancel (no engine tag there)
    _laneGen.set(lane, entry.id);
    // The run's clip state rides along with EVERY frame (MPI-535) — re-read here
    // rather than latched, because the marker that declares a run "clip" fires once
    // and the float window is usually not even open when it lands.
    const clip = activeGenerations.getPreviewClip(entry.id);
    const recent = clip ? (_recent.get(lane) || []) : [];
    recent.push(url);
    if (recent.length > (clip?.length > 0 ? clip.length : 1)) recent.shift();
    _recent.set(lane, recent);
    if (windowOpen) sendFrame(lane, entry.id, url, clip);
  });

  // Footer fill. Forwarded only when the whole percent moves — the aggregator ticks
  // per node and per sampler step, and the tile has no use for sub-percent noise.
  // eslint-disable-next-line mpi/require-destroy-on-events
  Events.on('tool:progress', ({ tool, id = null, value }) => {
    if (tool !== 'groupHistory' || id === null) return;
    const pct = Math.round(Math.min(1, Math.max(0, Number(value) || 0)) * 100);
    if (_progress.get(id) === pct) return;
    _progress.set(id, pct);
    sendProgress(id);
  });

  // NOTE: no add-tile on generation:started. The lane can't be resolved reliably
  // there (store job not yet registered), so the first preview:frame — which
  // carries the authoritative engine tag — creates and labels the tile instead.

  // A new sampler stage (MPI-167) — drop the current window so stages don't
  // concatenate into one growing loop. Forwarded to the float window's player.
  // eslint-disable-next-line mpi/require-destroy-on-events
  Events.on('generation:preview-reset', ({ id, clip }) => {
    const lane = laneFor(id);
    if (!lane) return;
    _recent.delete(lane);
    if (windowOpen) {
      // Behind this lane's frames already in flight, so it cannot overtake them.
      const prev = _sendChain.get(lane) || Promise.resolve();
      _sendChain.set(lane, prev.then(() => {
        if (windowOpen) ipcRenderer.send('float-latent:reset', { lane, genId: id, clip });
      }));
    }
  });

  // A gen COMPLETED → keep its tile, freeze it on the final result so the user can
  // click it to open the app (the whole window restores on click). The window stays
  // open until the user acts (click/X) or un-minimizes. Image results paint the
  // returned file; video results keep the last live latent (a video data-URL is too
  // heavy for a thumbnail tile).
  // eslint-disable-next-line mpi/require-destroy-on-events
  Events.on('generation:complete', async ({ id, item }) => {
    const lane = laneFor(id);
    _laneOf.delete(id);
    _progress.delete(id);
    if (!lane) return; // a cloud/tool job never had a tile
    // Forget the lane only if it is still THIS gen's: a sequential queue has usually
    // started the successor's frames already.
    if (_laneGen.get(lane) === id || !_laneGen.has(lane)) clearLane(lane);
    if (!windowOpen) return;
    // PER-LANE completion: the mascot "Done" cue fires when THIS lane's batch is
    // empty — independent of the other lane. Local finishing while remote runs must
    // still show Done on the local tile (not wait for remote). Exclude this gen so
    // the check is order-proof w.r.t. the store releasing its lane. More work on
    // THIS lane → spend (freeze, no badge) so the next queued item reuses the tile.
    const moreWork = generationStore.laneDepth(lane, id) > 0;
    const isVideo = item?.type === 'video' || item?.mediaType === 'video';
    let dataUrl = null;
    if (item?.filePath && !isVideo) {
      dataUrl = await blobUrlToDataUrl(resolveMediaUrl(item.filePath));
    }
    if (!windowOpen) return; // may have closed mid-encode
    // Guard by genId: a sequential queue promotes the next item BEFORE this one's
    // complete fires, so the lane tile may already belong to the successor. The
    // renderer ignores spend/finalize whose genId no longer owns the tile — else a
    // late item-N spend would freeze over item-(N+1)'s live frames.
    const channel = moreWork ? 'float-latent:spend' : 'float-latent:finalize';
    ipcRenderer.send(channel, { lane, genId: id, dataUrl });
  });

  // A gen was CANCELLED or ERRORED → drop its lane's tile. Main closes the window
  // when the last tile goes.
  const drop = ({ id }) => {
    const lane = laneFor(id);
    _laneOf.delete(id);
    _progress.delete(id);
    if (!lane) return; // a cloud/tool job never had a tile
    if (_laneGen.get(lane) === id || !_laneGen.has(lane)) clearLane(lane);
    if (windowOpen) ipcRenderer.send('float-latent:tile-remove', { lane, genId: id });
  };
  /* eslint-disable mpi/require-destroy-on-events */
  Events.on('generation:cancelled', drop);
  Events.on('generation:error', drop);
  /* eslint-enable mpi/require-destroy-on-events */

  clientLogger?.debug?.('system', 'floatLatentBridge initialized');
}
