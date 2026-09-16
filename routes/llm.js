/**
 * routes/llm.js — the app's own LLM call (MPI-677 step 1a).
 *
 * THE POINT OF THIS FILE: until now Vision had no LLM client of any kind, and
 * the PromptBox's Enhance button called OUT over the broker to Cubric Prompt.
 * This is the local replacement. Nothing here knows about recipes — the renderer
 * (`js/services/llmService.js`) resolves the recipe and sends the finished system
 * prompt, because `js/data/recipes/` is ESM the renderer already loads. This half
 * exists for one reason the renderer cannot cover: **the DeepInfra key lives in
 * the main process and must never reach the renderer.**
 *
 * The routes:
 *   GET  /llm/status          -> { deepinfra: { hasKey }, ollama: { running }, defaultBackend }
 *   GET  /llm/models          -> { models: [{ id, name, description, ollama, deepinfra, deepInfraId, isDefault, price }] }
 *   POST /llm/enhance         -> { ok, text, backend, model } | { ok:false, error }
 *                                backend:'endpoint' + profileId -> the shared connection, error { code, message }
 *   POST /llm/describe        -> { ok, text, backend, model } | { ok:false, error:{ code, message } }
 *                                body { profileId, modelId?, imagePath, question?, crop? } (MPI-737)
 *   GET  /llm/ollama          -> { running, platform, install, defaultModelId,
 *                                  models: { <id>: { name, downloaded, size, pull } } }
 *   POST /llm/ollama/start    -> { status: 'running'|'started'|'missing'|'failed' }
 *   POST /llm/ollama/install  -> { ok }   ok:false = no silent install here, open the download page
 *   POST /llm/ollama/pull     -> { ok } | { ok:false, error }   body { modelId }
 *   POST /llm/connection/probe  -> { ok, latencyMs, modelCount }      body { profileId }
 *   GET  /llm/connection/models -> { ok, profileId, models }          ?profileId=
 *
 * The two `connection` routes serve the ONE remote connection every job shares
 * (MPI-774); an error there is `{ ok:false, error:{ code, message, status? } }`.
 *
 * HONEST STATE IS PART OF THE CONTRACT: every completion echoes the backend and
 * the model that actually answered, never the one that was asked for. The UI
 * shows it, and "local" must never appear over a cloud answer.
 *
 * The backends themselves are `services/llmEngines.mjs` — the SAME clients the
 * Stage 1 recipe harness measures every recipe on. One implementation, so a fix
 * here cannot drift from the instrument that produced the greens. Starting,
 * installing and downloading into Ollama is `services/ollamaLifecycle.js` (MPI-728
 * phase 3), which the harness never touches.
 */

'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const logger = require('./logger');
const { ask } = require('./forkBridge');
const ollamaLifecycle = require('../services/ollamaLifecycle');

// sharp is a project dependency; loaded lazily so test runs that do not exercise
// image operations can still import this router without a native binary around.
let _sharp = null;
function _getSharp() {
    if (!_sharp) _sharp = require('sharp');
    return _sharp;
}

// `services/llmEngines.mjs` is ESM and this router is CJS, so it loads through a
// dynamic import — the same thing server.js already does for axios. Cached after
// the first call.
let _enginesPromise = null;
function engines() {
    if (!_enginesPromise) _enginesPromise = import('../services/llmEngines.mjs');
    return _enginesPromise;
}

/**
 * The DeepInfra key, or null. Order: the user's stored key (main process,
 * safeStorage, over the fork bridge) then `DEEPINFRA_API_KEY` from the
 * environment — which is what a dev run and the recipe harness use. The value
 * never leaves this module: it is handed straight to the engine and is not
 * logged, cached on disk, or returned by any route.
 */
async function deepInfraKey() {
    const m = await ask('secrets:get-deepinfra-key-request', {});
    return (m && m.value) || process.env.DEEPINFRA_API_KEY || null;
}

/** Presence only — asked on every readiness poll, so it must not move the key. */
async function hasDeepInfraKey() {
    const m = await ask('secrets:has-deepinfra-key-request', {});
    if (m && typeof m.has === 'boolean') return m.has || !!process.env.DEEPINFRA_API_KEY;
    return !!process.env.DEEPINFRA_API_KEY;
}

