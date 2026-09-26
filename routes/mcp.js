'use strict';

/**
 * routes/mcp.js — Cubric Studio as an MCP server for OUTSIDE agents (MPI-593).
 *
 * Streamable HTTP in its smallest legal form: stateless, JSON responses only, no SSE and no
 * sessions. `POST /mcp` takes one JSON-RPC message and answers it. Claude Code, Codex and
 * Gemini CLI connect to it by URL; Claude Desktop cannot (its extensions speak stdio only),
 * so it reaches this same endpoint through the bridge in `mcp/cubric-studio/`.
 *
 * Every tool is a thin call to one connector route through `services/agentTools.mjs`, the
 * client the in-app agent already uses. There is deliberately no second dispatch path
 * (`routes/connector.js` header). The catalogue is shrunk by the same `compactCatalogue`
 * the in-app agent reads, because the raw list is ~9.5k tokens.
 *
 * MPI-593 phase 2: seventeen tools, none that deletes or installs. The in-app agent's gates live in `agentLoop._executeTool`, not
 * in the routes, so this file carries its own spend gate (`spendGate`). The guide gate is only
 * an instruction here (read_knowledge); the mask gate does not apply.
 *
 * `routes/localOnly.js` runs first, so a browser page cannot reach this; Node, Rust and
 * Python clients send no Origin and pass on Host alone.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const logger = require('./logger');
const { extractImageThumb, extractVideoThumb } = require('../services/ffmpegThumb');
const { viewFile, isViewable } = require('../services/cardView');
const { version } = require('../package.json');

const router = express.Router();

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];

// Most MCP clients give a tool call 60 s (Claude Code, Codex, the TS SDK). The spike's cold
// agent waited on a 2K render that took 73 s, was told it failed, and ran it AGAIN while the
// first one landed: two images for one ask, and on a paid model two bills. So a generation
// answers within this window, and one still running hands back a jobId to wait on instead.
const WAIT_MS = Number(process.env.CUBRIC_MCP_WAIT_MS) || 45_000;
const _jobs = new Map(); // jobId -> { done: promise of the answer (never rejects), stoppedBy }
// JSON-RPC id of an in-flight generate / wait_generation call -> its jobId, so Stop in the
// chat (`notifications/cancelled`) can name the render. ponytail: keyed by the bare rpc id
// because this server is stateless; two clients with the same id in flight at once would
// cross. Per-client sessions are the upgrade if that ever happens.
const _inflight = new Map();

/**
 * A tool call blocks the chat (Fabio, Claude Desktop, 2026-09-25): generate plus chained
 * wait_generation calls held Claude silent through a whole video render, and Stop in the
 * APP was the only way out. So the job is submitted under its own jobId as the connector's
 * `requestId`, which is what `/connector/cancel` names.
 */
function startJob(send) {
    const jobId = crypto.randomUUID();
    const job = { stoppedBy: null };
    job.done = send(jobId)
        .catch((err) => ({ ok: false, error: { code: 'FAILED', message: err.message } }))
        .then((r) => present(r, job));
    _jobs.set(jobId, job);
    // ponytail: in memory, gone on restart; the card is in the gallery either way.
    setTimeout(() => _jobs.delete(jobId), 3_600_000).unref();
    return jobId;
}

const STOPPED = {
    agent: 'Cancelled by cancel_generation, as asked. Nothing was made.',
    chat: 'Cancelled: the user pressed Stop in the chat, so the render was stopped. Nothing was made.',
    app: 'The user stopped this render in the Cubric Studio app (or it produced no output). Nothing was made. Do not run it again unless the user asks.',
};

/**
 * Shape a finished answer for an outside agent: the real path on disk (not the renderer's
 * `/project-file?path=` URL, which nothing outside the app can open) and a small picture of
 * the result, so a vision model sees what it made. Cold test 2: "couldn't open the file
 * myself, so I haven't seen it".
 */
async function present(r, job) {
    if (r?.error?.code === 'CANCELLED') return { ...r, error: { ...r.error, message: STOPPED[job.stoppedBy || 'app'] } };
    const out = r?.output;
    if (!r?.ok || typeof out?.filePath !== 'string') return r;
    const filePath = diskPath(out.filePath);
    const image = out.type === 'image' || out.type === 'video' ? await thumbnail(filePath, out.itemId, out.type) : null;
    return { ...r, output: { ...out, filePath }, ...(image ? { _image: image } : {}) };
}

