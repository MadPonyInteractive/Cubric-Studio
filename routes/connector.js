'use strict';

/**
 * routes/connector.js — Vision's external-caller HTTP surface (MPI-5).
 *
 * MPI-774 adds the agent tool routes (in-app agent):
 *   GET  /connector/models           → relay model/flow list + hardware fit
 *   GET  /connector/knowledge[/:id]  → agent corpus
 *   POST /connector/install          → start download of missing deps
 *   POST /connector/describe         → crop + relay imageDescribe
 *   GET/POST /connector/memory[/:file] → the agent's notes about one project (Phase 3b)
 *
 * These relay to the renderer (install state, plugin availability, generation
 * queue) via the existing SSE job mechanism, then add server-side data.
 *
 *
 * MPI-677 cut the broker out of this file. It used to carry a `prompt.enhance`
 * caller pair — `POST /connector/enhance` plus a `promptEnhance` flag on
 * /connector/capabilities — that reached Cubric Prompt over the Cubric hub
 * broker. Enhancement is local now (`js/services/llmService.js`), so there is no
 * broker client to inject and nothing left here needs one. What remains is the
 * generation relay, which never did: it is plain HTTP, it is an external-caller
 * surface, and it is the agent's hands.
 *
 * MPI-546 adds the generation relay:
 *   POST /connector/generate        -> submit a generation, resolve on its outcome
 *   GET  /connector/jobs/stream     -> SSE, the renderer subscribes once at boot
 *   POST /connector/jobs/:id/result -> the renderer reports a job's outcome
 *
 * MPI-592 adds the one thing a submit could not express:
 *   POST /connector/open-project    -> make a project the open one, then generate
 * A submit runs in whatever project the app has open, so an agent that created a
 * project used to generate into the previous one and be told `ok: true`.
 *
 * MPI-776 adds card naming, relayed for the same reason:
 *   POST /connector/rename-card     -> set or clear a card's name in the open project
 * plus `cardName` on /connector/generate. While a project is open the renderer owns
 * its `itemGroups` and writes the whole array back on every mutation, so an agent that
 * edits project.json directly is silently overwritten on the next save.
 *
 * MPI-658 adds `flowId` to the same submit. It is not a convenience: a Flow runs
 * with `model.id: null`, so `modelId` could never reach one and EVERY Flow was
 * unreachable from an agent — including both text-to-speech surfaces, which are
 * Flows and not models. It also carries `media: [{role, url}]`, staged by the
 * caller through place-preview-asset, which is what lets an agent supply the voice
 * sample Text to Speech requires.
 *
 * MPI-547 adds the v1 named params — ratio, qualityTier, turbo, styleSelect,
 * stylization, seed — a friendly layer over the PromptBox controls, so an
 * agent can choose a specific size/quality/style per generation instead of only
 * ever inheriting the open project's. Validated here with no project (this route
 * has none); resolved against the real one in the renderer
 * (`js/data/generationControls.js` is the one resolver both sides call).
 *
 * `POST /connector/generate` IS THE CONTRACT. Dispatch lives in the renderer
 * (`generationService` / `commandExecutor` import components and the DOM), so v1
 * relays the job there over SSE — but callers never see that. If dispatch is ever
 * extracted server-side, this route stays and its body swaps for a local call.
 *
 * That only holds while the relay stays DUMB: one job shape in, one result shape
 * out. Media staging, job status, cancellation and queue introspection belong in
 * the route, server-side, where they survive the swap. Grow the SSE protocol and
 * the throwaway becomes load-bearing.
 */

const express = require('express');
const router = express.Router();
const { randomUUID } = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const fs = require('fs-extra');