/**
 * Which backend a request without an explicit choice runs on.
 *
 * DeepInfra when a key is present, Ollama otherwise (Fabio, 2026-09-08: with a
 * key connected there is no GPU tax on any model, which is what let the enhance
 * control collapse to one path). This resolves SERVER-side because only this
 * process can see the key — the renderer is told the answer, never the reason
 * it could compute it itself.
 */
async function defaultBackend() {
    return (await hasDeepInfraKey()) ? 'deepinfra' : 'ollama';
}

router.get('/llm/status', async (_req, res) => {
    try {
        const { OllamaEngine } = await engines();
        const [hasKey, running] = await Promise.all([
            hasDeepInfraKey(),
            new OllamaEngine().isRunning(),
        ]);
        res.json({
            deepinfra: { hasKey },
            ollama: { running },
            defaultBackend: hasKey ? 'deepinfra' : 'ollama',
        });
    } catch (err) {
        logger.error('system', `llm status failed: ${err && err.message}`);
        // A probe failure is "not ready", never a 500 the caller has to branch on.
        res.json({ deepinfra: { hasKey: false }, ollama: { running: false }, defaultBackend: 'ollama' });
    }
});

/**
 * DeepInfra's prices, kept for the life of the process once a fetch succeeds. A
 * failure is not kept, so the next panel open tries again.
 * ponytail: a mid-session reprice shows after a restart; add a TTL if that matters.
 */
let _prices = null;
async function deepInfraPrices() {
    if (!_prices) _prices = engines().then((e) => e.fetchDeepInfraPrices());
    const prices = await _prices;
    if (!prices) _prices = null;
    return prices;
}

/**
 * GET /llm/models — the enhancer LLM catalogue, for the settings picker.
 *
 * MPI-728. The registry lives in `services/llmEngines.mjs`, which is server-side
 * ESM the renderer cannot import, so the picker asks for it here. Coverage is
 * reported per backend rather than as one list, because it is ASYMMETRIC on
 * purpose — abliterated builds exist only locally — and the dropdown has to
 * filter to the backend the user picked instead
 * of offering a model that backend cannot serve.
 *
 * `price` is DeepInfra's live `{ in, out }` in USD per 1M tokens, or null. It is
 * fetched ONLY once a key is saved, so a user who never chose the cloud makes no
 * call to it, and even then no key is sent: the catalogue is public.
 */
router.get('/llm/models', async (_req, res) => {
    try {
        const { MODEL_REGISTRY, DEFAULT_MODEL_ID, modelName } = await engines();
        const prices = (await hasDeepInfraKey()) ? await deepInfraPrices() : null;
        res.json({
            defaultModelId: DEFAULT_MODEL_ID,
            models: MODEL_REGISTRY.map((m) => ({
                id: m.id,
                name: m.name,
                names: { ollama: modelName(m, 'ollama'), deepinfra: modelName(m, 'deepinfra') },
                description: m.description,
                ollama: !!m.ollamaName,
                deepinfra: !!m.deepInfraId,
                // The raw DeepInfra id: the renderer maps a stored registry pick to it
                // on the Remote (endpoint) branch (MPI-737).
                deepInfraId: m.deepInfraId || null,
                isDefault: m.id === DEFAULT_MODEL_ID,
                price: (m.deepInfraId && prices?.[m.deepInfraId]) || null,
            })),
        });
    } catch (err) {
        logger.error('system', `llm models failed: ${err && err.message}`);
        res.json({ defaultModelId: null, models: [] });
    }
});

// ── The shared remote connection (MPI-774; MPI-737 consumes it) ──────────────
// One connection for every LLM job. These two routes are job-agnostic: the
// agent's own "can this model call a tool?" check stays in POST /agent/probe.

const _connectionError = (res, code, message, status) =>
    res.json({ ok: false, error: { code, message, ...(status && { status }) } });

/** The connection's models, or a sent error envelope (returns undefined). */
async function _connectionModels(res, profileId) {
    if (!profileId || typeof profileId !== 'string') {
        res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'profileId is required.' } });
        return undefined;
    }
    const { resolveConnection, listRemoteModels } = await engines();
    const { profile, key } = await resolveConnection(profileId, ask);
    if (!profile || !profile.baseURL) return void _connectionError(res, 'NO_PROFILE', 'Connection not found, or it has no base URL.');
    // Ollama's /v1 answers without a key; every hosted preset needs one.
    if (!key && profileId !== 'ollama') return void _connectionError(res, 'NO_KEY', 'No API key saved for this connection.');
    try {
        return await listRemoteModels({ presetId: profileId, baseURL: profile.baseURL, key });
    } catch (err) {
        logger.warn('system', `llm connection models failed (${profileId}): ${err && err.message}`);
        return void _connectionError(res, 'ENDPOINT_ERROR', err.message, err.status);
    }
}

