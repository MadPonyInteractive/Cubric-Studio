/**
 * services/agentLoop.mjs — the in-app agent loop (MPI-774 slice A).
 *
 * One session lives in server memory (brief item 14). The renderer re-renders
 * from GET /agent/history on mount, so Landing → Gallery → History keeps the
 * conversation. Nothing is written to disk.
 *
 * Design decisions (all Fabio-accepted, 2026-09-15):
 * - D2: install gate is structural (Yes / No card); the loop never calls install
 *   without a confirm.
 * - D3: replies arrive whole per model turn; token streaming is not in slice A.
 * - Non-blocking generate: the loop fires generate and gets back a "started"
 *   tool result; when the HTTP call settles, agent:result is emitted.
 * - Compaction at 50% (or 30% for windows ≥ 1M) of prompt_tokens / contextWindow,
 *   from the provider's own usage. No tokenizer.
 * - Endpoint profile + key come from the fork bridge (W3 owns the main-process
 *   handler). Standalone fallback: for the 'deepinfra' preset, DEEPINFRA_API_KEY
 *   env var — the same path llm.js already uses standalone.
 */

import crypto from 'crypto';
import { DeepInfraEngine } from './llmEngines.mjs';
import * as realTools from './agentTools.mjs';

// ---------------------------------------------------------------------------
// Tool definitions — OpenAI tools format
// ---------------------------------------------------------------------------