const logger = require('./logger');
// DOM-free, require()-able server-side (see its own module comment). The v1
// named-param resolver both this route and js/shell/agentDispatch.js call — one
// implementation, not a route-side copy and a renderer-side copy (MPI-547).
const { findModelDef, resolveNamedParams, isValidSeed } = require('../js/data/generationControls.js');
const { isRemoteActive } = require('./remoteModels');
const { resolveDownloadConfig } = require('./platformEngine');
const { checkOnline } = require('./netCheck');
// sharp is an optional peer during testing — guard against it being absent so
// unit tests that do not exercise image crop can still import this module.
let _sharp = null;
function _getSharp() {
    if (!_sharp) _sharp = require('sharp');
    return _sharp;
}

// ESM modules cached after first import (dynamic import() is fine in CJS on Node 12+).
let _footprintMod = null;
let _depsMod = null;
let _corpusMod = null;
async function _footprint() {
    if (!_footprintMod) _footprintMod = await import('../js/data/modelConstants/footprint.js');
    return _footprintMod;
}
async function _getDeps() {
    if (!_depsMod) _depsMod = await import('../js/data/modelConstants/dependencies.js');
    return _depsMod.DEPS;
}
async function _getCorpusEntries() {
    if (!_corpusMod) _corpusMod = await import('../services/agentCorpus.mjs');
    return _corpusMod.listCorpus();
}
async function _getGuideIds() {
    if (!_corpusMod) _corpusMod = await import('../services/agentCorpus.mjs');
    return _corpusMod.guideIdsByModel();
}
let _commandsMod = null;
async function _getCommandRegistry() {
    if (!_commandsMod) _commandsMod = await import('../js/data/commandRegistry.js');
    return _commandsMod;
}

/**
 * The media one model's op takes, as generate's `media[].role` names them: the op's
 * `mediaInputs`, gated for that model the way the PromptBox gates them (an audio slot only
 * where the model takes audio). An agent otherwise learns a role only from a refused
 * submit. `tag` is how a prompt cites the slot, where the op has one (`<Picture 1>`).
 */
function mediaRolesFor(registry, op, model) {
  const slots = registry?.COMMANDS?.[op]?.mediaInputs || [];
  return registry.filterMediaInputsForModel(slots, model || null).map((i) => ({
    role: i.key,
    type: i.mediaType,
    required: !!i.required,
    ...(i.tag ? { tag: i.tag } : {}),
  }));
}
router.mediaRolesFor = mediaRolesFor;
let _memoryMod = null;
async function _memory() {
    if (!_memoryMod) _memoryMod = await import('../services/agentMemory.mjs');
    return _memoryMod;
}

// Agent crops dir: server-side staging area for image crops before describe.
// Use APP_USER_DATA when available (Electron); fall back to os.tmpdir() for
// standalone tests. Wiped on reset by routes/agent.js (W2).
function _agentCropsDir() {
    return process.env.APP_USER_DATA
        ? path.join(process.env.APP_USER_DATA, 'agent', 'crops')
        : path.join(os.tmpdir(), 'cubric-agent', 'crops');
}

// ── Hardware helper ────────────────────────────────────────────────────────────

/**
 * Get a quick VRAM reading from nvidia-smi (MB → GB). Returns null on failure.
 * This is a best-effort probe — a missing GPU or a non-NVIDIA GPU both return null.
 */
function _nvidiaSmiVram() {
    return new Promise((resolve) => {
        execFile(
            'nvidia-smi',
            ['--query-gpu=memory.total', '--format=csv,noheader,nounits'],
            { windowsHide: true, timeout: 3000 },
            (err, stdout) => {
                if (err || !stdout) return resolve(null);
                const mb = parseInt(stdout.trim(), 10);
                resolve(Number.isFinite(mb) && mb > 0 ? mb / 1024 : null);
            },
        );
    });
}

/**
 * Fetch hardware info for the active engine.
 * Local: GPU from resolveDownloadConfig + nvidia-smi VRAM + os.totalmem.
 * Remote: pod specs via GET /remote/pod/specs on loopback.
 */