/**
 * POST /llm/connection/probe { profileId } -> { ok, latencyMs, modelCount }.
 * Auth + reachability through `GET <baseURL>/models`; spends no tokens.
 */
router.post('/llm/connection/probe', async (req, res) => {
    const start = Date.now();
    const models = await _connectionModels(res, req.body?.profileId);
    if (!models) return;
    res.json({ ok: true, latencyMs: Date.now() - start, modelCount: models.length });
});

/**
 * GET /llm/connection/models?profileId= -> { ok, profileId, models: [{ id,
 * contextWindow, vision, recommendedFor }] }, recommended first. Each job row
 * filters `recommendedFor` for its own job ('agent' | 'enhance' | 'describe').
 */
router.get('/llm/connection/models', async (req, res) => {
    const profileId = req.query.profileId;
    const models = await _connectionModels(res, profileId);
    if (!models) return;
    res.json({ ok: true, profileId, models });
});

/**
 * Download sizes from Ollama's registry, kept once known. A failure is not kept,
 * so the next look tries again.
 */
const _ollamaSizes = new Map();
async function ollamaSize(name) {
    if (_ollamaSizes.has(name)) return _ollamaSizes.get(name);
    const size = await (await engines()).ollamaDownloadSize(name);
    if (size) _ollamaSizes.set(name, size);
    return size;
}

/**
 * GET /llm/ollama — Ollama's state, for the settings row (MPI-728 phase 3).
 *
 * READ-ONLY: it never starts, installs or downloads anything, so polling it during a
 * download costs one local probe. `downloaded` is null while Ollama is not running,
 * because nothing can be known about its store then. `size` is looked up only for a
 * model that is not downloaded, from Ollama's public registry, which is where the
 * download itself would come from.
 */
router.get('/llm/ollama', async (_req, res) => {
    try {
        const { OllamaEngine, MODEL_REGISTRY, DEFAULT_MODEL_ID, ollamaTagged, modelName } = await engines();
        const engine = new OllamaEngine();
        const running = await engine.isRunning();
        const installed = running ? new Set(await engine.listModels()) : null;
        const entries = await Promise.all(MODEL_REGISTRY.filter((m) => m.ollamaName).map(async (m) => {
            const downloaded = installed ? installed.has(ollamaTagged(m.ollamaName)) : null;
            return [m.id, {
                name: modelName(m, 'ollama'),
                downloaded,
                size: downloaded === false ? await ollamaSize(m.ollamaName) : null,
                pull: ollamaLifecycle.pullState(m.ollamaName),
            }];
        }));
        res.json({
            running,
            platform: process.platform,
            install: ollamaLifecycle.installState(),
            defaultModelId: DEFAULT_MODEL_ID,
            models: Object.fromEntries(entries),
        });
    } catch (err) {
        logger.error('system', `llm ollama state failed: ${err && err.message}`);
        res.status(500).json({ error: 'Could not read the state of Ollama.' });
    }
});

/** POST /llm/ollama/start — start an installed, stopped Ollama. Never installs. */
router.post('/llm/ollama/start', async (_req, res) => {
    const status = await ollamaLifecycle.ensureOllama().catch((err) => {
        logger.error('system', `ollama start failed: ${err && err.message}`);
        return 'failed';
    });
    logger.info('system', `ollama start: ${status}`);
    res.json({ status });
});

/**
 * POST /llm/ollama/install — install Ollama silently (Windows, winget). Reached only
 * from the user's own click on "Install Ollama", which is the consent. `ok: false`
 * means this platform has no silent install: the row opens the download page.
 */
router.post('/llm/ollama/install', (_req, res) => {
    const ok = ollamaLifecycle.installOllama();
    if (ok) logger.info('system', 'ollama install started (winget)');
    res.json({ ok });
});

/**
 * POST /llm/ollama/pull — download one registry model into the user's own Ollama.
 * Reached only from the user's click on Download. Returns once the download has
 * started; its progress is on `GET /llm/ollama`.
 */