function diskPath(p) {
    try {
        const u = new URL(p, 'http://127.0.0.1');
        return u.pathname === '/project-file' && u.searchParams.get('path') ? path.normalize(u.searchParams.get('path')) : p;
    } catch {
        return p;
    }
}

/** The gallery's own 512px `.thumb.webp` (a video's is its first frame), else one made now. */
async function thumbnail(file, itemId, type) {
    try {
        const own = path.join(path.dirname(file), '.meta', `${itemId}.thumb.webp`);
        if (itemId && fs.existsSync(own)) return (await fs.promises.readFile(own)).toString('base64');
        const made = await (type === 'video' ? extractVideoThumb : extractImageThumb)(file, path.join(os.tmpdir(), `cubric-mcp-${crypto.randomUUID()}.webp`));
        if (!made) return null;
        const data = (await fs.promises.readFile(made)).toString('base64');
        fs.promises.unlink(made).catch(() => {});
        return data;
    } catch {
        return null; // the path is still in the answer; a missing picture is not a failed run
    }
}

async function stopJob(jobId, by) {
    const job = _jobs.get(jobId);
    if (!job) return { ok: false, error: { code: 'UNKNOWN_JOB', message: `No generation "${jobId}" here. Its card may already be in the gallery.` } };
    job.stoppedBy ??= by;
    const r = await (await tools()).cancelGeneration(jobId);
    if (r?.ok) return { ok: true, cancelled: true, message: 'Cancelled. Nothing was made.' };
    if (job.stoppedBy === by) job.stoppedBy = null; // too late: it finished, so it was not stopped
    return r;
}

/**
 * The spend gate for outside agents. The in-app agent asks with a Yes card
 * (`agentLoop._askSpend`); an outside agent's chat is the only place to ask, so a billed run
 * is refused until the call carries the price `/connector/quote` returned. The agent has to
 * say the price before it can spend it. Local models and Flows never bill, so they never ask.
 * ponytail: an agent that invents confirmCost gets through, and the client's approval prompt
 * does show that argument. A confirm in the app window is the upgrade if this is not enough.
 * @returns {Promise<object|null>} the refusal, or null to go ahead
 */
async function spendGate(t, body, confirmCost) {
    let quote = null;
    try {
        const r = await t.quoteGeneration(body);
        if (r?.ok && r.output?.billed) quote = r.output;
    } catch {
        // An app that cannot quote cannot generate either: the submit fails the same way.
    }
    if (!quote) return null;
    // `display` carries its own "about"; null means the model bills but its price is unknowable.
    const price = quote.display || 'price unknown';
    if (confirmCost === price) return null;
    return {
        ok: false,
        error: {
            code: 'CONFIRM_COST',
            message: `${confirmCost ? 'confirmCost does not match the current price. ' : ''}Nothing was generated. ${quote.modelName} is a paid model: this run costs ${quote.display || 'an amount it cannot know until it runs'}. Tell the user that price and ask. Only if they say yes, send the same generate again with confirmCost: "${price}".`,
        },
        price,
        modelName: quote.modelName,
    };
}

/**
 * The project the app window has open, asked fresh each time: the user can switch it in the
 * app between two calls, and a reference image must be staged INTO the project the render
 * lands in (a Reuse of the card resolves it from there).
 * @returns {Promise<{folder: string}|{error: object}>}
 */
async function openFolder(t) {
    const r = await t.currentProject();
    if (r?.ok && r.output?.folderPath) return { folder: r.output.folderPath };
    if (r?.error?.code && r.error.code !== 'NO_PROJECT') return { error: r };
    return { error: { ok: false, error: { code: 'NO_PROJECT', message: 'No project is open in the app. open_project with a folderPath from list_projects, or create_project, then try again.' } } };
}

// What a model can take as a reference. Anything else fails inside the engine, far from here.
const MEDIA_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.mp4', '.webm', '.mov', '.mkv', '.wav', '.mp3', '.flac', '.ogg', '.m4a']);

