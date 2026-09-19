/**
 * services/agentLoop.mjs — the in-app agent loop (MPI-774 slice A).
 *
 * One loop is one conversation, in server memory (brief item 14); `agentSessions.mjs`
 * keeps one per project and one for the landing page. The renderer re-renders from
 * GET /agent/history, so Landing → Gallery → History keeps the conversation. Nothing
 * is written to disk except the project notes (`agentMemory.mjs`).
 *
 * Design decisions (all Fabio-accepted, 2026-09-15):
 * - D2: install gate is structural (Yes / No card); the loop never calls install
 *   without a confirm.
 * - D3: replies arrive whole per model turn; token streaming is not in slice A.
 * - Non-blocking generate: the loop fires generate and gets back a "started"
 *   tool result; when the HTTP call settles, agent:result is emitted.
 * - Compaction at 50% (or 30% for windows ≥ 1M) of prompt_tokens / contextWindow,
 *   from the provider's own usage. No tokenizer.
 * - The connection (profile + key) is the SHARED one every LLM job uses
 *   (`resolveConnection`, llmEngines.mjs). The model is the agent's own pick,
 *   sent with each message; '' means the connection's recommended agent model.
 */

import crypto from 'crypto';
import {
    chatEngineFor,
    OLLAMA_AGENT_CONTEXT,
    resolveConnection,
    recommendedModel,
    listRemoteModels,
    RECOMMENDED_REMOTE_MODELS,
    FALLBACK_CONTEXT_WINDOW,
} from './llmEngines.mjs';
import * as realTools from './agentTools.mjs';

// ---------------------------------------------------------------------------
// Tool definitions — OpenAI tools format
// ---------------------------------------------------------------------------