router.post('/llm/ollama/pull', async (req, res) => {
    try {
        const { getModel, DEFAULT_MODEL_ID } = await engines();
        const asked = req.body && req.body.modelId;
        const entry = getModel(asked || DEFAULT_MODEL_ID);
        if (!entry || !entry.ollamaName) {
            return res.json({ ok: false, error: `No Ollama model for id: ${asked}` });
        }
        // A download needs a server to talk to; starting one is not a download.
        const status = await ollamaLifecycle.ensureOllama();
        if (status === 'missing' || status === 'failed') {
            return res.json({ ok: false, error: 'Ollama is not running, so nothing can be downloaded into it.' });
        }
        ollamaLifecycle.startPull(entry.ollamaName);
        logger.info('system', `ollama pull started: ${entry.ollamaName}`);
        res.json({ ok: true });
    } catch (err) {
        logger.error('system', `ollama pull failed to start: ${err && err.message}`);
        res.json({ ok: false, error: (err && err.message) || 'The download could not start.' });
    }
});

/**
 * POST /llm/enhance — one completion.
 *
 * body: { prompt, system?, backend?, modelId?, maxTokens? }
 *   `backend`   'deepinfra' | 'ollama'. Omitted -> `defaultBackend()`.
 *   `modelId`   a neutral id from `MODEL_REGISTRY`. Omitted -> the registry default.
 *   `maxTokens` a positive integer cap on the reply. Omitted -> the provider's own.
 *
 * The ComfyUI backend is deliberately NOT reachable here: it runs as a queued
 * ComfyUI job through the existing `promptEnhance` operation, which the renderer
 * already knows how to dispatch. Routing it through this process would mean a
 * second dispatch path to the same engine.
 */