/**
 * `media: [{ role, path }]` -> the `[{ role, url }]` a generation takes. A file already in the
 * open project's `Media/` (a card's own) is passed as it is; any other file on the user's disk
 * is copied into the project's content-addressed store first (`placeAsset`), as the in-app
 * agent does with an attachment. Media reaches a render by reference, never as bytes.
 * @returns {Promise<{media: Array}|{error: object}>}
 */
async function stageMedia(t, media) {
    const open = await openFolder(t);
    if (open.error) return open;
    const own = path.join(open.folder, 'Media');
    const out = [];
    for (const m of media) {
        const file = typeof m?.path === 'string' ? path.resolve(m.path) : '';
        const fail = (code, message) => ({ error: { ok: false, error: { code, message: `Nothing was generated: ${message}` } } });
        if (!m?.role) return fail('BAD_REQUEST', 'every media item needs a role, from describe_model.');
        if (!MEDIA_EXT.has(path.extname(file).toLowerCase())) return fail('UNSUPPORTED_FILE', `"${m.path}" is not an image, video or audio file.`);
        if (!fs.existsSync(file)) return fail('FILE_NOT_FOUND', `no file at "${m.path}". Use a path from list_cards, from a generate result, or one the user gave.`);
        if (path.dirname(file) === own) {
            out.push({ role: m.role, url: `/project-file?path=${encodeURIComponent(file)}` });
            continue;
        }
        const placed = await t.placeAsset(open.folder, file);
        if (!placed?.success || !placed.filePath) return fail('RUNTIME_ERROR', `could not copy "${m.path}" into the project: ${placed?.error || 'unknown error'}.`);
        out.push({ role: m.role, url: placed.filePath });
    }
    return { media: out };
}

/** A card row as an outside agent can use it: the file's disk path and item id in place of the in-app `ref`. */
function withPath(files, row) {
    const { ref, ...rest } = row || {};
    const f = files?.[ref];
    return { ...rest, ...(f ? { path: f.path, ...(f.itemId ? { itemId: f.itemId } : {}) } : {}) };
}

/** The GIF verbs answer when the work is done; a cut-out is a GPU run of minutes, so each is a job like a render. */
const gifJob = (verb) => async (args, rpcKey) => {
    const t = await tools();
    return waitForJob(startJob(() => t[verb](args)), rpcKey);
};

const RUNNING = 'Do NOT call generate again: that makes a second one. cancel_generation stops it.';

/** Up to `ms` for the answer, else `running`. `rpcKey` lets Stop in the chat find the job. */
async function waitForJob(jobId, rpcKey, ms = WAIT_MS) {
    const job = _jobs.get(jobId);
    if (!job) return { ok: false, error: { code: 'UNKNOWN_JOB', message: `No generation "${jobId}" is running here. Its card may already be in the gallery.` } };
    if (rpcKey !== undefined) _inflight.set(rpcKey, jobId);
    let timer;
    const late = new Promise((resolve) => { timer = setTimeout(resolve, ms, null); });
    try {
        return (await Promise.race([job.done, late])) ?? {
            ok: true, running: true, jobId,
            message: `Still running. Tell the user, and call wait_generation with this jobId when they ask or you need the result. ${RUNNING}`,
        };
    } finally {
        clearTimeout(timer);
        if (rpcKey !== undefined) _inflight.delete(rpcKey);
    }
}

const INSTRUCTIONS = [
    'Cubric Studio is a desktop app for making images and video on this computer. These tools drive the copy the user has open.',
    'A generation lands in the project the app has OPEN. Before generating, find the project with list_projects and call open_project, or call create_project (it opens what it makes).',
    'Pick a model with list_models (the op marked best:true is the recommended one for its task), then call describe_model for that id: it lists the ops and the only values each param accepts.',
    'Before you write the first prompt for a model, call read_knowledge with each guide id describe_model lists for it: the guide says how that model wants to be prompted.',
    'generate returns the result\'s file path on disk, its card id and a small picture of it, so you can see what you made. A video or a Flow returns { running: true, jobId } at once instead: tell the user it started, then END YOUR TURN so they can keep talking; call wait_generation when they ask whether it is done. An image slower than 45 s returns running too. Never re-send generate for a job that is still running, and call cancel_generation if the user wants it stopped. The card also appears in the app\'s gallery.',
    'An image the user attaches in this chat never reaches the app as a file. To edit, animate or reference a picture, pass generate media: [{ role, path }]: the role from describe_model, the path of a card (list_cards gives each card\'s path) or of a file on the user\'s disk. A file from outside the project is copied into it first.',
    'A video result carries only its first frame. To see a whole clip, a GIF, or any card larger, call view_card with its path.',
    'Paid cloud models cost the user real money. generate answers CONFIRM_COST with the price and makes nothing: tell the user the price and ask. Only if they say yes, resend with confirmCost. Never confirm on their behalf.',
    'When you show the user a prompt, hand it back whole and pasteable, never as fragments.',
].join('\n');