const TOOL_DEFS = [
    {
        type: 'function',
        function: {
            name: 'list_models',
            description: 'The short catalogue: every model and Flow, one compact entry each — id, name, type, installed state, and its operations with the rank for that task (1 = the best we have) and a note on what it is good at. It carries no settings: describe_model gives one entry\'s params, media roles, Flow fields and guide ids.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'describe_model',
            description: 'Everything list_models left out, for ONE model or Flow: each op\'s params (the only ratio, qualityTier, turbo and style values it accepts), the media it takes, a Flow\'s fields and boxes, its prompting guide ids and its hardware fit. Read it for the thing you picked, before you set anything on it.',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'A model id or a Flow id, exactly as list_models gives it.' },
                },
                required: ['id'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'read_knowledge',
            description: 'Read a knowledge entry by id (returns title + full text), or list all entries by omitting id (returns the index).',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Entry id. Omit to list all entries.' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'install_model',
            description: 'Show the user a Yes / No confirmation card to install a model. Installation only runs after Yes is clicked. Always use this tool — never install without confirmation, regardless of mode.',
            parameters: {
                type: 'object',
                properties: {
                    modelId: { type: 'string', description: 'The model id to install.' },
                },
                required: ['modelId'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'generate',
            description: 'Start an image or video generation (model op or Flow). Fires without blocking — the result appears in the chat when ready. With no project open this returns NO_PROJECT: call create_project, then send the same generate again.',
            parameters: {
                type: 'object',
                properties: {
                    modelId: { type: 'string' },
                    operation: { type: 'string' },
                    flowId: { type: 'string' },
                    prompt: { type: 'string' },
                    negative: { type: 'string' },
                    ratio: { type: 'string' },
                    qualityTier: { type: 'string', enum: ['very_low', 'low', 'medium', 'high', 'very_high', 'ultra'] },
                    turbo: { type: 'boolean' },
                    styleSelect: { type: 'string' },
                    stylization: { type: 'number' },
                    seed: { type: 'integer' },
                    cardName: { type: 'string', description: 'Optional short name for the card this generation creates.' },
                    fields: { type: 'object', description: 'Flow field values.' },
                    params: { type: 'object', description: 'Flow box params, e.g. { box1: { x, y, width, height } }.' },
                    media: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { role: { type: 'string' }, image: { type: 'string', description: 'One of the refs the App state line lists as images you can look at.' } },
                            required: ['role', 'image'],
                        },
                    },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'look',
            description: 'Describe a still image the App state line lists. Optionally ask a specific question, crop to a region, or request a bounding box. It cannot open videos, folders or any other path.',
            parameters: {
                type: 'object',
                properties: {
                    image: { type: 'string', description: 'One of the refs the App state line lists as images you can look at. Nothing else resolves.' },
                    question: { type: 'string' },
                    crop: {
                        type: 'object',
                        properties: { x: { type: 'integer' }, y: { type: 'integer' }, width: { type: 'integer' }, height: { type: 'integer' } },
                        required: ['x', 'y', 'width', 'height'],
                    },
                    box: { type: 'boolean', description: 'Return output.box {x, y, width, height}, in the image\'s own pixels, around what the question names (e.g. question "the woman\'s head"), and output.square, the same box made square. Also output.imageSize and output.boxShare / output.squareShare, each {w, h}: what that box takes of the image, so you can tell a head from a whole person before you use it. Needs a question.' },
                },
                required: ['image'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_projects',
            description: "List the user's projects, most recently used first, each with the folderPath open_project takes.",
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_project',
            description: 'Create an empty project, open it, and return its folderPath. A project of that name already exists (case ignored) → that one is opened and returned with existing: true, never a second copy of it.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'The project name, e.g. "New Project", or a short title for the user\'s goal.' },
                },
                required: ['name'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'open_project',
            description: 'Open a project so the next generate lands there. folderPath must come from list_projects, from create_project, or from the user.',
            parameters: {
                type: 'object',
                properties: {
                    folderPath: { type: 'string', description: 'The project folder.' },
                },
                required: ['folderPath'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'rename_card',
            description: 'Give a gallery card you generated in this conversation a short name, so you and the user can refer to it. Only your own cards.',
            parameters: {
                type: 'object',
                properties: {
                    groupId: { type: 'string', description: 'The card id a finished generation reported.' },
                    name: { type: 'string', description: 'A short human name, e.g. "Mira at the harbour".' },
                },
                required: ['groupId', 'name'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'read_memory',
            description: 'Read your notes about the open project. No file: the list of notes. A file: that note in full.',
            parameters: {
                type: 'object',
                properties: {
                    file: { type: 'string', description: 'A note file from the list, e.g. "main-character.md".' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'write_memory',
            description: 'Save one note about the open project. Notes are kept after the app restarts. Writing an existing file replaces that note.',
            parameters: {
                type: 'object',
                properties: {
                    file: { type: 'string', description: 'A lowercase slug ending in .md, e.g. "main-character.md".' },
                    title: { type: 'string', description: 'A short title, at most 80 characters.' },
                    hook: { type: 'string', description: 'One line on when the note matters, at most 160 characters.' },
                    text: { type: 'string', description: 'The note in Markdown, at most about 600 words.' },
                },
                required: ['file', 'title', 'text'],
                additionalProperties: false,
            },
        },
    },
];

// Max tool calls the model may make in one user turn before STEP_LIMIT.
const MAX_STEPS = 8;

// How long a `generate` waits to see whether its dispatch is REFUSED before reporting
// it started. A refusal is validation — the route answers over loopback in milliseconds,
// and the renderer's own refusals are one SSE round trip — while a generation that is
// actually running resolves only when it FINISHES, seconds to minutes later. So this
// window catches every refusal and no success (MPI-774 Phase 7).
//
// It is paid in full on every generation that DOES start: one second before the model can
// write its closing sentence. That is the price of never narrating a success that did not
// happen, and this constant is the knob if the trade ever reads wrong.
const EARLY_REFUSAL_MS = 1000;

/**
 * What the model sees of a `list_models` answer (MPI-774 Phase 7).
 *
 * The whole answer is ~9.5k tokens and the weight is `params`, repeated PER OP:
 * `krea2-nsfw` alone costs 512 tokens, 420 of it the same 9 ratios, 2 tiers and 14
 * style names on each of its 7 ops, and the next model repeats most of that list
 * again. On the 32k window Ollama serves that is a third of the context spent before
 * the user's first word, and it compacted every turn.
 *
 * So the list is a POINTER list, exactly as the guides already are (`list_models`
 * named the guide ids, `read_knowledge` fetched one): enough to CHOOSE — id, name,
 * type, what is installed, the op ranks and notes — and `describe_model` hands back
 * the settings for the ONE thing the agent picked.
 *
 * `guides` and `boxParams` are not dropped, they move: the loop reads them off the
 * full answer itself (`_rememberGuides`), so the guide gate and the box gate still
 * bite without the model carrying the ids.
 */
export function compactCatalogue(list) {
    if (!list?.ok) return list;
    return {
        ok: true,
        engine: list.engine,
        hardware: list.hardware,
        detail: 'describe_model with an id for its params, media, fields and guides.',
        models: (list.models || []).map((m) => {
            // Most models write ONE note and hang it on every op ("anime and stylised art,
            // not photography", six times). Said once about the model, it reads the same and
            // costs a sixth; a model whose ops disagree keeps them per op.
            const notes = new Set((m.ops || []).map((o) => o.note).filter(Boolean));
            const shared = notes.size === 1 && (m.ops || []).every((o) => o.note) ? [...notes][0] : null;
            return {
                id: m.id,
                name: m.name,
                type: m.type,
                installed: m.installed,
                // Only when it is news: everything installed runs, and a size matters
                // only for something that would have to be downloaded first.
                ...(m.installed ? {} : { downloadGb: m.missingDownloadGb }),
                ...(m.fit && m.fit.runs === false ? { runsHere: false } : {}),
                ...(shared ? { note: shared } : {}),
                ops: (m.ops || []).map((o) => ({
                    op: o.op,
                    ...(o.installed === false ? { installed: false } : {}),
                    ...(o.rank ? { rank: o.rank } : {}),
                    ...(o.note && !shared ? { note: o.note } : {}),
                })),
            };
        }),
        flows: (list.flows || []).map((f) => ({
            id: f.id,
            title: f.title,
            installed: f.installed,
        })),
    };
}

/** One model or Flow out of a `list_models` answer, whole. `null` when the id is neither. */
export function catalogueEntry(list, id) {
    const wanted = String(id ?? '');
    const model = (list?.models || []).find((m) => m.id === wanted);
    if (model) return { model };
    const flow = (list?.flows || []).find((f) => f.id === wanted);
    return flow ? { flow } : null;
}

// ---------------------------------------------------------------------------
// AgentLoop class — injectable for tests
// ---------------------------------------------------------------------------

export class AgentLoop {
    /**
     * @param {object} [opts]
     * @param {object} [opts.tools]         Connector tool implementation (defaults to agentTools.mjs).
     * @param {function} [opts.resolveEndpoint] (profileId) => { profile, key } overrides fork bridge.
     * @param {function} [opts.lookupContextWindow] (profileId, model, profile, key) => number|null,
     *        overrides the table + endpoint lookup.
     * @param {string} [opts.sessionKey]  Which conversation this is ('' = the landing page); every
     *        event carries it. `agentSessions.mjs` changes it when the conversation moves (D5).
     * @param {function} [opts.broadcast] (event, data) => void, the shared SSE stream.
     * @param {function} [opts.onProjectOpened] (loop, project, turn) => 'moved'|'carry'|null (D5).
     */
    constructor({ tools, resolveEndpoint, lookupContextWindow, sessionKey = '', broadcast, onProjectOpened } = {}) {
        this._tools = tools || realTools;
        this._resolveEndpointOverride = resolveEndpoint || null;
        this._lookupContextWindowOverride = lookupContextWindow || null;
        this._contextWindows = new Map(); // `${profileId}\n${model}` -> number
        this.sessionKey = sessionKey;
        this._broadcast = broadcast || null;
        this._onProjectOpened = onProjectOpened || null;

        // Session state
        this._messages = [];       // LLM context (system + turns)
        this._history = [];        // UI-facing entries
        this._working = false;
        this._pendingConfirm = null; // { confirmId, resolve }
        this._lastUsage = null;    // provider usage from last response
        this._contextWindow = 0;   // of the model the last turn ran on

        // Every image this session is allowed to reach: attachment ids the user
        // sent, and the outputs its own generations produced. See _resolveImage.
        this._images = new Map();  // ref -> { path, kind: 'attachment' | 'result' }
        this._groups = new Set();  // card ids this session's own generations created (rename_card)
        this._projects = new Set(); // project keys list_projects / create_project gave (open_project)

        // What the model hears at the start of its next turn (finished generations). A
        // message pushed the moment a generation settles could land between a tool call and
        // its result, which a provider rejects.
        this._notes = [];
        this._notesProject = null; // folderPath whose project notes this context already lists
        this._readIds = new Set(); // knowledge ids read in this context (the guide gate)
        this._guides = new Map();  // modelId -> guide ids, from list_models
        this._boxSteps = new Map(); // flowId -> its box steps [{param, role}], from list_models
        this._ops = new Map();     // "modelId\nop" -> that op's entry (media slots, params), from list_models
        this._boxed = new Set();   // image paths a `look` with box: true measured (the box gate)

        // SSE subscribers
        this._subscribers = new Set();
    }

    // -------------------------------------------------------------------------
    // SSE
    // -------------------------------------------------------------------------

    addSubscriber(res) { this._subscribers.add(res); }
    removeSubscriber(res) { this._subscribers.delete(res); }

    _emit(event, data) {
        const body = { ...data, session: this.sessionKey };
        if (this._broadcast) this._broadcast(event, body);
        const payload = `event: ${event}\ndata: ${JSON.stringify(body)}\n\n`;
        for (const sub of this._subscribers) {
            try { sub.write(payload); } catch { /* stale connection */ }
        }
    }

    // -------------------------------------------------------------------------
    // History
    // -------------------------------------------------------------------------

    getHistory() {
        const usage = this._lastUsage
            ? { promptTokens: this._lastUsage.prompt_tokens || 0, contextWindow: this._contextWindow }
            : { promptTokens: 0, contextWindow: this._contextWindow };
        return {
            ok: true,
            working: this._working,
            pendingConfirm: this._pendingConfirm
                ? { confirmId: this._pendingConfirm.confirmId, modelId: this._pendingConfirm.modelId, modelName: this._pendingConfirm.modelName, downloadGb: this._pendingConfirm.downloadGb }
                : null,
            usage,
            entries: this._history,
        };
    }

    // -------------------------------------------------------------------------
    // Reset
    // -------------------------------------------------------------------------

    async reset() {
        if (this._pendingConfirm) this._pendingConfirm.resolve('declined');
        // Only this conversation's staged files: another project's chat still shows its own.
        const staged = [...this._images.values()].filter((i) => i.kind === 'attachment').map((i) => i.path);
        this._pendingConfirm = null;
        this._working = false;
        this._messages = [];
        this._history = [];
        this._lastUsage = null;
        this._images.clear();
        this._groups.clear();
        this._projects.clear();
        this._notes = [];
        this._notesProject = null;
        this._readIds.clear();
        this._guides.clear();
        this._boxSteps.clear();
        this._boxed.clear();
        try { await this._tools.discardAttachments(staged); } catch { /* non-fatal */ }
    }

    /** Nothing said yet: a landing conversation may move in (D5). */
    isEmpty() {
        return !this._working && this._history.length === 0;
    }

    // -------------------------------------------------------------------------
    // Image references
    // -------------------------------------------------------------------------

    /**
     * Resolve an image reference the MODEL emitted to a file this session may read.
     *
     * Only two things are reachable: an attachment the user sent in this session,
     * and an output one of this session's own generations produced. A model is free
     * to emit any string, and `look`/`generate` ship what it names to the engine —
     * which may be a remote Pod — so anything not registered here is refused rather
     * than read off the user's disk.
     *
     * @returns {{path: string, kind: string} | null}
     */
    _resolveImage(ref) {
        if (!ref || typeof ref !== 'string') return null;
        return this._images.get(ref) || null;
    }

    /** The staged file behind one of this session's attachment ids, or null. */
    attachmentPath(id) {
        const img = this._resolveImage(id);
        return img && img.kind === 'attachment' ? img.path : null;
    }

    /**
     * The line that opens every user turn: where a generation lands, and the only image
     * refs `look`/`generate` resolve (the `_images` allowlist, so the two cannot differ).
     * ponytail: the latest 8 refs; a longer session lists what it most likely means.
     */
    _appStateLine(project) {
        const where = project
            ? `project "${project.name}" is open. Generations land there.`
            : 'no project is open. A generation needs one: ask the user to open or create a project.';
        const refs = [...this._images.entries()].slice(-8)
            .map(([ref, img]) => (img.kind === 'attachment' ? `${ref} (${img.name || 'attachment'})` : ref));
        return `[App state: ${where} Images you can look at: ${refs.length ? refs.join(', ') : 'none'}.]`;
    }

    /**
     * open_project takes a folder the app gave this conversation (list_projects, create_project),
     * the open project, or one the user typed; never a path the model made up.
     */
    _mayOpen(folderPath, currentProject) {
        const key = projectKey(folderPath);
        if (!key) return false;
        if (this._projects.has(key) || key === projectKey(currentProject?.folderPath)) return true;
        return this._history.some((e) => e.kind === 'user' && projectKey(e.text).includes(key));
    }

    /** Register a generation's output so a later `look` or reference can name it. */
    _registerResult(filePath) {
        if (!filePath || typeof filePath !== 'string') return;
        this._images.set(filePath, { path: _decodeProjectFileUrl(filePath), kind: 'result' });
    }

    /**
     * The open project's notes, listed once per project: on the first turn with it open, and
     * again after a switch or a compaction. '' when there is nothing to add (or no route).
     */
    async _projectNotesLine(project) {
        if (!project?.folderPath || project.folderPath === this._notesProject) return '';
        let r;
        try { r = await this._tools.readMemory(project.folderPath); } catch { return ''; }
        if (!r?.ok) return '';
        this._notesProject = project.folderPath;
        const notes = r.notes || [];
        if (!notes.length) return '[Project notes: none yet.]';
        return `[Project notes you kept earlier (read_memory with a file for the whole note):\n${notes
            .map((n) => `- ${n.file}: ${n.title}${n.hook ? ` (${n.hook})` : ''}`).join('\n')}]`;
    }

    /**
     * What the loop keeps off a FULL list_models answer: the guide ids, the Flow box steps and
     * each op's media slots. None of it goes to the model any more (`compactCatalogue`), and all
     * three gates read it from here.
     */
    _rememberGuides(list) {
        for (const m of list?.models || []) {
            this._guides.set(m.id, Array.isArray(m.guides) ? m.guides : []);
            for (const o of m.ops || []) this._ops.set(`${m.id}\n${o.op}`, o);
        }
        for (const f of list?.flows || []) this._boxSteps.set(f.id, Array.isArray(f.boxParams) ? f.boxParams : []);
    }

    /**
     * A required media slot the call does not fill, or null. Structural, like the guide gate:
     * live (Fabio, 2026-09-19) the model called i2v_ms with no media at all, told the user it
     * had started the video from their picture, and the refusal — `"i2v_ms" needs image in its
     * "startFrame" slot` — came back from the renderer long after `generate` had answered
     * `started: true`, which is the one thing the model tells the user about.
     */
    async _missingMedia(args) {
        if (!args.modelId || !args.operation) return null;
        const key = `${args.modelId}\n${args.operation}`;
        if (!this._ops.has(key)) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { return null; /* the app still validates the call */ }
        }
        const slots = this._ops.get(key)?.media || [];
        const given = new Set((Array.isArray(args.media) ? args.media : []).map((m) => m?.role));
        const missing = slots.find((s) => s.required && !given.has(s.role));
        return missing ? { missing, slots } : null;
    }

    /**
     * The first Flow box param whose image no `look` with `box: true` measured, or null. Structural,
     * like the guide gate: live (Phase 4) the model guessed Head Swap boxes at {0,0,512,512} with the
     * box tool right there, and the swap came out half done.
     */
    async _unmeasuredBox(args) {
        const params = args.params && typeof args.params === 'object' ? Object.keys(args.params) : [];
        if (!params.length) return null;
        if (!this._boxSteps.has(args.flowId)) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { /* the app still validates the call */ }
        }
        const steps = this._boxSteps.get(args.flowId) || [];
        for (const param of params) {
            const step = steps.find((s) => s.param === param);
            if (!step) continue; // an unknown param is the app's UNKNOWN_PARAM to report
            const media = Array.isArray(args.media) ? args.media.find((m) => m.role === step.role) : null;
            const ref = media ? this._resolveImage(media.image) : null;
            if (!ref || !this._boxed.has(ref.path)) return { param, role: step.role, image: media?.image || null };
        }
        return null;
    }

    /**
     * The ratio an op should run at when the user named none and the generation starts from a
     * picture: the op's offered ratio closest to that picture's own shape, same orientation.
     * `null` when there is nothing to choose between, or the picture cannot be read.
     *
     * In CODE and not in the system prompt (Fabio, 2026-09-19). The prompt used to teach the
     * arithmetic — read imageSize, divide, compare, match the orientation — and live the model
     * simply never called `look`, so it had no size to divide and put a LANDSCAPE still on 9:16.
     * Prompt words for this cost tokens on every turn and were still a guess; this is exact and
     * costs the user nothing.
     */
    async _ratioForSource(key, sourcePath) {
        const labels = this._ops.get(key)?.params?.ratios || [];
        if (labels.length < 2 || !sourcePath) return null;
        const size = await _imageSize(sourcePath);
        const [w, h] = size.split('x').map(Number);
        if (!w || !h) return null;

        const shape = w / h;
        const parsed = labels
            .map((label) => {
                const [rw, rh] = String(label).split(':').map(Number);
                return rw && rh ? { label, value: rw / rh } : null;
            })
            .filter(Boolean);
        // A wide picture never takes a tall ratio: the closest ratio by number alone is
        // sometimes the one that crops the head off (a 4:5 is nearest 1:1, which cuts the top,
        // while 9:16 takes the sides and keeps the whole height).
        const orientation = (v) => Math.sign(v - 1);
        const sameWay = parsed.filter((r) => orientation(r.value) === orientation(shape));
        const pool = sameWay.length ? sameWay : parsed;
        const best = pool.reduce((a, b) => (Math.abs(b.value - shape) < Math.abs(a.value - shape) ? b : a));
        return best.label;
    }

    /**
     * The guide a model op needs read before its first prompt, or null. Structural, like the
     * install gate: the H3 samples showed a rule alone did not make the model read one.
     */
    async _unreadGuide(modelId) {
        if (!this._guides.has(modelId)) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { /* the app still validates the call */ }
        }
        const guides = this._guides.get(modelId) || [];
        return guides.length && !guides.some((g) => this._readIds.has(g)) ? guides[0] : null;
    }

    // -------------------------------------------------------------------------
    // Endpoint resolution
    // -------------------------------------------------------------------------

    async _resolveEndpoint(profileId) {
        // Injected override (tests or probe)
        if (this._resolveEndpointOverride) return this._resolveEndpointOverride(profileId);
        return resolveConnection(profileId, this._forkAsk || null);
    }

    /** The agent's pick, or the connection's recommended agent model, or ''. */
    _resolveModel(profileId, model) {
        return (typeof model === 'string' && model.trim()) || recommendedModel(profileId, 'agent');
    }

    /**
     * The model's context window, which sets the compaction threshold: our table,
     * then the endpoint's own `/models` entry (cached for the session), then
     * FALLBACK_CONTEXT_WINDOW. A failed lookup is not cached, so the next turn asks again.
     */
    async _contextWindowFor(profileId, model, profile, key) {
        if (this._lookupContextWindowOverride) {
            return (await this._lookupContextWindowOverride(profileId, model, profile, key)) || FALLBACK_CONTEXT_WINDOW;
        }
        // On Ollama the window is not the endpoint's to report — it is what we ask for
        // per request (`OLLAMA_AGENT_CONTEXT`). Asking `/v1/models` would answer null and
        // land on the 32k fallback, which is right only by accident and wrong the moment
        // that constant changes. Compaction has to follow what we actually set.
        if (profileId === 'ollama') return OLLAMA_AGENT_CONTEXT;
        const known = (RECOMMENDED_REMOTE_MODELS[profileId] || []).find((r) => r.id === model)?.contextWindow;
        if (known) return known;
        const cacheKey = `${profileId}\n${model}`;
        if (this._contextWindows.has(cacheKey)) return this._contextWindows.get(cacheKey);
        try {
            const models = await listRemoteModels({ presetId: profileId, baseURL: profile.baseURL, key });
            const found = models.find((m) => m.id === model)?.contextWindow;
            if (found) {
                this._contextWindows.set(cacheKey, found);
                return found;
            }
        } catch { /* fall through to the conservative default */ }
        return FALLBACK_CONTEXT_WINDOW;
    }

    /** Set the fork bridge ask function (called by routes/agent.js after import). */
    setForkBridge(ask) { this._forkAsk = ask; }

    // -------------------------------------------------------------------------
    // System prompt
    // -------------------------------------------------------------------------

    async _buildSystemPrompt(mode) {
        let knowledgeIndex = '';
        try {
            const kr = await this._tools.readKnowledge();
            if (kr?.ok && Array.isArray(kr.entries)) {
                knowledgeIndex =
                    '\nAvailable knowledge entries (call read_knowledge with an id for the full text):\n' +
                    kr.entries.map((e) => `- ${e.id}: ${e.title}`).join('\n');
            }
        } catch { /* corpus not reachable — omit */ }

        const modeRules =
            mode === 'auto'
                ? `Mode: Auto. Proceed when the goal is clear without asking about settings. For images: use turbo: true where the op offers it. For video: use qualityTier 'medium' and turbo: true where the op offers them.`
                : `Mode: Ask first. Before any generate, ask the user which settings they want (quality, turbo, ratio, style, where the op offers them) and end your reply there; generate only after they answer. A setting a guide recommends is a suggestion to offer, not permission to skip the question.`;

        return `You are Cubric, a helpful assistant built into Cubric Vision, a desktop AI image and video tool.

${modeRules}

Model rule: first the TASK, then the model. The task comes from what the user asked for and does not change because another task's op ranks higher: changing an existing picture is the edit task (kleinEdit, krea2Edit, qwenEdit, edit), not i2i, even when the user names a model whose i2i is rank 1. Ranks only ever compare ops WITHIN one task. Inside the task, pick an op that is installed (an op list_models marks installed: false is not, and neither is a model marked runsHere: false, which this machine cannot run at all), and take the lowest rank number (rank 1 is the best we have at it); an op with no rank is unranked, not bad. Take a lower-ranked op over rank 1 only when the user names a model, or when its note matches what they asked for (a note is what the ranking cannot say: "leaves everything outside the edit area untouched", "takes exactly one image", "anime and stylised art"). When you pass over rank 1 for a note, say in one short line which model you used and why. If nothing installed fits, say an install is needed and offer one with install_model.

Settings rule: list_models is the short list and carries no settings. Once you have picked a model or a Flow, call describe_model with its id: it gives each op its params (the only ratio, qualityTier, turbo and styleSelect values that op accepts; styleSelect takes a label from params.styles or its index), the media roles it takes, a Flow's fields and boxes, and its guide ids. Never send a value its params do not list. Start every setting at its default and raise one only when the user's own words asked for it: quality stays at the lowest tier until they want it sharper or bigger, turbo and stylization stay alone, and a style is worth reaching for only when they named a look the rack has. Ratio you infer from words that imply a shape (a platform, portrait, widescreen). Unsure which shape a platform wants, or whether a style is worth it: read_knowledge "app:formats".

Numbering rule: "picture 2", "image 2" or "2" in a message means that message's attached image 2, never an image from an earlier turn. Pass that attachment's id.

Looking rule: before you comment on, judge or describe any image, call look on it. look only takes a ref the App state line lists under images you can look at; it cannot open a video, a folder or any other path, and with none listed there is nothing to look at. If look reports a refusal (the describer declined to describe the image), tell the user it refused, and suggest switching Image descriptions to the local ComfyUI describer (Settings > Remote > Language Models), which runs on their machine and does not refuse.

Box rule: a Flow whose describe_model answer has boxParams needs one box per param, measured, never guessed. For each, call look on the image you pass for that param's role with box: true and a question naming what to box (Head Swap: the head, hair and jaw included), then pass output.square when the step has ratio 1, else output.box. generate refuses a box it did not see you measure. A Flow's fields hold only what their names say (Head Swap's positive is the expression the new head ends with), never instructions. Check the share before you pass it: look reports boxShare and squareShare, what the box and the square take of the image. A head is a small part of a photo, so a squareShare over 0.6 on either side, or over 1 (bigger than the image itself), means the describer boxed the whole person, not the head. Never pass that box: it swallows whoever stands next to them. Measure that image again ONCE, with a question that says head only, or on a crop around that person. If the second measure is no better, stop measuring: tell the user which photo you could not measure and what came back, and ask them to crop it to the head themselves. Never a third attempt, and never pass the box anyway.

Shape rule: a generation that starts from a picture crops it to fill the ratio, never letterboxes it. Leave ratio out and the picture's own shape is used: say nothing. Only when the user asks for a ratio themselves, tell them in one line, before you generate, that part of the picture will be cropped to fit.

Guide rule: before your first prompt for a model, read its prompting guide: describe_model gives that model its guide ids, read_knowledge reads one. generate refuses until you have. Use the guide to ADAPT what the user asked for to that model (its structure, length and vocabulary) and keep their intent. Never send a guide's example as the prompt.

Installation rule: Always call install_model to show the user a Yes / No confirmation card. Never install a model without a Yes from the user, regardless of mode.

Project rule: a generation lands in the open project. Never invent a folder path: open_project only takes a folderPath from list_projects or create_project, or one the user typed. To open a project by name, find it with list_projects. With no project open: if the user asks for anything to be MADE, create a project named after what they are making (create_project opens it for you) and make it in that same turn — never ask them to open or create one first, that is your job. Background they give you (the story, the era, who the characters are) is material for the work, never a reason to stop: note what will matter later with write_memory, then still make what they asked for, all of it. Only when they describe a project and ask for NOTHING to be made do you end the turn by asking what they want first.

Docs rule: when you cannot answer a question about the app itself — a feature you have no tool for, a screen you cannot see, a setting you do not know — say so plainly and point them at the documentation as a markdown link, [the documentation](https://docs.cubric.studio). Offer it instead of guessing at how the app works. It is for questions about Vision, not for image or video advice, which is yours to answer.

Deletion rule: You never delete anything: no cards, no media, no notes, no projects. No tool of yours can, and you never look for a way. When the user wants something deleted, tell them only they can do it, and where: a card from the gallery (right-click it, Delete, which also removes its whole history), a project from the projects list on the landing page (right-click it, Delete project).

Memory rule: you keep notes about each project that survive an app restart. The first message with a project open lists them; read one with read_memory before you rely on it. Save without being asked, in the same turn you hear it: the moment the user states a goal for the project, names or describes a character, settles a style or a look, decides something, or a model or setting works or fails, call write_memory. They will not tell you to remember it, and a turn that ends without the note loses it. One short note per thing, and update a note rather than add a second one about the same thing. Saving is not a question: never ask whether to save, just save it and say in one short line what you noted. Never save keys, passwords or personal details.

Naming rule: a finished generation reports its card id. When a result is worth referring to later, give its card a short name with rename_card, or pass cardName with generate.

Knowledge: the index below also holds the Cubric Vision skills. They were written for outside agents that call the app's HTTP routes; your tools cover the same ground, and you never call a route yourself.

Honest limits (I'm still a baby — this is my first version):
- I never delete cards, media or projects. Only you can.
- I cannot watch videos or hear audio directly. I can only look at still images.
- I cannot paint masks or drive History tools (mask, paint, composite, transform).
- I cannot control RunPod.
- After a restart I only remember what I saved in the project's notes.
- I see only what the look tool reported. I never claim to have seen something I did not look at.
- I cannot access generation history.
${knowledgeIndex}`.trim();
    }

    // -------------------------------------------------------------------------
    // Execute a single tool call
    // -------------------------------------------------------------------------

    async _executeTool(toolName, args, turnId, currentProject) {
        switch (toolName) {
            case 'list_models': {
                const r = await this._tools.listModels();
                this._rememberGuides(r);
                return JSON.stringify(compactCatalogue(r));
            }
            case 'describe_model': {
                const r = await this._tools.listModels();
                if (!r?.ok) return JSON.stringify(r);
                this._rememberGuides(r);
                const entry = catalogueEntry(r, args?.id);
                if (!entry) {
                    return JSON.stringify({ ok: false, error: { code: 'UNKNOWN_MODEL', message: `No model or Flow "${args?.id}". Use an id exactly as list_models gives it.` } });
                }
                return JSON.stringify({ ok: true, ...entry });
            }
            case 'read_knowledge': {
                const r = await this._tools.readKnowledge(args?.id);
                if (r?.ok && args?.id) this._readIds.add(String(args.id));
                return JSON.stringify(r);
            }
            case 'install_model': {
                // Step 1: the model must be one list_models knows; the card shows its name and size.
                // A guessed id ("ltx-2.3" for ltx-23-balanced, agent-test 2026-09-17) got a card too.
                let m;
                try {
                    m = (await this._tools.listModels())?.models?.find((x) => x.id === args.modelId);
                } catch (err) {
                    return JSON.stringify({ ok: false, error: { code: 'RUNTIME_ERROR', message: `Could not read the model list: ${err.message}` } });
                }
                if (!m) {
                    return JSON.stringify({ ok: false, error: { code: 'UNKNOWN_MODEL', message: `No model "${args.modelId}". Use a model id exactly as list_models gives it.` } });
                }
                const modelName = m.name || args.modelId;
                const downloadGb = m.missingDownloadGb ?? null;

                const confirmId = crypto.randomUUID();
                this._emit('agent:confirm', { turnId, confirmId, kind: 'install', modelId: args.modelId, modelName, downloadGb });
                this._historyEntry('confirm', { tool: 'install_model', args, confirmId, modelId: args.modelId, modelName, downloadGb });

                // Suspend the turn until POST /agent/confirm arrives
                const answer = await new Promise((resolve) => {
                    this._pendingConfirm = { confirmId, modelId: args.modelId, modelName, downloadGb, resolve, turnId };
                });
                this._pendingConfirm = null;
                return answer; // 'installed: ...' or 'User declined the installation.'
            }
            case 'generate': {
                if (!currentProject) {
                    // The message is the instruction, not the prompt (Fabio, 2026-09-19). This used
                    // to read "Please open or create a project first" and the model relayed it to
                    // him almost verbatim — the exact opposite of the Project rule above, which
                    // says creating one is the agent's job. A concrete tool result beats a prompt
                    // rule every time, so the result now names the call that fixes it.
                    return JSON.stringify({ ok: false, error: { code: 'NO_PROJECT', message: 'Nothing was generated: no project is open. Call create_project now, named after what you are making — it opens what it makes — then send this same generate again. Do not ask the user to open or create one; that is your job.' } });
                }
                if (!args.flowId && args.modelId) {
                    const unread = await this._unreadGuide(String(args.modelId));
                    if (unread) {
                        return JSON.stringify({ ok: false, error: { code: 'GUIDE_NOT_READ', message: `Read this model's prompting guide first: read_knowledge with id "${unread}". Then write the prompt with what it says.` } });
                    }
                    const gap = await this._missingMedia(args);
                    if (gap) {
                        const roles = gap.slots.map((s) => `"${s.role}" (${s.type}${s.required ? ', required' : ''})`).join(', ');
                        return JSON.stringify({ ok: false, error: { code: 'MEDIA_REQUIRED', message: `Nothing was generated: "${args.operation}" needs ${gap.missing.type} in its "${gap.missing.role}" slot and your call passed none. Send it again with media: [{ role: "${gap.missing.role}", image: "<a ref the App state line lists>" }]. The slots this op takes: ${roles}.` } });
                    }
                }
                if (args.flowId) {
                    const miss = await this._unmeasuredBox(args);
                    if (miss) {
                        const where = miss.image ? `"${miss.image}"` : `the image you pass as media role "${miss.role}"`;
                        return JSON.stringify({ ok: false, error: { code: 'BOX_NOT_MEASURED', message: `Never guess a box. Measure ${miss.param} first: call look on ${where} with box: true and a question naming what to box, then pass the box it returns (its square when the step has ratio 1).` } });
                    }
                }
                // Build connector body
                const body = {};
                if (args.cardName) body.cardName = String(args.cardName);
                if (args.flowId) {
                    body.flowId = String(args.flowId);
                    if (args.fields) body.fields = args.fields;
                    if (args.params) body.params = args.params;
                } else {
                    if (args.modelId) body.modelId = String(args.modelId);
                    if (args.operation) body.operation = String(args.operation);
                    if (args.prompt) body.positive = String(args.prompt);
                    if (args.negative) body.negative = String(args.negative);
                    if (args.ratio !== undefined) body.ratio = args.ratio;
                    if (args.qualityTier !== undefined) body.qualityTier = args.qualityTier;
                    if (args.turbo !== undefined) body.turbo = args.turbo;
                    if (args.styleSelect !== undefined) body.styleSelect = args.styleSelect;
                    if (args.stylization !== undefined) body.stylization = args.stylization;
                    if (args.seed !== undefined) body.seed = args.seed;
                }
                // Resolve media references. An attachment is copied into the project
                // here — only now that a generation uses it — and a result is passed
                // back by its project-file url (contract § Tools).
                let sourcePath = null;
                if (Array.isArray(args.media) && args.media.length) {
                    const resolved = [];
                    for (const m of args.media) {
                        const ref = this._resolveImage(m.image);
                        if (!sourcePath && ref) sourcePath = ref.path;
                        if (!ref) {
                            return JSON.stringify({ ok: false, error: { code: 'IMAGE_NOT_FOUND', message: `Image reference not found: ${m.image}. Use an attachment id from this conversation, or the filePath of something you generated.` } });
                        }
                        if (ref.kind === 'attachment') {
                            const placed = await this._tools.placeAsset(currentProject.folderPath, ref.path);
                            if (!placed?.success || !placed.filePath) {
                                return JSON.stringify({ ok: false, error: { code: 'RUNTIME_ERROR', message: `Could not place the attachment in the project: ${placed?.error || 'unknown error'}` } });
                            }
                            resolved.push({ role: m.role, url: placed.filePath });
                        } else {
                            resolved.push({ role: m.role, url: _projectFileUrl(ref.path) });
                        }
                    }
                    body.media = resolved;
                }

                // No ratio asked for, and it starts from a picture: give it the picture's own
                // shape rather than the project's last saved ratio, which has nothing to do with
                // the picture. Said out loud in the result, or the model narrates a ratio it
                // picked in its head (live: "the video will have a 9:16 aspect ratio").
                let snapped = null;
                if (!args.flowId && args.ratio === undefined && sourcePath && args.modelId && args.operation) {
                    snapped = await this._ratioForSource(`${args.modelId}\n${args.operation}`, sourcePath);
                    if (snapped) body.ratio = snapped;
                }

                // Fire, and wait only long enough to learn it was REFUSED.
                //
                // Live (Fabio, 2026-09-19): the model sent a Krea2 style by its label, the route
                // refused it with INVALID_STYLE_SELECT before anything reached the queue — the log
                // has no `generation.submit` at all — and the chat still said "Your image of a
                // cowgirl riding a big bull is on its way." Fire-and-forget answered `started: true`
                // in the same tick, so the model narrated a success that never existed and could
                // not correct itself, because the refusal only arrived at the START of the next
                // turn. This is the same failure the media gate closed for one case: a refusal
                // landing after `{ started: true }`. Here it is closed for all of them.
                const toolCallId = crypto.randomUUID();
                const pending = this._tools.generate(body);
                const early = await Promise.race([
                    pending.then((r) => r, (err) => ({ ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } })),
                    new Promise((resolve) => { setTimeout(() => resolve(null), EARLY_REFUSAL_MS); }),
                ]);
                if (early && !early.ok) {
                    // Nothing was queued, so there is no result to report and nothing to note:
                    // the model has this in-turn and can fix the call and send it again.
                    const miss = /^(INVALID_|UNKNOWN_PARAM|MEDIA_REQUIRED)/.test(early.error?.code || '');
                    const where = args.flowId || args.modelId;
                    return JSON.stringify({ ok: false, error: {
                        ...early.error,
                        message: `Nothing was generated: ${early.error?.message || 'the generation was refused.'}${miss && where ? ` Call describe_model with "${where}" for the values it accepts, then send it again.` : ''}`,
                    } });
                }
                pending.then(async (r) => {
                    const ok = r && r.ok;
                    if (ok && r.output?.filePath) this._registerResult(r.output.filePath);
                    if (ok && r.output?.groupId) this._groups.add(r.output.groupId);
                    this._emit('agent:result', {
                        toolCallId,
                        ok,
                        ...(ok ? { output: r.output } : { error: r.error }),
                    });
                    this._historyEntry('result', { toolCallId, ok, ...(ok ? { output: r.output } : { error: r.error }) });
                    // A refused setting is the one failure the short catalogue can cause, so the
                    // note says where the accepted values are rather than leaving a second guess.
                    const paramMiss = /^(INVALID_|UNKNOWN_PARAM|MEDIA_REQUIRED)/.test(r?.error?.code || '');
                    this._notes.push(ok
                        ? `[Generation finished: card ${r.output?.groupId}, ${r.output?.type} ${r.output?.filePath}${r.output?.pixelDimensions ? `, ${r.output.pixelDimensions.w}x${r.output.pixelDimensions.h}` : ''}]`
                        : `[Generation failed: ${r?.error?.code || 'ERROR'}: ${r?.error?.message || 'no reason given'}${paramMiss ? ` Call describe_model with "${args.flowId || args.modelId}" for the values it accepts.` : ''}]`);

                    // Auto-look at image results (brief item 10)
                    if (ok && r.output?.type === 'image' && r.output?.filePath) {
                        try {
                            const lr = await this._tools.look({ imagePath: _decodeProjectFileUrl(r.output.filePath) });
                            if (lr?.ok) {
                                this._historyEntry('tool', {
                                    tool: 'look', args: { image: r.output.filePath }, status: 'done', label: 'Looked at result',
                                    output: lr.output,
                                });
                                this._notes.push(`[You looked at it: ${lr.output?.text || ''}]`);
                            }
                        } catch { /* look failure is non-fatal */ }
                    }
                }).catch((err) => {
                    this._emit('agent:result', { toolCallId, ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } });
                    this._historyEntry('result', { toolCallId, ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } });
                    this._notes.push(`[Generation failed: RUNTIME_ERROR: ${err.message}]`);
                });

                return JSON.stringify({ ok: true, started: true, toolCallId, message: `Generation started. The result will appear in the chat when ready.${snapped ? ` Ratio ${snapped}, taken from the picture's own shape.` : ''}` });
            }
            case 'look': {
                const ref = this._resolveImage(args.image);
                if (!ref) {
                    return JSON.stringify({ ok: false, error: { code: 'IMAGE_NOT_FOUND', message: `Image reference not found: ${args.image}. Use an attachment id from this conversation, or the filePath of something you generated.` } });
                }
                const lookArgs = { imagePath: ref.path };
                if (args.question) lookArgs.question = args.question;
                if (args.crop) lookArgs.crop = args.crop;
                if (args.box) lookArgs.box = args.box;
                const r = await this._tools.look(lookArgs);
                if (args.box && r?.ok && r.output?.box) this._boxed.add(ref.path);
                return JSON.stringify(r);
            }
            case 'list_projects': {
                const r = await this._tools.listProjects();
                for (const p of r?.projects || []) this._projects.add(projectKey(p.folderPath));
                return JSON.stringify(r);
            }
            case 'create_project': {
                const r = await this._tools.createProject(args.name);
                if (!r?.ok || !r.project?.folderPath) return JSON.stringify(r);
                this._projects.add(projectKey(r.project.folderPath));

                // Opening it is not the model's to remember. Live (Fabio, 2026-09-19) it created
                // "Cowgirls", never opened it, and the project brief it wrote next went into a
                // DIFFERENT project of the same name from an earlier session — the one the app
                // still had open. A note in the wrong project is invisible and unfindable, and
                // there is no such thing as creating a project you did not want opened.
                const opened = await this._tools.openProject(r.project.folderPath);
                if (!opened?.ok) {
                    return JSON.stringify({ ...r, opened: false, warning: 'The project was created but could not be opened, so nothing can be made in it yet. Call open_project with the folderPath above before generating.' });
                }
                return JSON.stringify({ ...r, opened: true, output: opened.output || { folderPath: r.project.folderPath, name: r.project.name } });
            }
            case 'open_project': {
                if (!this._mayOpen(args.folderPath, currentProject)) {
                    return JSON.stringify({ ok: false, error: { code: 'UNKNOWN_PROJECT', message: 'Open only a folderPath from list_projects or create_project, or one the user typed. Find a project by name with list_projects.' } });
                }
                const r = await this._tools.openProject(args.folderPath);
                return JSON.stringify(r);
            }
            case 'rename_card': {
                if (!this._groups.has(args.groupId)) {
                    return JSON.stringify({ ok: false, error: { code: 'UNKNOWN_CARD', message: 'You can only name cards you generated in this conversation: use the card id a finished generation reported.' } });
                }
                return JSON.stringify(await this._tools.renameCard(args.groupId, args.name));
            }
            case 'read_memory':
            case 'write_memory': {
                // The project is the one the app has open, never a path the model names.
                if (!currentProject?.folderPath) {
                    return JSON.stringify({ ok: false, error: { code: 'NO_PROJECT', message: 'No project is open, so there are no project notes. Call create_project (it opens what it makes) and then call this again. Do not ask the user to open or create one.' } });
                }
                const r = toolName === 'read_memory'
                    ? await this._tools.readMemory(currentProject.folderPath, args.file)
                    : await this._tools.writeMemory(currentProject.folderPath, { file: args.file, title: args.title, hook: args.hook, text: args.text });
                return JSON.stringify(r);
            }
            default:
                return JSON.stringify({ ok: false, error: { code: 'UNKNOWN_TOOL', message: `Unknown tool: ${toolName}` } });
        }
    }

    // -------------------------------------------------------------------------
    // History helpers
    // -------------------------------------------------------------------------

    _historyEntry(kind, fields) {
        const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), kind, ...fields };
        this._history.push(entry);
        return entry;
    }

    // -------------------------------------------------------------------------
    // Compaction
    // -------------------------------------------------------------------------

    /** The prompt_tokens that trigger a compaction. */
    _compactAt() {
        return this._contextWindow * (this._contextWindow >= 1_000_000 ? 0.30 : 0.50);
    }

    _shouldCompact() {
        if (!this._lastUsage || !this._contextWindow) return false;
        return (this._lastUsage.prompt_tokens || 0) >= this._compactAt();
    }

    /** @param {{model: string, baseURL: string, key: string, profileId: string}} endpoint */
    async _compact(turnId, endpoint) {
        this._emit('agent:compacting', { turnId, on: true });
        try {
            // Ask the model to write a handoff
            const handoffMessages = [
                ...this._messages,
                {
                    role: 'user',
                    content: 'Write a compact handoff covering: goal, decisions made, outputs generated (model, settings, results), current model and settings, and any open question. This will restart the session context.',
                },
            ];
            const { engine, contextWindow: askFor } = chatEngineFor(endpoint.profileId, endpoint.key, endpoint.baseURL);
            const handoffRes = await engine.chat({
                model: endpoint.model,
                messages: handoffMessages,
                ...(askFor ? { options: { contextWindow: askFor } } : {}),
            });
            const handoffText = handoffRes.text || '';

            // Rebuild messages: system + handoff + the last (up to 4) user turns that fit in half
            // the trigger. Four whole turns could sit above the trigger on their own (live, a
            // list_models answer was ~9.5k tokens against a 32k window's 16.4k before the
            // catalogue went on its diet), so every later turn compacted again.
            // ponytail: no tokenizer; tokens per char come from the last call's usage over
            // these messages' chars (tool schemas add tokens without chars, so it over-counts).
            const chars = this._messages.reduce((s, m) => s + messageChars(m), 0);
            const tokensPerChar = (this._lastUsage?.prompt_tokens || 0) / Math.max(chars, 1);
            const maxChars = tokensPerChar > 0 ? (this._compactAt() / 2) / tokensPerChar : Infinity;
            const newSystem = await this._buildSystemPrompt(this._lastMode || 'auto');
            const recent = this._getLastNUserTurns(this._messages, 4, maxChars);
            this._messages = [
                { role: 'system', content: newSystem },
                { role: 'assistant', content: `[Session compacted — handoff]\n${handoffText}` },
                ...recent,
            ];
            // What the dropped turns carried may be gone: list the notes again, re-read guides.
            this._notesProject = null;
            this._readIds.clear();
            this._boxed.clear();
            this._historyEntry('handoff', { text: handoffText });
        } catch (err) {
            // Compaction failure is non-fatal — log and continue
        }
        this._emit('agent:compacting', { turnId, on: false });
    }

    _getLastNUserTurns(messages, n, maxChars = Infinity) {
        // Collect message groups. Each group starts at a 'user' message.
        // Scan backwards, collecting up to n user-leading groups, newest first, and stop at
        // the first one that would take the total past maxChars.
        const groups = [];
        let kept = 0;
        let i = messages.length - 1;
        while (i >= 1 && groups.length < n) {
            if (messages[i].role === 'user') {
                // Find the start of this exchange (the user message and everything up to the next user message)
                let start = i;
                // Find end of this group: everything from this user message until (not including) the next user message
                const end = i + 1;
                // Walk forward from this user msg to find the end of the exchange
                let j = i + 1;
                while (j < messages.length && messages[j].role !== 'user') j++;
                const group = messages.slice(i, j);
                const size = group.reduce((s, m) => s + messageChars(m), 0);
                if (kept + size > maxChars) break;
                kept += size;
                groups.unshift(group);
                i--;
                while (i >= 1 && messages[i].role !== 'user') i--;
            } else {
                i--;
            }
        }
        return groups.flat();
    }

    // -------------------------------------------------------------------------
    // Run a turn (called by POST /agent/message)
    // -------------------------------------------------------------------------

    async runTurn(text, attachments, project, mode, profileId, turnId, { model: pickedModel, carried = false } = {}) {
        this._working = true;
        this._lastMode = mode;
        this._emit('agent:working', { turnId, working: true });
        const turnProject = project;
        const staged = (Array.isArray(attachments) ? attachments : []).filter((a) => a.id && a.filePath);

        try {
            // Resolve the shared connection, then the agent's model on it
            const { profile, key } = await this._resolveEndpoint(profileId);
            if (!profile) {
                this._emit('agent:error', { turnId, code: 'NO_PROFILE', message: 'Connection not found. Pick one in Settings → Remote → Language Models.' });
                return;
            }
            // Ollama /v1 is keyless: the same exemption `routes/llm.js` makes.
            if (!key && profileId !== 'ollama') {
                this._emit('agent:error', { turnId, code: 'NO_KEY', message: 'No API key for this connection. Add one in Settings → Remote → Language Models.' });
                return;
            }
            const model = this._resolveModel(profileId, pickedModel);
            if (!model) {
                this._emit('agent:error', { turnId, code: 'NO_MODEL', message: 'No agent model picked for this connection. Pick one in Settings → Remote → Language Models.' });
                return;
            }
            this._contextWindow = await this._contextWindowFor(profileId, model, profile, key);

            // Init session on first turn
            if (this._messages.length === 0) {
                const systemText = await this._buildSystemPrompt(mode);
                this._messages = [{ role: 'system', content: systemText }];
            } else if (this._messages[0]?.role === 'system') {
                // Update mode rules if mode changed
                this._messages[0].content = await this._buildSystemPrompt(mode);
            }

            // Attachments arrive ALREADY staged from POST /agent/message, which needs
            // their ids for its own reply. Staging them twice would give the chat and
            // the model different ids for the same picture.
            const stagedAttachments = [];
            const contentParts = [];
            if (text) contentParts.push({ type: 'text', text });

            // Numbered as the box numbers its chips, so "picture 2" names ONE image: unnumbered, the
            // model took an earlier turn's picture 1 for this message's (MPI-774 Phase 4).
            // The size is what an image-to-video ratio has to match: without it the model framed a
            // portrait start frame at 16:9 and the crop cut the head at the eyes (Phase 4).
            const list = Array.isArray(attachments) ? attachments : [];
            for (const [i, att] of list.entries()) {
                if (att.id && att.filePath) {
                    this._images.set(att.id, { path: att.filePath, kind: 'attachment', name: att.name });
                    stagedAttachments.push({ id: att.id, name: att.name });
                    const size = await _imageSize(att.filePath);
                    contentParts.push({ type: 'text', text: `[Attached image ${i + 1}: ${att.name} (id: ${att.id}${size ? `, ${size}` : ''})]` });
                } else {
                    contentParts.push({ type: 'text', text: `[Attached image ${i + 1}, ${att.name}, could not be staged: ${att.error || 'unknown error'}]` });
                }
            }

            // The model cannot see the app, so every turn opens with what it can reach.
            // Without it the model guessed folder paths, claimed no project was open while
            // one was, and passed look the literal "result filePath" (agent-test, 2026-09-16).
            // Then the project's notes (once per project) and what finished since last turn.
            // A carried request (D5) was asked in another conversation, which already opened this
            // project for it: unsaid, "open X" ran twice and the reply quoted the "From" prefix back.
            const handover = carried
                ? '[Handed over: the user asked this in another conversation, which already opened this project for it. Do only what is left of the request; if opening this project was all of it, say it is open and ask what to make.]'
                : '';
            const opening = [this._appStateLine(project), handover, await this._projectNotesLine(project), ...this._notes.splice(0)];
            contentParts.unshift(...opening.filter(Boolean).map((t) => ({ type: 'text', text: t })));

            // Add user message to LLM context (plain text for OpenAI compat)
            const userContent = contentParts.map((p) => p.text).join('\n');
            this._messages.push({ role: 'user', content: userContent });

            // Add to UI history. The sender's chat drew its own bubble; a carried request has no
            // sender in this conversation, so it is announced.
            const userEntry = this._historyEntry('user', { text, attachments: stagedAttachments });
            if (carried) this._emit('agent:user', { turnId, id: userEntry.id, text, attachments: stagedAttachments });

            // Build engine. Ollama is not an OpenAI-compatible host for this job — see
            // chatEngineFor. `contextWindow` is null on every other preset, so the option
            // is absent there and nothing changes.
            const { engine, contextWindow: askFor } = chatEngineFor(profileId, key, profile.baseURL);
            const chatOptions = askFor ? { contextWindow: askFor } : undefined;

            // Agentic loop
            let steps = 0;
            let carriedTo = null; // the project this request was handed to (D5)
            while (steps <= MAX_STEPS) {
                const llmRes = await engine.chat({ model, messages: this._messages, tools: TOOL_DEFS, options: chatOptions });
                this._lastUsage = llmRes.usage;

                const toolCalls = llmRes.toolCalls;

                if (!toolCalls || toolCalls.length === 0) {
                    // Final text response
                    const msgText = llmRes.text || '';
                    this._messages.push({ role: 'assistant', content: msgText });
                    const entry = this._historyEntry('agent', { text: msgText });
                    this._emit('agent:message', { turnId, id: entry.id, text: msgText });
                    break;
                }

                if (steps >= MAX_STEPS) {
                    this._emit('agent:error', { turnId, code: 'STEP_LIMIT', message: 'Too many tool calls in one turn. Please try a simpler request.' });
                    break;
                }

                // Add assistant message (with tool_calls) to context
                this._messages.push({ role: 'assistant', content: llmRes.text || '', tool_calls: toolCalls });

                // Execute each tool call. Once the request is handed to another project's
                // conversation (D5) the rest of the batch does not run, but a provider still
                // wants a result for every call.
                for (const tc of toolCalls) {
                    if (carriedTo) {
                        this._messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ ok: false, error: { code: 'HANDED_OVER', message: "Not run: this request continues in the project's own conversation." } }) });
                        continue;
                    }
                    const toolName = tc.function?.name || '';
                    let args = {};
                    try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* use {} */ }

                    const toolEntryId = crypto.randomUUID();
                    const label = _toolLabel(toolName, args);
                    this._emit('agent:tool', { turnId, id: toolEntryId, tool: toolName, status: 'started', label });
                    this._historyEntry('tool', { id: toolEntryId, tool: toolName, args, status: 'started', label });

                    let resultText;
                    let toolStatus = 'done';
                    try {
                        resultText = await this._executeTool(toolName, args, turnId, project);
                        // The app now has this project open, so a generate later in the same
                        // turn lands there instead of answering NO_PROJECT. `create_project`
                        // opens what it made, so it arrives here too — including the handover
                        // to that project's own conversation.
                        if (toolName === 'open_project' || toolName === 'create_project') {
                            const opened = JSON.parse(resultText);
                            if (opened?.ok && opened.output?.folderPath) {
                                project = { folderPath: opened.output.folderPath, name: opened.output.name };
                                const handover = this._onProjectOpened
                                    ? await this._onProjectOpened(this, project, { text, attachments: staged, mode, profileId, model: pickedModel, fromName: turnProject?.name })
                                    : null;
                                if (handover === 'carry') {
                                    carriedTo = project;
                                    // The files go with the request: a reset here must not delete them.
                                    for (const a of staged) this._images.delete(a.id);
                                    resultText = JSON.stringify({ ...opened, note: 'This project has its own conversation, and the request continues there.' });
                                } else {
                                    const notes = await this._projectNotesLine(project);
                                    if (notes) resultText = JSON.stringify({ ...opened, notes });
                                }
                            }
                        }
                    } catch (err) {
                        resultText = JSON.stringify({ ok: false, error: { code: 'TOOL_ERROR', message: err.message } });
                        toolStatus = 'failed';
                    }

                    // Update history entry status
                    const histEntry = this._history.find((e) => e.id === toolEntryId);
                    if (histEntry) { histEntry.status = toolStatus; histEntry.output = resultText; }
                    this._emit('agent:tool', { turnId, id: toolEntryId, tool: toolName, status: toolStatus, label });

                    // Append tool result to LLM context
                    this._messages.push({ role: 'tool', tool_call_id: tc.id, content: resultText });
                }

                if (carriedTo) {
                    const msg = `Opened ${carriedTo.name || 'the project'}. I'll carry on in its own chat.`;
                    this._messages.push({ role: 'assistant', content: msg });
                    const entry = this._historyEntry('agent', { text: msg });
                    this._emit('agent:message', { turnId, id: entry.id, text: msg });
                    break;
                }

                steps++;
            }

            // Compaction check
            if (this._shouldCompact()) {
                await this._compact(turnId, { model, baseURL: profile.baseURL, key, profileId });
            }
        } catch (err) {
            this._emit('agent:error', { turnId, code: 'ENDPOINT_ERROR', message: err.message });
        } finally {
            this._working = false;
            this._emit('agent:working', { turnId, working: false });
        }
    }

    // -------------------------------------------------------------------------
    // Confirm (POST /agent/confirm)
    // -------------------------------------------------------------------------

    async confirm(confirmId, yes) {
        const pc = this._pendingConfirm;
        if (!pc || pc.confirmId !== confirmId) return { ok: false, error: { code: 'UNKNOWN_CONFIRM', message: 'Unknown or already-answered confirmId.' } };

        if (!yes) {
            pc.resolve(JSON.stringify({ declined: true, message: 'User declined the installation.' }));
            return { ok: true };
        }

        // Run the install
        try {
            const r = await this._tools.installModel(pc.modelId);
            if (!r?.ok) {
                pc.resolve(JSON.stringify(r || { ok: false, error: { code: 'INSTALL_FAILED', message: 'Installation failed.' } }));
                return { ok: true };
            }
            // Verify with a real re-read. The model is ALWAYS in the list: what counts is its
            // `installed` flag (reading the entry alone told the model "installed successfully"
            // 30 s into a 6 GB download, MPI-774 Phase 4).
            const models = await this._tools.listModels();
            const installed = models?.models?.find((m) => m.id === pc.modelId)?.installed === true;
            // Said as a fact about the card: told only "Download started", the model answered as
            // if the card were still waiting ("it will begin once you click Yes").
            pc.resolve(JSON.stringify({
                ok: true,
                installed,
                message: installed
                    ? `The user pressed Yes and ${pc.modelName} is now installed.`
                    : `The user pressed Yes. ${pc.modelName} is downloading now (it shows in the app's downloads) and is not installed until that finishes. Tell them it is downloading.`,
            }));
        } catch (err) {
            pc.resolve(JSON.stringify({ ok: false, error: { code: 'INSTALL_ERROR', message: err.message } }));
        }
        return { ok: true };
    }

    // -------------------------------------------------------------------------
    // Probe (POST /agent/probe)
    // -------------------------------------------------------------------------

    /** Can the agent's model call a tool on this connection? (`POST /llm/connection/probe`
     *  is the job-agnostic reachability check; this one is the agent's own.) */
    async probe(profileId, pickedModel) {
        const { profile, key } = await this._resolveEndpoint(profileId);
        if (!profile) return { ok: false, error: { code: 'NO_PROFILE', message: 'Connection not found.' } };
        if (!key && profileId !== 'ollama') return { ok: false, error: { code: 'NO_KEY', message: 'No API key for this connection.' } };
        const model = this._resolveModel(profileId, pickedModel);
        if (!model) return { ok: false, error: { code: 'NO_MODEL', message: 'No agent model picked for this connection.' } };

        const start = Date.now();
        try {
            const { engine } = chatEngineFor(profileId, key, profile.baseURL);
            const probeTools = [{
                type: 'function',
                function: {
                    name: 'list_models',
                    description: 'List models.',
                    parameters: { type: 'object', properties: {} },
                },
            }];
            const res = await engine.chat({
                model,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: 'List models.' },
                ],
                tools: probeTools,
            });
            const latencyMs = Date.now() - start;
            const hasToolCall = Array.isArray(res.toolCalls) && res.toolCalls.length > 0;
            return {
                ok: true,
                tools: hasToolCall,
                model,
                latencyMs,
                message: hasToolCall
                    ? `Connected. Model called a tool in ${latencyMs} ms.`
                    : `Connected, but this model did not call a tool. Tool use may not be supported.`,
            };
        } catch (err) {
            const status = err.message?.match(/(\d{3})/)?.[1] ? parseInt(err.message.match(/(\d{3})/)[1]) : undefined;
            return { ok: false, error: { code: 'ENDPOINT_ERROR', message: err.message, ...(status && { status }) } };
        }
    }
}