const TOOL_DEFS = [
    {
        type: 'function',
        function: {
            name: 'list_models',
            description: 'List all available models with their installed state, supported operations, hardware fit, and missing download size.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
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
            description: 'Start an image or video generation (model op or Flow). Fires without blocking — the result appears in the chat when ready. With no project open, this returns NO_PROJECT.',
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
                    fields: { type: 'object', description: 'Flow field values.' },
                    params: { type: 'object', description: 'Flow box params, e.g. { box1: { x, y, width, height } }.' },
                    media: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { role: { type: 'string' }, image: { type: 'string', description: 'Attachment id (att_xxx) or result filePath.' } },
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
            description: 'Describe an image. Pass an attachment id (att_xxx) or a result filePath. Optionally ask a specific question, crop to a region, or request a bounding box.',
            parameters: {
                type: 'object',
                properties: {
                    image: { type: 'string', description: 'Attachment id (att_xxx) or result filePath.' },
                    question: { type: 'string' },
                    crop: {
                        type: 'object',
                        properties: { x: { type: 'integer' }, y: { type: 'integer' }, width: { type: 'integer' }, height: { type: 'integer' } },
                        required: ['x', 'y', 'width', 'height'],
                    },
                    box: { type: 'boolean', description: 'Request a bounding box in the answer.' },
                },
                required: ['image'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'open_project',
            description: 'Open a project folder so that the next generate lands there.',
            parameters: {
                type: 'object',
                properties: {
                    folderPath: { type: 'string', description: 'Absolute path to the project folder.' },
                },
                required: ['folderPath'],
                additionalProperties: false,
            },
        },
    },
];

// Max tool calls the model may make in one user turn before STEP_LIMIT.
const MAX_STEPS = 8;

// DeepInfra preset profile (standalone fallback for 'deepinfra' profileId).
const DEEPINFRA_PRESET = {
    id: 'deepinfra',
    name: 'DeepInfra',
    baseURL: 'https://api.deepinfra.com/v1/openai',
    model: 'deepseek-ai/DeepSeek-V4-Flash-0731',
    contextWindow: 1_048_576,
};

// ---------------------------------------------------------------------------
// AgentLoop class — injectable for tests
// ---------------------------------------------------------------------------

export class AgentLoop {
    /**
     * @param {object} [opts]
     * @param {object} [opts.tools]         Connector tool implementation (defaults to agentTools.mjs).
     * @param {function} [opts.resolveEndpoint] (profileId) => { profile, key } overrides fork bridge.
     */
    constructor({ tools, resolveEndpoint } = {}) {
        this._tools = tools || realTools;
        this._resolveEndpointOverride = resolveEndpoint || null;

        // Session state
        this._messages = [];       // LLM context (system + turns)
        this._history = [];        // UI-facing entries
        this._working = false;
        this._pendingConfirm = null; // { confirmId, resolve }
        this._lastUsage = null;    // provider usage from last response
        this._contextWindow = 0;   // from active profile

        // Every image this session is allowed to reach: attachment ids the user
        // sent, and the outputs its own generations produced. See _resolveImage.
        this._images = new Map();  // ref -> { path, kind: 'attachment' | 'result' }

        // SSE subscribers
        this._subscribers = new Set();
    }

    // -------------------------------------------------------------------------
    // SSE
    // -------------------------------------------------------------------------

    addSubscriber(res) { this._subscribers.add(res); }
    removeSubscriber(res) { this._subscribers.delete(res); }

    _emit(event, data) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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
        this._pendingConfirm = null;
        this._working = false;
        this._messages = [];
        this._history = [];
        this._lastUsage = null;
        this._images.clear();
        try { await this._tools.initAttachmentDir(); } catch { /* non-fatal */ }
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

    /** Register a generation's output so a later `look` or reference can name it. */
    _registerResult(filePath) {
        if (!filePath || typeof filePath !== 'string') return;
        this._images.set(filePath, { path: _decodeProjectFileUrl(filePath), kind: 'result' });
    }

    // -------------------------------------------------------------------------
    // Endpoint resolution
    // -------------------------------------------------------------------------

    async _resolveEndpoint(profileId) {
        // Injected override (tests or probe)
        if (this._resolveEndpointOverride) return this._resolveEndpointOverride(profileId);

        // Fork bridge (Electron)
        let profile = null;
        let key = null;
        if (this._forkAsk) {
            const m = await this._forkAsk('secrets:get-endpoint-profile-request', { profileId });
            if (m) { profile = m.profile || null; key = m.key || null; }
        }

        // The 'deepinfra' preset reuses DEEPINFRA_API_KEY when no key is stored — the
        // order `routes/llm.js` already uses (stored key first, then the environment),
        // and NOT an Electron-vs-standalone split: a dev run and the harness run inside
        // Electron too, where an early return on the bridge's empty answer made the
        // environment key unreachable. Only ever sent to DeepInfra's own base URL, so an
        // edited profile cannot point the user's key at another host.
        if (!key && profileId === 'deepinfra' && process.env.DEEPINFRA_API_KEY) {
            const effective = profile || DEEPINFRA_PRESET;
            if (effective.baseURL === DEEPINFRA_PRESET.baseURL) {
                return { profile: effective, key: process.env.DEEPINFRA_API_KEY };
            }
        }

        return { profile, key };
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
                ? `Mode: Auto. Proceed when the goal is clear without asking about settings. For images: use turbo: true where the model offers it. For video: use qualityTier 'medium' and turbo: true where offered. Omit any param the model does not support.`
                : `Mode: Ask first. Ask the user about every model setting before generating.`;

        return `You are Cubric, a helpful assistant built into Cubric Vision, a desktop AI image and video tool.

${modeRules}

Installation rule: Always call install_model to show the user a Yes / No confirmation card. Never install a model without a Yes from the user, regardless of mode.

Project rule: Never invent a folder path. open_project only takes a path the user gave you. With no project open, say so and ask the user to open or create one — a generation has nowhere to land until they do.

Honest limits (I'm still a baby — this is my first version):
- I cannot watch videos or hear audio directly. I can only look at still images.
- I cannot paint masks or drive History tools (mask, paint, composite, transform).
- I cannot control RunPod.
- I do not remember anything after the app is restarted.
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
                return JSON.stringify(r);
            }
            case 'read_knowledge': {
                const r = await this._tools.readKnowledge(args?.id);
                return JSON.stringify(r);
            }
            case 'install_model': {
                // Step 1: look up the model's size so the confirm card can show it
                let modelName = args.modelId;
                let downloadGb = null;
                try {
                    const mr = await this._tools.listModels();
                    const m = mr?.models?.find((m) => m.id === args.modelId);
                    if (m) { modelName = m.name || args.modelId; downloadGb = m.missingDownloadGb ?? null; }
                } catch { /* ignore — size is shown as null */ }

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
                    return JSON.stringify({ ok: false, error: { code: 'NO_PROJECT', message: 'No project is open. Please open or create a project first.' } });
                }
                // Build connector body
                const body = {};
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
                if (Array.isArray(args.media) && args.media.length) {
                    const resolved = [];
                    for (const m of args.media) {
                        const ref = this._resolveImage(m.image);
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

                // Fire and don't await
                const toolCallId = crypto.randomUUID();
                this._tools.generate(body).then(async (r) => {
                    const ok = r && r.ok;
                    if (ok && r.output?.filePath) this._registerResult(r.output.filePath);
                    this._emit('agent:result', {
                        toolCallId,
                        ok,
                        ...(ok ? { output: r.output } : { error: r.error }),
                    });
                    this._historyEntry('result', { toolCallId, ok, ...(ok ? { output: r.output } : { error: r.error }) });

                    // Auto-look at image results (brief item 10)
                    if (ok && r.output?.type === 'image' && r.output?.filePath) {
                        try {
                            const lr = await this._tools.look({ imagePath: _decodeProjectFileUrl(r.output.filePath) });
                            if (lr?.ok) {
                                this._historyEntry('tool', {
                                    tool: 'look', args: { image: r.output.filePath }, status: 'done', label: 'Looked at result',
                                    output: lr.output,
                                });
                                // Append look result to context so the next turn knows what was seen
                                this._messages.push({ role: 'user', content: `[auto-look] ${lr.output?.text || ''}` });
                            }
                        } catch { /* look failure is non-fatal */ }
                    }
                }).catch((err) => {
                    this._emit('agent:result', { toolCallId, ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } });
                    this._historyEntry('result', { toolCallId, ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } });
                });

                return JSON.stringify({ ok: true, started: true, toolCallId, message: 'Generation started. The result will appear in the chat when ready.' });
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
                return JSON.stringify(r);
            }
            case 'open_project': {
                const r = await this._tools.openProject(args.folderPath);
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

    _shouldCompact() {
        if (!this._lastUsage || !this._contextWindow) return false;
        const pt = this._lastUsage.prompt_tokens || 0;
        const threshold = this._contextWindow >= 1_000_000 ? 0.30 : 0.50;
        return pt >= this._contextWindow * threshold;
    }

    async _compact(turnId, profile) {
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
            const engine = new DeepInfraEngine(profile.key, profile.baseURL);
            const handoffRes = await engine.chat({ model: profile.model, messages: handoffMessages });
            const handoffText = handoffRes.text || '';

            // Rebuild messages: system + handoff + last 4 user turns
            const newSystem = await this._buildSystemPrompt(this._lastMode || 'auto');
            const last4 = this._getLastNUserTurns(this._messages, 4);
            this._messages = [
                { role: 'system', content: newSystem },
                { role: 'assistant', content: `[Session compacted — handoff]\n${handoffText}` },
                ...last4,
            ];
            this._historyEntry('handoff', { text: handoffText });
        } catch (err) {
            // Compaction failure is non-fatal — log and continue
        }
        this._emit('agent:compacting', { turnId, on: false });
    }

    _getLastNUserTurns(messages, n) {
        // Collect message groups. Each group starts at a 'user' message.
        // Scan backwards, collecting up to n user-leading groups.
        const groups = [];
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
                groups.unshift(messages.slice(i, j));
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

    async runTurn(text, attachments, project, mode, profileId, turnId) {
        this._working = true;
        this._lastMode = mode;
        this._emit('agent:working', { turnId, working: true });

        try {
            // Resolve profile and key
            const { profile, key } = await this._resolveEndpoint(profileId);
            if (!profile) {
                this._emit('agent:error', { turnId, code: 'NO_PROFILE', message: 'Endpoint profile not found.' });
                return;
            }
            if (!key) {
                this._emit('agent:error', { turnId, code: 'NO_KEY', message: 'No API key found for this profile. Add a key in Settings → Agent.' });
                return;
            }
            this._contextWindow = profile.contextWindow || 1_048_576;

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

            for (const att of (Array.isArray(attachments) ? attachments : [])) {
                if (att.id && att.filePath) {
                    this._images.set(att.id, { path: att.filePath, kind: 'attachment' });
                    stagedAttachments.push({ id: att.id, name: att.name });
                    contentParts.push({ type: 'text', text: `[Attached image: ${att.name} (id: ${att.id})]` });
                } else {
                    contentParts.push({ type: 'text', text: `[Attachment ${att.name} could not be staged: ${att.error || 'unknown error'}]` });
                }
            }

            // Add user message to LLM context (plain text for OpenAI compat)
            const userContent = contentParts.map((p) => p.text).join('\n');
            this._messages.push({ role: 'user', content: userContent });

            // Add to UI history
            this._historyEntry('user', { text, attachments: stagedAttachments });

            // Build engine
            const engine = new DeepInfraEngine(key, profile.baseURL);

            // Agentic loop
            let steps = 0;
            while (steps <= MAX_STEPS) {
                const llmRes = await engine.chat({ model: profile.model, messages: this._messages, tools: TOOL_DEFS });
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

                // Execute each tool call
                for (const tc of toolCalls) {
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

                steps++;
            }

            // Compaction check
            if (this._shouldCompact()) {
                await this._compact(turnId, { model: profile.model, baseURL: profile.baseURL, key });
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
            // Verify with a real re-read
            const models = await this._tools.listModels();
            const installed = models?.models?.find((m) => m.id === pc.modelId);
            pc.resolve(JSON.stringify({
                ok: true,
                installed: !!installed,
                message: installed
                    ? `${pc.modelName} was installed successfully.`
                    : `Download started for ${pc.modelName}. It will be ready shortly.`,
            }));
        } catch (err) {
            pc.resolve(JSON.stringify({ ok: false, error: { code: 'INSTALL_ERROR', message: err.message } }));
        }
        return { ok: true };
    }

    // -------------------------------------------------------------------------
    // Probe (POST /agent/probe)
    // -------------------------------------------------------------------------

    async probe(profileId) {
        const { profile, key } = await this._resolveEndpoint(profileId);
        if (!profile) return { ok: false, error: { code: 'NO_PROFILE', message: 'Profile not found.' } };
        if (!key) return { ok: false, error: { code: 'NO_KEY', message: 'No API key found for this profile.' } };

        const start = Date.now();
        try {
            const engine = new DeepInfraEngine(key, profile.baseURL);
            const probeTools = [{
                type: 'function',
                function: {
                    name: 'list_models',
                    description: 'List models.',
                    parameters: { type: 'object', properties: {} },
                },
            }];
            const res = await engine.chat({
                model: profile.model,
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
                model: profile.model,
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

function _toolLabel(toolName, args) {
    switch (toolName) {
        case 'list_models':    return 'Checking available models';
        case 'read_knowledge': return args.id ? `Reading: ${args.id}` : 'Reading knowledge index';
        case 'install_model':  return `Preparing install: ${args.modelId || '?'}`;
        case 'generate':       return `Starting generation`;
        case 'look':           return 'Looking at image';
        case 'open_project':   return `Opening project`;
        default:               return toolName;
    }
}

// ---------------------------------------------------------------------------
// Module-level singleton used by routes/agent.js
// ---------------------------------------------------------------------------

export const defaultLoop = new AgentLoop();