let _tools = null;
let _catalogue = null;
const tools = () => (_tools ??= import('../services/agentTools.mjs'));
const catalogue = () => (_catalogue ??= import('../services/agentLoop.mjs'));

const obj = (properties = {}, required = []) => ({ type: 'object', properties, required });
const READ = { readOnlyHint: true, openWorldHint: false };

/** name -> { description, inputSchema, annotations, run(args) -> route answer } */
const TOOLS = {
    status: {
        title: 'App status',
        description: 'Is Cubric Studio open and ready to generate? Call this first when anything fails.',
        inputSchema: obj(),
        annotations: READ,
        run: async () => {
            const port = process.env.CUBRIC_PORT || 3000;
            const r = await fetch(`http://127.0.0.1:${port}/connector/capabilities`, { signal: AbortSignal.timeout(10_000) }).then((x) => x.json());
            return r.generationSubmit
                ? { ok: true, ready: true, version }
                : { ok: true, ready: false, version, message: 'The app is running but its window is not ready. Ask the user to open or restore the Cubric Studio window.' };
        },
    },
    list_models: {
        title: 'List models',
        description: 'Every model and Flow the app offers: id, what is installed, the ops each model runs and their rank per task. Settings are NOT here; describe_model has them.',
        inputSchema: obj(),
        annotations: READ,
        run: async () => (await catalogue()).compactCatalogue(await (await tools()).listModels()),
    },
    describe_model: {
        title: 'Describe a model',
        description: 'One model or Flow in full: its ops, each op\'s params and the only values they accept, media roles, and a Flow\'s fields.',
        inputSchema: obj({ id: { type: 'string', description: 'A model or Flow id exactly as list_models gives it.' } }, ['id']),
        annotations: READ,
        run: async ({ id }) => {
            const r = await (await tools()).listModels();
            if (!r?.ok) return r;
            const entry = (await catalogue()).catalogueEntry(r, id);
            return entry
                ? { ok: true, ...entry }
                : { ok: false, error: { code: 'UNKNOWN_MODEL', message: `No model or Flow "${id}". Use an id exactly as list_models gives it.` } };
        },
    },
    list_projects: {
        title: 'List projects',
        description: 'The user\'s projects, most recent first, each with the folderPath open_project takes.',
        inputSchema: obj(),
        annotations: READ,
        run: async () => (await tools()).listProjects(),
    },
    create_project: {
        title: 'Create project',
        description: 'Create a project and open it, so the next generation lands there. Returns the existing one if that name is taken.',
        inputSchema: obj({ name: { type: 'string' } }, ['name']),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        run: async ({ name }) => {
            const t = await tools();
            const r = await t.createProject(name);
            if (!r?.ok || !r.project?.folderPath) return r;
            return { ...r, opened: (await t.openProject(r.project.folderPath))?.ok === true };
        },
    },
    open_project: {
        title: 'Open project',
        description: 'Make a project the open one, so the next generation lands in it.',
        inputSchema: obj({ folderPath: { type: 'string', description: 'From list_projects or create_project.' } }, ['folderPath']),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        run: async ({ folderPath }) => (await tools()).openProject(folderPath),
    },
    list_cards: {
        title: 'List cards',
        description: 'What the open project already holds. No groupId: the newest cards, one short row each (name, kind, model, size, the start of its prompt, and its file path on disk). A groupId: that card in full, with the whole prompt, the settings that ran and madeFrom. A card\'s path is what generate takes as media; its itemId is what the GIF tools take.',
        inputSchema: obj({
            groupId: { type: 'string', description: 'One card, from a row here or a generate result.' },
            limit: { type: 'integer', description: 'How many rows, newest first. Default 12, at most 30.' },
            mark: { type: 'string', enum: ['dot', 'square', 'triangle'], description: 'Only cards with this mark.' },
        }),
        annotations: READ,
        run: async ({ groupId, limit, mark }) => {
            const t = await tools();
            const open = await openFolder(t);
            if (open.error) return open.error;
            const r = await t.listCards(open.folder, groupId, limit, mark);
            if (!r?.ok) return r;
            const { files, cards, card, ...rest } = r;
            return card
                ? { ...rest, card: { ...withPath(files, card), madeFrom: (card.madeFrom || []).map((m) => withPath(files, m)) } }
                : { ...rest, cards: (cards || []).map((c) => withPath(files, c)) };
        },
    },
    view_card: {
        title: 'View a card',
        description: 'Look at an image or video: a still comes back as a picture up to 1024px; a video or GIF as ONE contact sheet of frames spread across the clip, left to right then top to bottom, with each frame\'s time. Use it to judge motion, check a result, or see a card you did not make. Sound is not included.',
        inputSchema: obj({
            path: { type: 'string', description: 'A file on disk: a card\'s path from list_cards or a generate result, or an image or video the user named.' },
            frames: { type: 'integer', description: 'Video only: how many frames, 2-12. Default 6.' },
        }, ['path']),
        annotations: READ,
        run: async ({ path: p, frames }) => {
            const file = typeof p === 'string' ? path.resolve(p) : '';
            if (!isViewable(file)) return { ok: false, error: { code: 'UNSUPPORTED_FILE', message: `"${p}" is not an image, video or GIF.` } };
            if (!fs.existsSync(file)) return { ok: false, error: { code: 'FILE_NOT_FOUND', message: `No file at "${p}".` } };
            const v = await viewFile(file, { frames });
            const info = v.kind === 'image'
                ? { ok: true, kind: 'image', width: v.width, height: v.height }
                : {
                    ok: true, kind: 'video', width: v.width, height: v.height, durationSeconds: v.duration, hasAudio: v.hasAudio,
                    sheet: `${v.times.length} frames, ${v.columns} per row, left to right then top to bottom, at ${v.times.map((s) => `${s}s`).join(', ')}.${v.hasAudio ? ' The clip has sound, which you cannot hear here.' : ''}`,
                };
            return { ...info, _image: v.data.toString('base64') };
        },
    },
    rename_card: {
        title: 'Rename card',
        description: 'Give a card in the open project a name the user will recognise, in place of a generated one like t2i_004.',
        inputSchema: obj({ groupId: { type: 'string' }, name: { type: 'string' } }, ['groupId', 'name']),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        run: async ({ groupId, name }) => (await tools()).renameCard(groupId, name),
    },
    generate: {
        title: 'Generate',
        description: 'Generate an image or video with a model op, or run a Flow, in the OPEN project. Send modelId + operation, or flowId, never both. Named params take only the values describe_model lists. Returns the file path on disk plus a picture of the result. A video or Flow, or an image slower than 45 s, returns { running: true, jobId } instead: tell the user and end your turn, then call wait_generation when asked, never generate again. A paid model first answers CONFIRM_COST with its price and generates nothing.',
        inputSchema: {
            type: 'object',
            properties: {
                modelId: { type: 'string' },
                operation: { type: 'string', description: 'An op id from describe_model, e.g. t2i.' },
                flowId: { type: 'string' },
                positive: { type: 'string', description: 'The prompt.' },
                negative: { type: 'string' },
                ratio: { type: 'string', description: 'e.g. 1:1, 16:9, 9:16.' },
                qualityTier: { type: 'string' },
                turbo: { type: 'boolean' },
                duration: { type: 'number', description: 'Video ops only, in seconds.' },
                styleSelect: { type: 'string' },
                seed: { type: 'integer' },
                denoise: { type: 'number', description: 'Only on an op whose params list it (i2i, upscale, detail): 0 to 1, higher changes more.' },
                cardName: { type: 'string', description: 'A short name for the gallery card this creates.' },
                media: {
                    type: 'array',
                    description: 'The pictures, clips or sounds the op starts from: an edit, image-to-image, image-to-video, a reference. describe_model lists each op\'s roles.',
                    items: obj({
                        role: { type: 'string', description: 'A media role describe_model lists for this op.' },
                        path: { type: 'string', description: 'A file on disk: a card\'s path from list_cards or a generate result, or any image, video or audio file the user named.' },
                    }, ['role', 'path']),
                },
                fields: { type: 'object', description: 'A Flow\'s field values, as describe_model lists them.' },
                params: { type: 'object', description: 'A Flow\'s step params, as describe_model lists them.' },
                confirmCost: { type: 'string', description: 'Only after the user agreed to the price a CONFIRM_COST answer named: that price, exactly as given.' },
            },
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
        run: async ({ confirmCost, media, ...body }, rpcKey) => {
            const t = await tools();
            if (Array.isArray(media) && media.length) {
                const staged = await stageMedia(t, media);
                if (staged.error) return staged.error;
                body.media = staged.media;
            }
            const refused = await spendGate(t, body, confirmCost);
            if (refused) return refused;
            const slow = !!body.flowId || (await t.listModels())?.models?.find((m) => m.id === body.modelId)?.type === 'video';
            const jobId = startJob((id) => t.generate({ ...body, requestId: id }));
            if (!slow) return waitForJob(jobId, rpcKey);
            // A few seconds still catch a bad param or a full queue before the agent moves on.
            const r = await waitForJob(jobId, rpcKey, Math.min(WAIT_MS, 3_000));
            return r.running
                ? { ok: true, running: true, jobId, message: `Started. This takes minutes: tell the user it is running in Cubric Studio, then end your turn so they can keep talking. Call wait_generation with this jobId when they ask whether it is done. ${RUNNING}` }
                : r;
        },
    },
    wait_generation: {
        title: 'Wait for a generation',
        description: 'Wait up to 45 s more for a generation that answered { running: true, jobId }. Answers running again if it is still going: tell the user rather than calling it in a loop.',
        inputSchema: obj({ jobId: { type: 'string' } }, ['jobId']),
        annotations: READ,
        run: async ({ jobId }, rpcKey) => waitForJob(jobId, rpcKey),
    },
    cancel_generation: {
        title: 'Cancel a generation',
        description: 'Stop a generation that answered { running: true, jobId }, whether it is rendering or still queued. Only when the user asks.',
        inputSchema: obj({ jobId: { type: 'string' } }, ['jobId']),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        run: async ({ jobId }) => stopJob(jobId, 'agent'),
    },
    read_knowledge: {
        title: 'Read a prompting guide',
        description: 'A prompting guide by id, as describe_model lists them under guides. With no id, the list of every guide.',
        inputSchema: obj({ id: { type: 'string' } }),
        annotations: READ,
        run: async ({ id }) => (await tools()).readKnowledge(id),
    },
    make_gif: {
        title: 'Make a GIF',
        description: 'A new GIF card in the open project, from two or more still cards (itemIds, in order) or from a clip of one video card (videoItemId + fps). Item ids come from list_cards.',
        inputSchema: obj({
            itemIds: { type: 'array', items: { type: 'string' }, description: 'Still cards, in play order. The first one\'s size wins.' },
            videoItemId: { type: 'string' },
            fps: { type: 'number', description: 'Required with videoItemId. 1-60.' },
            sizePreset: { type: 'string', enum: ['original', '480xauto', '320xauto', 'autox480', 'autox320'] },
            loop: { type: 'integer', description: 'Total plays. 0 = forever (default).' },
            trimIn: { type: 'number', description: 'Clip seconds, sent together with trimOut.' },
            trimOut: { type: 'number' },
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        run: gifJob('makeGif'),
    },
    edit_gif: {
        title: 'Edit a GIF',
        description: 'A new version on the same GIF card: trim (frame indices, inclusive), fps (0.1-50), loop, output { colours, edgeColour ("#rrggbb" = transparent, null = opaque), maxEdge }, resize { width, height } or crop { x, y, width, height }. crop and resize cannot share a call. The old version stays on the card.',
        inputSchema: obj({
            itemId: { type: 'string' },
            trim: obj({ in: { type: 'integer' }, out: { type: 'integer' } }),
            fps: { type: 'number' },
            loop: { type: 'integer' },
            output: { type: 'object' },
            resize: { type: 'object' },
            crop: { type: 'object' },
        }, ['itemId']),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        run: gifJob('editGif'),
    },
    cutout_gif: {
        title: 'Cut out a GIF subject',
        description: 'Cut the subject out of every frame onto transparency, as a new version on the same card. method "background" (BiRefNet, no prompt) or "name" (SAM3 tracks what prompt names; it keeps every object it tracks). adjust { grow, outward, inward, edge, fillHoles }, invert. Runs on the GPU and can take minutes: it may answer { running: true, jobId }.',
        inputSchema: obj({
            itemId: { type: 'string' },
            method: { type: 'string', enum: ['background', 'name'] },
            prompt: { type: 'string', description: 'What to keep, for method "name".' },
            adjust: { type: 'object' },
            invert: { type: 'boolean' },
        }, ['itemId', 'method']),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        run: gifJob('cutoutGif'),
    },
    gif_to_video: {
        title: 'GIF to video',
        description: 'A new video card made from a GIF card; the GIF stays. background ("#rrggbb") fills what a transparent GIF leaves clear, or it plays on black.',
        inputSchema: obj({ itemId: { type: 'string' }, background: { type: 'string' } }, ['itemId']),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        run: gifJob('gifToVideo'),
    },
};

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function callTool(name, args, rpcKey) {
    const tool = TOOLS[name];
    if (!tool) return { isError: true, content: [{ type: 'text', text: `Unknown tool "${name}".` }] };
    try {
        const { _image, ...r } = (await tool.run(args || {}, rpcKey)) ?? {};
        return {
            isError: r.ok === false,
            content: [
                { type: 'text', text: JSON.stringify(r) },
                ...(_image ? [{ type: 'image', data: _image, mimeType: 'image/webp' }] : []),
            ],
        };
    } catch (err) {
        logger.warn('mcp', `${name} failed: ${err.message}`);
        return { isError: true, content: [{ type: 'text', text: `${name} failed: ${err.message}. Call status to check the app is open.` }] };
    }
}

router.post('/mcp', async (req, res) => {
    const msg = req.body;
    if (!msg || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
        return res.status(400).json(rpcError(msg?.id, -32600, 'One JSON-RPC 2.0 message per request.'));
    }
    // A notification (no id) gets no answer: 202, empty body. Stop in the chat arrives as
    // `notifications/cancelled` naming the blocked call; a render behind it stops too.
    if (msg.id === undefined) {
        const jobId = msg.method === 'notifications/cancelled' && _inflight.get(String(msg.params?.requestId));
        if (jobId) {
            logger.info('mcp', `chat cancelled call ${msg.params.requestId}: stopping job ${jobId}`);
            stopJob(jobId, 'chat')
                .then((r) => logger.info('mcp', `cancel ${jobId}: ${JSON.stringify(r)}`))
                .catch((err) => logger.warn('mcp', `cancel ${jobId} failed: ${err.message}`));
        }
        return res.status(202).end();
    }

    const { id, method, params } = msg;
    switch (method) {
        case 'initialize': {
            const asked = params?.protocolVersion;
            return res.json(rpcResult(id, {
                protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
                capabilities: { tools: {} },
                serverInfo: { name: 'cubric-studio', title: 'Cubric Studio', version },
                instructions: INSTRUCTIONS,
            }));
        }
        case 'ping':
            return res.json(rpcResult(id, {}));
        case 'tools/list':
            return res.json(rpcResult(id, {
                // `title` twice: top level is the 2025-06-18 field, `annotations.title` what older clients read.
                tools: Object.entries(TOOLS).map(([name, t]) => ({
                    name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: { title: t.title, ...t.annotations },
                })),
            }));
        case 'tools/call':
            logger.info('mcp', `tools/call ${params?.name}`);
            return res.json(rpcResult(id, await callTool(params?.name, params?.arguments, String(id))));
        default:
            return res.json(rpcError(id, -32601, `Method not found: ${method}`));
    }
});

// No server-initiated stream and no sessions to end: the spec's answer to both is 405.
router.get('/mcp', (_req, res) => res.status(405).end());
router.delete('/mcp', (_req, res) => res.status(405).end());

module.exports = router;