// ---------------------------------------------------------------------------
// Tool label helper — plain copy shown in the UI, never the prompt
// ---------------------------------------------------------------------------

/** A chat message's size in chars: its content plus any tool calls it carries. */
function messageChars(m) {
    const content = typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content ?? '').length;
    return content + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0);
}

/** `/project-file?path=<abs>` for a path the engine (or a Pod) reads by reference. */
function _projectFileUrl(absPath) {
    return `/project-file?path=${encodeURIComponent(absPath)}`;
}

/**
 * The absolute path behind a result reference. A generation reports its output as a
 * plain absolute path today, but the gallery also carries the `/project-file?path=`
 * form, and `POST /connector/describe` stats the path it is given.
 */
function _decodeProjectFileUrl(ref) {
    if (typeof ref !== 'string' || !ref.includes('/project-file?')) return ref;
    try {
        return new URL(ref, 'http://127.0.0.1').searchParams.get('path') || ref;
    } catch { return ref; }
}

/** `WxH` of an image file, or '' when it cannot be read (the line then just omits it). */
async function _imageSize(filePath) {
    try {
        const { default: sharp } = await import('sharp');
        const { width, height } = await sharp(filePath).metadata();
        return width && height ? `${width}x${height}` : '';
    } catch { return ''; }
}

