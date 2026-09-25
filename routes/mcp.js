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
 * SPIKE (MPI-593 phase 1): eight tools, enough to prove "make me an image" end to end.
 * The in-app agent's gates live in `agentLoop._executeTool`, not in the routes, so this file
 * carries its own spend gate (`spendGate`). The guide and mask gates do not apply here.
 *
 * `routes/localOnly.js` runs first, so a browser page cannot reach this; Node, Rust and
 * Python clients send no Origin and pass on Host alone.
 */

const crypto = require('crypto');
const express = require('express');
const logger = require('./logger');
const { version } = require('../package.json');

const router = express.Router();

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];

// Most MCP clients give a tool call 60 s (Claude Code, Codex, the TS SDK). The spike's cold
// agent waited on a 2K render that took 73 s, was told it failed, and ran it AGAIN while the
// first one landed: two images for one ask, and on a paid model two bills. So a generation
// answers within this window, and one still running hands back a jobId to wait on instead.
const WAIT_MS = Number(process.env.CUBRIC_MCP_WAIT_MS) || 45_000;
const _jobs = new Map(); // jobId -> promise of the route's answer; it never rejects

function startJob(promise) {
    const jobId = crypto.randomUUID();
    _jobs.set(jobId, promise.catch((err) => ({ ok: false, error: { code: 'FAILED', message: err.message } })));
    // ponytail: in memory, gone on restart; the card is in the gallery either way.
    setTimeout(() => _jobs.delete(jobId), 3_600_000).unref();
    return jobId;
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

async function waitForJob(jobId) {
    const job = _jobs.get(jobId);
    if (!job) return { ok: false, error: { code: 'UNKNOWN_JOB', message: `No generation "${jobId}" is running here. Its card may already be in the gallery.` } };
    let timer;
    const late = new Promise((resolve) => { timer = setTimeout(resolve, WAIT_MS, null); });
    try {
        return (await Promise.race([job, late])) ?? {
            ok: true, running: true, jobId,
            message: 'Still running. Call wait_generation with this jobId. Do NOT call generate again: that makes a second one.',
        };
    } finally {
        clearTimeout(timer);
    }
}

const INSTRUCTIONS = [
    'Cubric Studio is a desktop app for making images and video on this computer. These tools drive the copy the user has open.',
    'A generation lands in the project the app has OPEN. Before generating, find the project with list_projects and call open_project, or call create_project (it opens what it makes).',
    'Pick a model with list_models (the op marked best:true is the recommended one for its task), then call describe_model for that id: it lists the ops and the only values each param accepts.',
    'generate returns the result\'s file path and card id, or { running: true, jobId } for a slow one: then call wait_generation until it finishes. Never re-send generate for a job that is still running. The card also appears in the app\'s gallery.',
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
        description: 'Every model and Flow the app offers: id, what is installed, the ops each model runs and their rank per task. Settings are NOT here; describe_model has them.',
        inputSchema: obj(),
        annotations: READ,
        run: async () => (await catalogue()).compactCatalogue(await (await tools()).listModels()),
    },
    describe_model: {
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
        description: 'The user\'s projects, most recent first, each with the folderPath open_project takes.',
        inputSchema: obj(),
        annotations: READ,
        run: async () => (await tools()).listProjects(),
    },
    create_project: {
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
        description: 'Make a project the open one, so the next generation lands in it.',
        inputSchema: obj({ folderPath: { type: 'string', description: 'From list_projects or create_project.' } }, ['folderPath']),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        run: async ({ folderPath }) => (await tools()).openProject(folderPath),
    },
    generate: {
        description: 'Generate an image or video with a model op, or run a Flow, in the OPEN project. Send modelId + operation, or flowId, never both. Named params take only the values describe_model lists. Returns the result, or { running: true, jobId } when it takes longer than 45 s: then call wait_generation, never generate again. A paid model first answers CONFIRM_COST with its price and generates nothing.',
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
                cardName: { type: 'string', description: 'A short name for the gallery card this creates.' },
                fields: { type: 'object', description: 'A Flow\'s field values, as describe_model lists them.' },
                confirmCost: { type: 'string', description: 'Only after the user agreed to the price a CONFIRM_COST answer named: that price, exactly as given.' },
            },
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
        run: async ({ confirmCost, ...body }) => {
            const t = await tools();
            return (await spendGate(t, body, confirmCost)) ?? waitForJob(startJob(t.generate(body)));
        },
    },
    wait_generation: {
        description: 'Wait up to 45 s more for a generation that answered { running: true, jobId }. Call it again while it still says running.',
        inputSchema: obj({ jobId: { type: 'string' } }, ['jobId']),
        annotations: READ,
        run: async ({ jobId }) => waitForJob(jobId),
    },
};

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function callTool(name, args) {
    const tool = TOOLS[name];
    if (!tool) return { isError: true, content: [{ type: 'text', text: `Unknown tool "${name}".` }] };
    try {
        const r = await tool.run(args || {});
        return { isError: r?.ok === false, content: [{ type: 'text', text: JSON.stringify(r) }] };
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
    // A notification (no id) gets no answer: 202, empty body.
    if (msg.id === undefined) return res.status(202).end();

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
                tools: Object.entries(TOOLS).map(([name, t]) => ({
                    name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations,
                })),
            }));
        case 'tools/call':
            logger.info('mcp', `tools/call ${params?.name}`);
            return res.json(rpcResult(id, await callTool(params?.name, params?.arguments)));
        default:
            return res.json(rpcError(id, -32601, `Method not found: ${method}`));
    }
});

// No server-initiated stream and no sessions to end: the spec's answer to both is 405.
router.get('/mcp', (_req, res) => res.status(405).end());
router.delete('/mcp', (_req, res) => res.status(405).end());

module.exports = router;