router.post('/llm/enhance', async (req, res) => {
    const { prompt, system, backend: asked, modelId, maxTokens: askedMax, profileId } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.json({ ok: false, error: 'Write a prompt first, then Enhance.' });
    }

    let backend;
    try {
        const { OllamaEngine, DeepInfraEngine, getModel, DEFAULT_MODEL_ID, ollamaTagged, modelName, resolveConnection, recommendedModel } = await engines();

        // ── Endpoint branch (MPI-737): raw modelId, no MODEL_REGISTRY lookup ────
        if (asked === 'endpoint') {
            if (!profileId || typeof profileId !== 'string') {
                return res.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'profileId is required for backend:endpoint.' } });
            }
            const { profile, key } = await resolveConnection(profileId, ask);
            if (!profile || !profile.baseURL) return void _connectionError(res, 'NO_PROFILE', 'Connection not found, or it has no base URL.');
            if (!key && profileId !== 'ollama') return void _connectionError(res, 'NO_KEY', 'No API key saved for this connection.');
            // No pick yet -> the connection's recommended enhancer (exact ids per preset).
            const model = (typeof modelId === 'string' && modelId) || recommendedModel(profileId, 'enhance');
            if (!model) {
                return res.json({ ok: false, error: { code: 'BAD_REQUEST',
                    message: 'No enhancement model is picked for this connection. Pick one in Settings > Remote > Language Models.' } });
            }
            try {
                const engine = new DeepInfraEngine(key, profile.baseURL, profile);
                const maxTokens = Number.isInteger(askedMax) && askedMax > 0 ? askedMax : undefined;
                const result = await engine.complete(prompt, { model, system, maxTokens });
                return res.json({ ok: true, text: String(result.text || '').trim(), backend: result.backend, model: result.model });
            } catch (err) {
                logger.error('system', `llm enhance (endpoint) failed: ${err && err.message}`);
                return void _connectionError(res, 'ENDPOINT_ERROR', (err && err.message) || 'Endpoint enhance failed.', err && err.status);
            }
        }
        // ── End endpoint branch ──────────────────────────────────────────────────

        backend = asked === 'deepinfra' || asked === 'ollama' ? asked : await defaultBackend();

        const entry = getModel(modelId || DEFAULT_MODEL_ID);
        if (!entry) return res.json({ ok: false, error: `Unknown model id: ${modelId}` });
        // Backend coverage is asymmetric ON PURPOSE — abliterated builds exist
        // only locally — so a valid id can
        // still be unreachable on the chosen backend. Say which, rather than
        // letting `model: undefined` reach the wire.
        const model = backend === 'deepinfra' ? entry.deepInfraId : entry.ollamaName;
        if (!model) return res.json({ ok: false, error: `"${entry.name}" has no ${backend} variant.` });
        const name = modelName(entry, backend);

        if (backend === 'ollama') {
            // MPI-728 phase 3: a stopped Ollama is STARTED here, not reported. Starting
            // an app the user already installed asks nothing of them (Cubric Prompt's
            // MPI-8 ruling). Installing it, or downloading a multi-GB model, never
            // happens from an enhance: both are the user's own click in the settings.
            const status = await ollamaLifecycle.ensureOllama();
            if (status === 'missing') {
                return res.json({ ok: false, error: 'Ollama is not installed. Install it in Remote → Language Models, or pick another backend there.' });
            }
            if (status === 'failed') {
                return res.json({ ok: false, error: 'Ollama is installed but did not start. Start it yourself, or pick another backend in Remote → Language Models.' });
            }
            // Without this the user gets Ollama's own `404 Not Found`, which names nothing.
            if (!(await new OllamaEngine().listModels()).includes(ollamaTagged(model))) {
                return res.json({ ok: false, error: `${name} is not downloaded in Ollama yet. Download it in Remote → Language Models.` });
            }
        }

        const engine = backend === 'deepinfra'
            ? new DeepInfraEngine(await deepInfraKey())
            : new OllamaEngine();
        // A flow's token cap travels here (`Input_Text_Gen.max_length`, MPI-677): Music
        // Maker's 800 guards against a measured runaway repetition loop. Anything that
        // is not a positive integer is no cap, never a zero-length reply.
        const maxTokens = Number.isInteger(askedMax) && askedMax > 0 ? askedMax : undefined;
        const result = await engine.complete(prompt, { model, system, maxTokens });

        // `result.backend` / `result.model`, not the variables above: the engine
        // reports what actually answered.
        res.json({
            ok: true,
            text: String(result.text || '').trim(),
            backend: result.backend,
            model: result.model,
        });
    } catch (err) {
        logger.error('system', `llm enhance failed: ${err && err.message}`);
        res.json({ ok: false, error: (err && err.message) || 'Enhance failed.' });
    } finally {
        // MPI-14's rule, now on Vision's side of it: a local LLM must not sit on
        // VRAM the generator is about to want. Measured on a 16GB card — an idle
        // LLM alongside a video generation took a sub-10s render past 3 minutes,
        // because once VRAM is exhausted every token crosses PCIe. `keep_alive:0`
        // on EVERY exit path, failures included. The cloud backend holds no local
        // VRAM, so the `releaseOwnModels()` call below is skipped there.
        if (backend === 'ollama') {
            try {
                const { OllamaEngine } = await engines();
                await new OllamaEngine().releaseOwnModels();
            } catch { /* server gone / already empty — nothing was held either way */ }
        }
    }
});

// ── Image description via a remote vision model (MPI-737) ──────────────────
//
// Reads the default instruction from the shipped ComfyUI workflow at runtime so
// the system prompt stays in sync with the local ComfyUI describe path.  The
// node 41 resize (1 MP, 16-px steps, nearest-exact) is matched here so that
// mapFromDescribeSpace coordinate mapping stays valid when coordinates land.

/** Path to the workflow that carries the default describe instruction. */
const IMAGE_DESCRIPTOR_WORKFLOW = path.join(__dirname, '..', 'comfy_workflows', 'image_descriptor.json');

/** Node ID for Input_Describe_Prompt inside image_descriptor.json. */
const DESCRIBE_PROMPT_NODE = '38';

/** Maximum total pixels to send to a vision model — 1 MP, matching node 41. */
const DESCRIBE_MAX_PIXELS = 1_000_000;

/** Resize step in pixels — must match node 41's resolution_steps:16. */
const DESCRIBE_STEP = 16;

/**
 * Parse the ChatML in image_descriptor.json node 38 into { system, userText }.
 * The full ChatML is a ComfyUI-only construct: we extract the plain-text parts.
 * Returns null if the node is absent or the value is unparseable.
 */