function _toolLabel(toolName, args) {
    switch (toolName) {
        case 'list_models':    return 'Checking available models';
        case 'describe_model': return `Reading ${args.id || 'a model'}'s settings`;
        case 'read_knowledge': return args.id ? `Reading: ${args.id}` : 'Reading knowledge index';
        case 'install_model':  return `Preparing install: ${args.modelId || '?'}`;
        case 'generate':       return `Starting generation`;
        case 'look':           return 'Looking at image';
        case 'list_projects':  return 'Checking your projects';
        case 'create_project': return `Creating project: ${args.name || ''}`;
        case 'open_project':   return `Opening project`;
        case 'rename_card':    return `Naming a card: ${args.name || ''}`;
        case 'read_memory':    return args.file ? 'Reading a project note' : 'Reading project notes';
        case 'write_memory':   return `Noted: ${args.title || args.file || ''}`;
        default:               return toolName;
    }
}

/**
 * A project folder as a comparable key: forward slashes, no trailing slash, and case-blind
 * where the file system is. '' for no folder (the landing page's conversation).
 */
export function projectKey(folderPath) {
    if (!folderPath) return '';
    const p = String(folderPath).replace(/\\/g, '/').replace(/\/+$/, '');
    return process.platform === 'win32' || process.platform === 'darwin' ? p.toLowerCase() : p;
}