async function _getHardwareInfo() {
    const port = Number(process.env.CUBRIC_PORT) || 3000;
    if (isRemoteActive()) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/remote/pod/specs`);
            if (res.ok) {
                const d = await res.json();
                return {
                    gpuName: d.gpuName || null,
                    vramGb: typeof d.vramGb === 'number' ? d.vramGb : null,
                    ramGb: typeof d.ramGb === 'number' ? d.ramGb : Math.round(os.totalmem() / (1024 ** 3)),
                };
            }
        } catch (_) { /* fall through to local */ }
    }
    const [cfg, vramGb] = await Promise.all([
        resolveDownloadConfig().catch(() => null),
        _nvidiaSmiVram(),
    ]);
    return {
        gpuName: cfg?.gpu?.name || null,
        vramGb,
        ramGb: Math.round(os.totalmem() / (1024 ** 3)),
    };
}

// ── Coordinate mapping (MPI-774) ───────────────────────────────────────────────

/**
 * Map a point from the describer's scaled-input space back to original image pixels.
 *
 * The describer scales the crop (or the whole image when no crop) to ~1 MP via
 * node 41 `ImageScaleToTotalPixels` (steps of 16). A coordinate in that scaled
 * input maps to the original as:
 *   x_orig = cropX + x_in * cropWidth / inputWidth
 *   y_orig = cropY + y_in * cropHeight / inputHeight
 *
 * No crop: cropX/cropY = 0, cropWidth/cropHeight = origWidth/origHeight.
 *
 * The raw answer format and coordinate space (pixels vs 0-1000 normalised) are
 * determined from Phase 4's measured answers; this function handles the pixel case.
 * **The box parser waits for Phase 4 — do not extend this for Phase 1.**
 *
 * @param {{ x: number, y: number }} point  Point in the describer's input space.
 * @param {{ crop?: {x,y,width,height}, inputWidth: number, inputHeight: number,
 *            origWidth: number, origHeight: number }} opts
 * @returns {{ x: number, y: number }}  Point in original image pixels.
 */
function mapFromDescribeSpace(point, { crop, inputWidth, inputHeight, origWidth, origHeight }) {
    const srcX = crop ? crop.x : 0;
    const srcY = crop ? crop.y : 0;
    const srcW = crop ? crop.width : origWidth;
    const srcH = crop ? crop.height : origHeight;
    return {
        x: srcX + point.x * srcW / inputWidth,
        y: srcY + point.y * srcH / inputHeight,
    };
}
// Attached to the router so require('../routes/connector').mapFromDescribeSpace works
// regardless of module.exports being reassigned to router below.
// (module.exports = router overrides the exports reference, so we attach here pre-hoc.)
router.mapFromDescribeSpace = mapFromDescribeSpace;

// --- generation relay state ------------------------------------------------

/**
 * Subscribed renderer SSE responses, oldest first.
 *
 * A job goes to exactly ONE of them — the most recent — never to all. Broadcasting
 * looks harmless while a single window is open and is a live hazard the moment a
 * second renderer exists (a dev browser tab beside the Electron window, a reload
 * whose old stream has not closed yet): every subscriber would independently
 * dispatch the same job, so the user pays for N generations and sees one result,
 * because the first reply settles the caller and the rest are dropped.
 *
 * Most recent wins because that is the renderer the user is actually looking at —
 * a stale stream from a reloaded window would otherwise keep answering forever.
 */
const _jobSubscribers = new Set();

/** The renderer a job should go to: the newest live subscriber, or null. */
function _activeSubscriber() {
  let last = null;
  for (const client of _jobSubscribers) last = client; // Set preserves insertion order
  return last;
}
/** jobId -> { settle, timer } for generations awaiting a renderer result. */
const _pendingJobs = new Map();

// A generation queued behind others can legitimately run for a long time. This
// only bounds how long the HTTP caller waits — the generation itself carries on
// in the app, and its card still lands.
// ponytail: one flat ceiling, no per-op tuning. Split it per mediaType if a real
// video queue starts tripping it.
const JOB_TIMEOUT_MS = 30 * 60 * 1000;

function _settleJob(jobId, payload) {
  const pending = _pendingJobs.get(jobId);
  if (!pending) return false; // already settled, or timed out
  clearTimeout(pending.timer);
  _pendingJobs.delete(jobId);
  pending.settle(payload);
  return true;
}

/**
 * Push a job to the subscribed renderer and resolve with whatever it reports
 * back. Rejects nothing — an unreachable renderer, a timeout and a renderer-side
 * failure all resolve to a clean `{ ok: false, error }` envelope.
 */
function _dispatchToRenderer(capability, input) {
  if (!_jobSubscribers.size) {
    return Promise.resolve({
      ok: false,
      error: {
        code: 'APP_UNAVAILABLE',
        message: 'No Vision window is listening. Is the app open?',
      },
    });
  }

  const jobId = randomUUID();
  const frame = `event: job\ndata: ${JSON.stringify({ jobId, capability, input })}\n\n`;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      _pendingJobs.delete(jobId);
      resolve({
        ok: false,
        error: {
          code: 'TIMEOUT',
          message: `No result within ${Math.round(JOB_TIMEOUT_MS / 60000)} minutes. The generation may still be running in the app.`,
        },
      });
    }, JOB_TIMEOUT_MS);
    // Don't hold the process open on a job nobody is waiting for.
    if (typeof timer.unref === 'function') timer.unref();

    _pendingJobs.set(jobId, { settle: resolve, timer });

    // Deliver to ONE renderer. A dead socket is dropped and the next-newest gets
    // it, so a window that closed without its close handler firing costs a retry
    // rather than the job.
    for (;;) {
      const client = _activeSubscriber();
      if (!client) {
        _settleJob(jobId, {
          ok: false,
          error: {
            code: 'APP_UNAVAILABLE',
            message: 'No Vision window is listening. Is the app open?',
          },
        });
        return;
      }
      try {
        client.write(frame);
        return;
      } catch {
        _jobSubscribers.delete(client);
      }
    }
  });
}

// `generationSubmit` is the only capability left: it says a renderer is
// subscribed to the SSE relay, so a submitted job has somewhere to land.
// MPI-677 removed the `promptEnhance` flag — it reported whether a SIBLING APP
// was live, and there is no sibling any more.
router.get('/connector/capabilities', (_req, res) => {
  res.json({ generationSubmit: _jobSubscribers.size > 0 });
});

/**
 * GET /connector/jobs/stream — the renderer's inbound command channel.
 *
 * Same SSE shape as /comfy/events/stream, but always-on: that stream is opened
 * per generation by commandExecutor, so it can never carry inbound commands.
 */
router.get('/connector/jobs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();

  _jobSubscribers.add(res);
  res.write('event: connected\ndata: {}\n\n');

  req.on('close', () => {
    _jobSubscribers.delete(res);
  });
});

// v1 named params (MPI-547) — a friendly layer over the PromptBox controls an
// agent submit can now choose per-generation instead of inheriting the open
// project's. Only meaningful on the modelId branch (a Flow's controls are its
// own DECLARED `fields`, not these). Validated here, STATICALLY, against the
// model's own capability data — no project is open here, so an unset param is
// left off `input` and resolved against the real project by
// `js/shell/agentDispatch.js`.
const NAMED_PARAM_KEYS = ['ratio', 'qualityTier', 'turbo', 'styleSelect', 'stylization'];

/**
 * POST /connector/generate
 * Body, EITHER a model op:  { modelId, operation, positive, negative?, injectionParams?,
 *                              ratio?, qualityTier?, turbo?, styleSelect?, stylization?,
 *                              seed?, media? }
 *       OR a Flow (MPI-658): { flowId, fields?, media? }
 *
 * The two are not variants of one shape. A Flow has no model — it dispatches with
 * `model.id: null` — so `modelId` can never name one, and its controls are DECLARED
 * (`flowsRegistry` § fields) rather than free-form injection params. Sending both is
 * a caller error rather than a merge: whichever won would run something the caller
 * did not fully describe.
 *
 * `media` is `[{ role, url }]`, by reference. Bytes never come through here — the
 * caller stages its own file with `POST /project-media/:id/place-preview-asset`
 * (which accepts a plain absolute path) and passes back the url that returns.
 *
 * Resolves when the generation reaches a terminal state, so the caller gets the
 * output it asked for rather than a job id to poll. Runs in whatever project the
 * app currently has open.
 */
router.post('/connector/generate', async (req, res) => {
  const {
    modelId, operation, positive, negative, injectionParams, flowId, fields, media,
    ratio, qualityTier, turbo, styleSelect, stylization, batch, seed, params,
  } = req.body || {};

  const _bad = (message) => res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message } });
  const _namedErr = (code, message) => res.status(400).json({ ok: false, error: { code, message } });

  if (flowId && modelId) {
    return _bad('body.flowId and body.modelId are alternatives — send one, not both.');
  }
  if (!flowId && (!modelId || !operation)) {
    return _bad('body.flowId, or body.modelId and body.operation, are required.');
  }

  // Agents never batch (Fabio, 2026-09-15): N queued submits, not a batch of N that
  // holds N latents in VRAM at once. Refused by name rather than silently run at 1.
  if (batch !== undefined) {
    return _namedErr('BATCH_UNSUPPORTED', 'Agent submits always run batch 1. Send N separate submits instead; they queue.');
  }
  if (!flowId && NAMED_PARAM_KEYS.some((k) => req.body?.[k] !== undefined)) {
    const model = findModelDef(modelId);
    if (!model) return _namedErr('UNKNOWN_MODEL', `No model with id "${modelId}".`);

    const named = {};
    if (ratio !== undefined) named.ratio = ratio;
    if (qualityTier !== undefined) named.qualityTier = qualityTier;
    if (turbo !== undefined) named.turbo = turbo;
    if (styleSelect !== undefined) named.styleSelect = styleSelect;
    if (stylization !== undefined) named.stylization = stylization;

    // project:null — static validation only, per this route's own comment above.
    const check = resolveNamedParams(null, model, String(operation), named);
    if (!check.ok) return _namedErr(check.code, check.message);
  }
  if (seed !== undefined && !isValidSeed(seed)) {
    return _namedErr('INVALID_SEED', 'body.seed must be an integer between 0 and 4294967295.');
  }
  // MPI-776: names the card once the run lands, on either branch.
  const { cardName } = req.body || {};
  if (cardName !== undefined && typeof cardName !== 'string') {
    return _namedErr('INVALID_CARD_NAME', 'body.cardName must be a string: the name the gallery card gets when the run lands.');
  }

  const input = flowId
    ? { flowId: String(flowId), fields: fields || {}, media: Array.isArray(media) ? media : [],
        ...(params && typeof params === 'object' ? { params } : {}) }
    : {
      modelId: String(modelId),
      operation: String(operation),
      positive: positive || '',
      negative: negative || '',
      injectionParams: injectionParams || {},
      // MPI-765: same `[{ role, url }]` a Flow takes. Omitted when empty so a text
      // submit's job input keeps its exact pre-media shape.
      ...(Array.isArray(media) && media.length ? { media } : {}),
      ...(ratio !== undefined ? { ratio } : {}),
      ...(qualityTier !== undefined ? { qualityTier } : {}),
      ...(turbo !== undefined ? { turbo } : {}),
      ...(styleSelect !== undefined ? { styleSelect } : {}),
      ...(stylization !== undefined ? { stylization } : {}),
      ...(seed !== undefined ? { seed } : {}),
    };

  if (cardName !== undefined) input.cardName = cardName;

  const result = await _dispatchToRenderer('generation.submit', input);

  if (!result.ok) {
    logger.warn('system', `connector generate failed: ${result.error?.code} ${result.error?.message}`);
  }
  res.json(result);
});

/**
 * POST /connector/open-project — make a project the one the app has open, so the
 * next `/connector/generate` lands there.
 *
 * `folderPath` is the key, matching every other project route; ids are not
 * resolvable without a scan. `/list-projects` and `/create-project` both return
 * it ready to pass straight in.
 */
router.post('/connector/open-project', async (req, res) => {
  const { folderPath } = req.body || {};

  if (!folderPath) {
    return res.status(400).json({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'body.folderPath is required.' },
    });
  }

  const result = await _dispatchToRenderer('project.open', { folderPath: String(folderPath) });

  if (!result.ok) {
    logger.warn('system', `connector open-project failed: ${result.error?.code} ${result.error?.message}`);
  }
  res.json(result);
});

/**
 * POST /connector/rename-card — set or clear a gallery card's name (MPI-776).
 *
 * `groupId` is the card: `output.groupId` from /connector/generate, or an
 * `itemGroups[].id` in project.json. `name` is required; null or blank clears it and
 * the card shows its generated name again, same as clearing the inline rename. The
 * card must be in the project the app has open.
 */
router.post('/connector/rename-card', async (req, res) => {
  const { groupId, name } = req.body || {};

  if (!groupId || typeof groupId !== 'string') {
    return res.status(400).json({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'body.groupId is required.' },
    });
  }
  if (name !== null && typeof name !== 'string') {
    return res.status(400).json({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'body.name must be a string, or null to clear the name.' },
    });
  }

  const result = await _dispatchToRenderer('card.rename', { groupId, name });

  if (!result.ok) {
    logger.warn('system', `connector rename-card failed: ${result.error?.code} ${result.error?.message}`);
  }
  res.json(result);
});

/**
 * POST /connector/jobs/:id/result — the renderer reporting a job's outcome.
 * Unknown/late ids are a no-op (the caller already timed out), never an error.
 */
router.post('/connector/jobs/:id/result', (req, res) => {
  const settled = _settleJob(req.params.id, req.body || {});
  res.json({ received: settled });
});

// ── Agent tool routes (MPI-774) ────────────────────────────────────────────────

/**
 * GET /connector/models
 *
 * Returns the full model + flow catalogue with install state (from the renderer),
 * hardware fit (from footprint.js tradeTable), and the download size of any
 * missing deps. Errors: APP_UNAVAILABLE.
 */
router.get('/connector/models', async (req, res) => {
  const listResult = await _dispatchToRenderer('agent.list-models', {});
  if (!listResult.ok) return res.json(listResult);

  const { engine, models: rawModels, flows } = listResult.output || {};

  // Hardware and footprint are best-effort; failures → null, never a 500.
  let hardware = { gpuName: null, vramGb: null, ramGb: null };
  let fp = null;
  let DEPS = null;
  try {
    [hardware, fp, DEPS] = await Promise.all([_getHardwareInfo(), _footprint(), _getDeps()]);
  } catch (_) { /* serve without fit if anything goes wrong */ }
  // Each model's prompting guides (MPI-774 Phase 3b): the in-app agent reads one before
  // its first prompt for that model.
  let guideIds = {};
  let registry = null;
  try {
    [guideIds, registry] = await Promise.all([_getGuideIds(), _getCommandRegistry()]);
  } catch (err) { logger.warn('connector', `guide ids or media roles unavailable: ${err.message}`); }

  const { tradeTable, sizeToGb } = fp || {};

  const models = (rawModels || []).map(m => {
    let fit = null;
    let missingDownloadGb = 0;

    if (tradeTable && sizeToGb && DEPS) {
      // Find the full ModelDef so tradeTable can read its weight sizes.
      // Dynamic import of MODELS would be cleaner but costs ~200ms; look it up by
      // matching the id from the renderer's slim entry.
      try {
        const modelDef = findModelDef(m.id);
        if (modelDef) {
          const table = tradeTable(modelDef, engine || null, hardware.vramGb);
          const userRow = table.rows.find(r => r.isUserRow) || table.rows[0];
          fit = {
            floorVramGb: table.vramFloor,
            ramGbAtYourVram: userRow ? userRow.ram : null,
            runs: userRow ? userRow.isUserRow : false,
          };
        }
      } catch (_) { /* no fit */ }

      missingDownloadGb = (m.missingDepIds || []).reduce((sum, id) => {
        const dep = DEPS[id];
        return sum + (dep?.size ? sizeToGb(dep.size) : 0);
      }, 0);
    }

    const { missingDepIds, ...rest } = m;
    return {
      ...rest,
      ops: (rest.ops || []).map((o) => ({ ...o, media: registry ? mediaRolesFor(registry, o.op, findModelDef(m.id)) : [] })),
      missingDownloadGb: Math.round(missingDownloadGb * 100) / 100,
      ...(fit ? { fit } : {}),
      guides: guideIds[m.id] || [],
    };
  });

  res.json({ ok: true, engine: engine || 'local', hardware, models, flows: flows || [] });
});

/**
 * GET /connector/knowledge
 * Returns the corpus index: `{ ok, entries: [{ id, kind, title, tags }] }`.
 */
router.get('/connector/knowledge', async (_req, res) => {
  try {
    const entries = await _getCorpusEntries();
    res.json({
      ok: true,
      entries: entries.map(({ id, kind, title, tags }) => ({ id, kind, title, tags })),
    });
  } catch (err) {
    logger.error('connector', 'knowledge list failed', err);
    res.json({ ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } });
  }
});

/**
 * GET /connector/knowledge/:id
 * Returns one corpus entry's text: `{ ok, id, title, text }`.
 * Error: UNKNOWN_ENTRY.
 */
router.get('/connector/knowledge/:id', async (req, res) => {
  try {
    const entries = await _getCorpusEntries();
    const entry = entries.find(e => e.id === req.params.id);
    if (!entry) {
      return res.json({ ok: false, error: { code: 'UNKNOWN_ENTRY', message: `No corpus entry "${req.params.id}".` } });
    }
    res.json({ ok: true, id: entry.id, title: entry.title, text: entry.text() });
  } catch (err) {
    logger.error('connector', 'knowledge fetch failed', err);
    res.json({ ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } });
  }
});

/** One memory call in the connector envelope: a malformed request is a 400, a named miss a 200. */
async function _memoryReply(res, work) {
  const mem = await _memory();
  try {
    res.json({ ok: true, ...(await work(mem)) });
  } catch (err) {
    if (!(err instanceof mem.MemoryError)) {
      logger.error('connector', 'agent memory failed', err);
      return res.json({ ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } });
    }
    res.status(err.code === 'BAD_REQUEST' ? 400 : 200)
      .json({ ok: false, error: { code: err.code, message: err.message } });
  }
}

/**
 * The agent's notes about one project, `<project>/Agent/` (`services/agentMemory.mjs`):
 *   GET  /connector/memory?folderPath=        -> { ok, notes: [{ title, file, hook }] }
 *   GET  /connector/memory/:file?folderPath=  -> { ok, file, text }
 *   POST /connector/memory { folderPath, file, title, hook?, text } -> { ok, file, created }
 * No delete route: the in-app agent never deletes (Fabio, 2026-09-16), and an outside
 * agent can remove a note file itself. Errors: BAD_REQUEST (400), NOT_A_PROJECT,
 * UNKNOWN_NOTE, NOTE_TOO_LONG, MEMORY_FULL.
 */
router.get('/connector/memory', (req, res) =>
  _memoryReply(res, (m) => m.readIndex(req.query.folderPath)));

router.get('/connector/memory/:file', (req, res) =>
  _memoryReply(res, (m) => m.readNote(req.query.folderPath, req.params.file)));

router.post('/connector/memory', (req, res) => {
  const { folderPath, ...note } = req.body || {};
  return _memoryReply(res, (m) => m.writeNote(folderPath, note));
});

/**
 * POST /connector/install { modelId }
 *
 * Starts downloading any missing deps for a model. Returns immediately with
 * `{ ok, modelId, downloadGb, started: true }`. Progress via
 * `GET /comfy/downloads/status`. Errors: BAD_REQUEST, UNKNOWN_MODEL,
 * ALREADY_INSTALLED, OFFLINE, APP_UNAVAILABLE.
 */
router.post('/connector/install', async (req, res) => {
  const { modelId } = req.body || {};
  if (!modelId) {
    return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'body.modelId is required.' } });
  }

  if (!findModelDef(modelId)) {
    return res.json({ ok: false, error: { code: 'UNKNOWN_MODEL', message: `No model with id "${modelId}".` } });
  }

  if (!(await checkOnline())) {
    return res.json({ ok: false, error: { code: 'OFFLINE', message: 'The host appears to be offline.' } });
  }

  const result = await _dispatchToRenderer('agent.install-model', { modelId });
  if (!result.ok) {
    logger.warn('connector', `install ${modelId}: ${result.error?.code}`);
  }
  // The renderer wraps its output in { ok, output: { modelId, downloadGb, started } }.
  // Unwrap one level so the caller gets the flat shape the contract specifies.
  if (result.ok && result.output) return res.json({ ok: true, ...result.output });
  res.json(result);
});

/**
 * POST /connector/describe { imagePath, question?, crop? }
 *
 * Optional crop: cut the image with sharp to the agent crops dir, then relay
 * to the renderer's `agent.describe` capability. Returns `{ ok, output: { text } }`.
 * Errors: BAD_REQUEST, IMAGE_NOT_FOUND, CROP_OUT_OF_BOUNDS, DESCRIBER_MISSING,
 * APP_UNAVAILABLE, RUNTIME_ERROR, TIMEOUT.
 */
router.post('/connector/describe', async (req, res) => {
  const { imagePath, question, crop } = req.body || {};

  if (!imagePath) {
    return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'body.imagePath is required.' } });
  }

  // Validate crop fields when provided.
  if (crop !== undefined) {
    if (!crop || typeof crop !== 'object') {
      return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'body.crop must be an object {x,y,width,height}.' } });
    }
    const { x, y, width, height } = crop;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)
        || width <= 0 || height <= 0) {
      return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'crop.x/y/width/height must be finite numbers; width/height must be positive.' } });
    }
  }

  // Verify the source image exists.
  const srcExists = await fs.pathExists(imagePath);
  if (!srcExists) {
    return res.json({ ok: false, error: { code: 'IMAGE_NOT_FOUND', message: `File not found: ${imagePath}` } });
  }

  let effectivePath = imagePath;

  if (crop) {
    try {
      const cropsDir = _agentCropsDir();
      await fs.ensureDir(cropsDir);
      const outPath = path.join(cropsDir, `${randomUUID()}.jpg`);
      const sharp = _getSharp();

      // Get source dimensions for out-of-bounds check.
      const meta = await sharp(imagePath).metadata();
      const srcW = meta.width || 0;
      const srcH = meta.height || 0;
      const { x, y, width, height } = crop;

      if (x < 0 || y < 0 || x + width > srcW || y + height > srcH) {
        return res.json({ ok: false, error: { code: 'CROP_OUT_OF_BOUNDS',
          message: `crop (${x},${y},${width},${height}) extends outside image (${srcW}×${srcH}).` } });
      }

      await sharp(imagePath)
        .extract({ left: Math.round(x), top: Math.round(y), width: Math.round(width), height: Math.round(height) })
        .jpeg({ quality: 92 })
        .toFile(outPath);
      effectivePath = outPath;
    } catch (err) {
      logger.error('connector', 'describe crop failed', err);
      return res.json({ ok: false, error: { code: 'RUNTIME_ERROR', message: `Crop failed: ${err.message}` } });
    }
  }

  const result = await _dispatchToRenderer('agent.describe', { imagePath: effectivePath, question });

  if (!result.ok) {
    logger.warn('connector', `describe failed: ${result.error?.code}`);
  }
  res.json(result);
});

module.exports = router;