function _parseDescribePrompt() {
    try {
        const wf = JSON.parse(fs.readFileSync(IMAGE_DESCRIPTOR_WORKFLOW, 'utf8'));
        const value = wf[DESCRIBE_PROMPT_NODE]?.inputs?.value;
        if (typeof value !== 'string') return null;
        // Extract system content: between <|im_start|>system\n and first <|im_end|>
        const sysMatch = value.match(/<\|im_start\|>system\n([\s\S]*?)<\|im_end\|>/);
        const system = sysMatch ? sysMatch[1].trim() : null;
        // Extract user text: last <|im_start|>user\n block, strip vision markers, trim
        const userMatch = value.match(/<\|im_start\|>user\n([\s\S]*?)<\|im_end\|>/);
        const rawUser = userMatch ? userMatch[1] : '';
        // Remove ComfyUI vision markers (not sent to OpenAI-compatible endpoints)
        const userText = rawUser.replace(/<\|vision_start\|>.*?<\|vision_end\|>/gs, '').trim();
        return { system, userText };
    } catch {
        return null;
    }
}

/**
 * POST /llm/describe — describe an image using the configured remote vision model.
 *
 * body: { profileId, modelId, imagePath, question?, crop? }
 *   `profileId`  connection preset id ('deepinfra', 'openrouter', …)
 *   `modelId`    raw endpoint model id (e.g. 'meta-llama/Llama-4-Scout-17B-16E-Instruct')
 *   `imagePath`  absolute path to the source image on disk
 *   `question`   optional: replaces the default instruction as plain text
 *   `crop`       optional: { x, y, width, height } in source pixels
 *
 * Returns: { ok:true, text, backend, model }
 * Errors:  { ok:false, error:{ code, message } }
 *   BAD_REQUEST   — missing required field or invalid crop object
 *   NO_PROFILE    — profileId not found or has no base URL
 *   NO_KEY        — key required but not stored
 *   BAD_IMAGE     — file not found, unreadable, or crop out of bounds
 *   NOT_VISION    — endpoint returned 4xx indicating the model rejects images
 *   ENDPOINT_ERROR — any other upstream failure
 */
router.post('/llm/describe', async (req, res) => {
    const { profileId, modelId, imagePath, question, crop } = req.body || {};

    if (!profileId || typeof profileId !== 'string') {
        return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'profileId is required.' } });
    }
    if (modelId !== undefined && (!modelId || typeof modelId !== 'string')) {
        return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'modelId must be a non-empty string.' } });
    }
    if (!imagePath || typeof imagePath !== 'string') {
        return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'imagePath is required.' } });
    }

    // Validate crop fields when provided (same rules as POST /connector/describe).
    if (crop !== undefined) {
        if (!crop || typeof crop !== 'object') {
            return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'crop must be an object {x,y,width,height}.' } });
        }
        const { x, y, width, height } = crop;
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)
                || width <= 0 || height <= 0) {
            return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'crop.x/y/width/height must be finite numbers; width/height must be positive.' } });
        }
    }

    // ── Resolve connection ────────────────────────────────────────────────────
    const { resolveConnection, DeepInfraEngine, recommendedModel } = await engines();
    const { profile, key } = await resolveConnection(profileId, ask);
    if (!profile || !profile.baseURL) return void _connectionError(res, 'NO_PROFILE', 'Connection not found, or it has no base URL.');
    if (!key && profileId !== 'ollama') return void _connectionError(res, 'NO_KEY', 'No API key saved for this connection.');
    // No pick yet -> the connection's recommended describer (exact ids per preset).
    const model = modelId || recommendedModel(profileId, 'describe');
    if (!model) {
        return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST',
            message: 'No image-description model is picked for this connection. Pick one in Settings > Remote > Language Models.' } });
    }

    // ── Read and pre-process the image ───────────────────────────────────────
    // The gallery right-click sends an item's `/project-file?path=` URL; the agent's
    // `look` sends an absolute path. Anything else (a relative path) is refused.
    // ponytail: same decode as routes/projects.js pathFromProjectFileUrl (not exported;
    // gif.js and gifMake.js carry copies too) - one shared helper if a fifth appears.
    const pathMatch = imagePath.match(/[?&]path=([^&]+)/);
    const srcPath = pathMatch ? decodeURIComponent(pathMatch[1]) : imagePath;
    if (!path.isAbsolute(srcPath) || !fs.existsSync(srcPath)) {
        return res.json({ ok: false, error: { code: 'BAD_IMAGE', message: `File not found: ${srcPath}` } });
    }

    let imgBuffer;
    try {
        const sharp = _getSharp();
        let pipeline = sharp(srcPath);

        // Apply crop if given (validate out-of-bounds here where we have dimensions).
        if (crop) {
            const meta = await sharp(srcPath).metadata();
            const srcW = meta.width || 0;
            const srcH = meta.height || 0;
            const { x, y, width, height } = crop;
            if (x < 0 || y < 0 || x + width > srcW || y + height > srcH) {
                return res.json({ ok: false, error: { code: 'BAD_IMAGE',
                    message: `crop (${x},${y},${width},${height}) extends outside image (${srcW}x${srcH}).` } });
            }
            pipeline = sharp(srcPath).extract({
                left: Math.round(x), top: Math.round(y),
                width: Math.round(width), height: Math.round(height),
            });
        }

        // Get post-crop dimensions for the downscale calculation.
        const { data: rawBuf, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
        const srcW = info.width;
        const srcH = info.height;

        // Downscale to ≤ 1 MP in 16-px steps (nearest-exact), matching node 41.
        // Only downscale; images already within the limit are kept at native size.
        // Uses floor (not round) so the product is guaranteed ≤ DESCRIBE_MAX_PIXELS
        // after rounding, keeping mapFromDescribeSpace coordinate mapping valid.
        let resizePipeline = sharp(rawBuf, { raw: { width: srcW, height: srcH, channels: info.channels } });
        if (srcW * srcH > DESCRIBE_MAX_PIXELS) {
            const scale = Math.sqrt(DESCRIBE_MAX_PIXELS / (srcW * srcH));
            const newW = Math.max(DESCRIBE_STEP, Math.floor(srcW * scale / DESCRIBE_STEP) * DESCRIBE_STEP);
            const newH = Math.max(DESCRIBE_STEP, Math.floor(srcH * scale / DESCRIBE_STEP) * DESCRIBE_STEP);
            resizePipeline = resizePipeline.resize(newW, newH, { fit: 'fill', kernel: 'nearest' });
        }
        imgBuffer = await resizePipeline.jpeg({ quality: 85 }).toBuffer();
    } catch (err) {
        logger.error('system', `llm describe image processing failed: ${err && err.message}`);
        return res.json({ ok: false, error: { code: 'BAD_IMAGE', message: `Image could not be read: ${err && err.message}` } });
    }

    // ── Build the chat messages ───────────────────────────────────────────────
    const b64 = imgBuffer.toString('base64');
    const imageContentPart = { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } };

    let messages;
    if (question) {
        // A question replaces the default instruction as plain text (no ChatML wrapping).
        messages = [{ role: 'user', content: [imageContentPart, { type: 'text', text: question }] }];
    } else {
        // Default: extract system + user text from image_descriptor.json node 38 at runtime.
        // No copied fallback: a shipped graph that stops parsing must fail loudly,
        // not drift away from the ComfyUI describer unnoticed.
        const parsed = _parseDescribePrompt();
        if (!parsed?.system || !parsed.userText) {
            logger.error('system', 'llm describe: image_descriptor.json node 38 did not parse');
            return res.status(500).json({ ok: false, error: { code: 'RUNTIME_ERROR',
                message: 'The describe instruction (image_descriptor.json node 38) is missing or unreadable.' } });
        }
        messages = [
            { role: 'system', content: parsed.system },
            { role: 'user', content: [imageContentPart, { type: 'text', text: parsed.userText }] },
        ];
    }

    // ── Call the vision model ─────────────────────────────────────────────────
    try {
        const engine = new DeepInfraEngine(key, profile.baseURL, profile);
        const data = await engine.chat({ model, messages });
        res.json({ ok: true, text: String(data.text || '').trim(), backend: data.backend, model: data.model });
    } catch (err) {
        // A 4xx that names image/vision input means the model is not a vision model.
        if (err.status >= 400 && err.status < 500) {
            const detail = (err.bodyText || err.message || '').toLowerCase();
            if (detail.includes('image') || detail.includes('vision') || detail.includes('visual') || detail.includes('multimodal')) {
                return void _connectionError(res, 'NOT_VISION', 'This model does not accept image input. Pick a vision-capable model.');
            }
        }
        logger.error('system', `llm describe failed: ${err && err.message}`);
        return void _connectionError(res, 'ENDPOINT_ERROR', (err && err.message) || 'Describe failed.', err && err.status);
    }
});

module.exports = router;
module.exports.defaultBackend = defaultBackend;
