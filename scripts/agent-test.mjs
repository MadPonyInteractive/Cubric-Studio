#!/usr/bin/env node
/**
 * agent-test.mjs — the in-app agent's scripted harness (MPI-774, brief § Testing).
 *
 * The REAL loop and the REAL model (the deepinfra preset's recommended agent model, key from
 * DEEPINFRA_API_KEY) against FAKE tools: no app, no GPU, no generation. The models fixture in
 * tests/fixtures/agent/ is the real /connector/models payload captured from an isolated
 * instance, given each model's guide ids and media roles by the same functions the route
 * uses; knowledge is the live corpus the route serves. So the model reads what it reads in
 * the app.
 *
 * Graded by exact assertions on the calls the MODEL made (the loop's history), never by a judge.
 * Each case runs --runs times (default 3) and passes only when every run passes: one green is a
 * luck pass. --bite runs each case once with its `flip` and expects it to FAIL, which is the proof
 * that an assertion can see the failure it names.
 *
 *   npm run agent:test                        # every case, 3 runs each
 *   npm run agent:test -- --case ask-first    # one case (repeatable)
 *   npm run agent:test -- --bite              # every flip, 1 run each, all must fail
 *   npm run agent:test -- --runs 1 --model <id>
 *   npm run agent:test -- --samples <file.md>  # the prompt-quality sample, for a human to read
 *
 * Cost per run is the provider's own `usage` times DeepInfra's live price for the model
 * (cached prompt tokens are priced as fresh input, so it errs high). Exit 1 on any failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { AgentLoop, projectKey } from '../services/agentLoop.mjs';
import { DeepInfraEngine, fetchDeepInfraPrices, recommendedModel } from '../services/llmEngines.mjs';
import { listCorpus, guideIdsByModel } from '../services/agentCorpus.mjs';
import * as commandRegistry from '../js/data/commandRegistry.js';
import { resolveNamedParams } from '../js/data/generationControls.js';
import { MODELS as MODEL_DEFS } from '../js/data/modelConstants/models.js';
import { resolveRecipe } from '../js/data/recipes/registry.js';
import { DEFAULT_STYLE } from '../js/data/recipes/styles.js';
import { runChecks } from './recipe-test.mjs';

const { mediaRolesFor } = createRequire(import.meta.url)('../routes/connector.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'tests/fixtures/agent');
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8'));
const LOOKS = readFixture('looks.json');

// What GET /connector/models adds to the renderer's list, by the route's own functions.
const GUIDES = guideIdsByModel();
const CAPTURED = readFixture('connector-models.json');
const MODELS = {
    ...CAPTURED,
    models: CAPTURED.models.map((m) => ({
        ...m,
        ops: m.ops.map((o) => ({ ...o, media: mediaRolesFor(commandRegistry, o.op, MODEL_DEFS.find((d) => d.id === m.id)) })),
        guides: GUIDES[m.id] || [],
    })),
};

// What GET /connector/knowledge serves: the live corpus.
const CORPUS = listCorpus();

const DI_URL = 'https://api.deepinfra.com/v1/openai';
const PROJECTS_ROOT = 'C:/Users/maker/Documents/Cubric';
const PROJECT = { folderPath: `${PROJECTS_ROOT}/Fox Shoot`, name: 'Fox Shoot' };
// What GET /connector/projects lists (Phase 3c), most recent first.
const PROJECTS = [PROJECT, { name: 'Harbour Nights' }, { name: 'Wedding Stills' }]
    .map((p) => ({ folderPath: `${PROJECTS_ROOT}/${p.name}`, ...p, updatedAt: '2026-09-16T10:00:00Z' }));
const RESULT_URL = `/project-file?path=${encodeURIComponent(`${PROJECT.folderPath}/Media/t2i_001.png`)}`;
const FOX = { id: 'att_fox', name: 'fox.png', filePath: 'C:/Temp/cubric-agent/attachments/att_fox.png' };
const FRAME = { id: 'att_frame', name: 'frame-from-my-video.png', filePath: 'C:/Temp/cubric-agent/attachments/att_frame.png' };
const WAVES = 'Make a 5 second video of waves crashing on rocks at sunset.';

// ── Fixture edits ─────────────────────────────────────────────────────────────

/** The models payload with every model matching `pred` installed or not, ops included. */
function setInstalled(pred, installed) {
    return {
        ...MODELS,
        models: MODELS.models.map((m) => (pred(m) ? {
            ...m,
            installed,
            ops: m.ops.map((o) => ({ ...o, installed })),
            missingDownloadGb: installed ? 0 : (m.missingDownloadGb || 40),
        } : m)),
    };
}
const NO_IMAGE_MODELS = setInstalled((m) => m.type === 'image', false);
const NO_VIDEO_MODELS = setInstalled((m) => m.type === 'video', false);
const LTX_BALANCED_INSTALLED = setInstalled((m) => m.id === 'ltx-23-balanced', true);

// ── Fake tools (the agentTools.mjs surface) ───────────────────────────────────

function fakeTools({ models = MODELS, look = LOOKS.fox, noGuides = false, notes = [], projects = PROJECTS, memoryFull = false }) {
    const record = { installs: [], generates: [], looks: [], opens: [], writes: [], renames: [], creates: [] };
    const known = [...projects];
    // --bite for the guide case: no model has a guide, and the index offers none to read.
    const served = noGuides
        ? { ...models, models: models.models.map((m) => ({ ...m, guides: [] })) }
        : models;
    const corpus = noGuides ? CORPUS.filter((e) => e.kind !== 'guide') : CORPUS;
    const store = new Map(notes.map((n) => [n.file, n]));
    const tools = {
        listModels: async () => structuredClone(served),
        readKnowledge: async (id) => {
            if (!id) return { ok: true, entries: corpus.map(({ id: i, kind, title, tags }) => ({ id: i, kind, title, tags })) };
            const e = corpus.find((x) => x.id === id);
            return e ? { ok: true, id, title: e.title, text: e.text() } : { ok: false, error: { code: 'UNKNOWN_ENTRY', message: `No corpus entry "${id}".` } };
        },
        // The project's notes, in memory, answering the way /connector/memory does.
        readMemory: async (folderPath, file) => {
            if (!file) return { ok: true, notes: [...store.values()].map(({ file: f, title, hook }) => ({ file: f, title, hook: hook || '' })) };
            const n = store.get(file);
            return n ? { ok: true, file, text: n.text } : { ok: false, error: { code: 'UNKNOWN_NOTE', message: `No note "${file}" in this project.` } };
        },
        writeMemory: async (folderPath, note) => {
            record.writes.push({ folderPath, ...note });
            if (!/^[a-z0-9][a-z0-9-]{0,60}\.md$/.test(note.file || '')) {
                return { ok: false, error: { code: 'BAD_REQUEST', message: 'file must be a lowercase slug ending in .md, like "main-character.md".' } };
            }
            if (memoryFull) return { ok: false, error: { code: 'MEMORY_FULL', message: 'This project already has 100 notes: update one instead.' } };
            const created = !store.has(note.file);
            store.set(note.file, note);
            return { ok: true, file: note.file, created };
        },
        renameCard: async (groupId, name) => { record.renames.push({ groupId, name }); return { ok: true, output: { groupId, name } }; },
        installModel: async (modelId) => {
            record.installs.push({ modelId, at: Date.now() });
            const m = models.models.find((x) => x.id === modelId);
            return m ? { ok: true, modelId, downloadGb: m.missingDownloadGb, started: true }
                : { ok: false, error: { code: 'UNKNOWN_MODEL', message: `Unknown model "${modelId}".` } };
        },
        // Refuses the way POST /connector/generate does (the named params through the
        // app's own validator), so the model gets the error it would get in the app.
        generate: async (body) => {
            record.generates.push(body);
            if (!body.flowId && (!body.modelId || !body.operation)) {
                return { ok: false, error: { code: 'BAD_REQUEST', message: 'body.flowId, or body.modelId and body.operation, are required.' } };
            }
            const m = models.models.find((x) => x.id === body.modelId);
            if (body.modelId && !m) return { ok: false, error: { code: 'UNKNOWN_MODEL', message: `Unknown model "${body.modelId}".` } };
            if (m) {
                const named = Object.fromEntries(['ratio', 'qualityTier', 'turbo', 'styleSelect', 'stylization']
                    .filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
                const v = resolveNamedParams(null, MODEL_DEFS.find((d) => d.id === m.id), body.operation, named);
                if (!v.ok) return { ok: false, error: { code: v.code, message: v.message } };
                if (!m.ops.some((o) => o.op === body.operation && o.installed)) {
                    return { ok: false, error: { code: 'MODEL_NOT_INSTALLED', message: `${m.name} cannot run ${body.operation}: not installed.` } };
                }
            }
            return { ok: true, output: { itemId: 'item_1', groupId: 'grp_1', type: m?.type || 'image', filePath: RESULT_URL } };
        },
        look: async (args) => { record.looks.push(args); return structuredClone(look); },
        // The project routes the way /connector/projects and /connector/create-project answer.
        listProjects: async () => ({ ok: true, projects: structuredClone(known), total: known.length }),
        createProject: async (name) => {
            record.creates.push(name);
            const taken = known.some((p) => p.name.toLowerCase() === String(name).toLowerCase());
            const project = { name, folderPath: `${PROJECTS_ROOT}/${name}${taken ? '_4f2a91c0' : ''}` };
            known.unshift({ ...project, updatedAt: '2026-09-17T09:00:00Z' });
            return { ok: true, project };
        },
        // Opens only a project that exists: listed, or created in this conversation.
        openProject: async (folderPath) => {
            record.opens.push(folderPath);
            if (!folderPath) return { ok: false, error: { code: 'BAD_REQUEST', message: 'body.folderPath is required.' } };
            const p = known.find((x) => projectKey(x.folderPath) === projectKey(folderPath));
            return p
                ? { ok: true, output: { folderPath: p.folderPath, name: p.name, groupCount: 0 } }
                : { ok: false, error: { code: 'NO_SUCH_PROJECT', message: `Could not open "${folderPath}": not a Cubric project.` } };
        },
        placeAsset: async () => ({ success: true, filePath: `/project-file?path=${encodeURIComponent(`${PROJECT.folderPath}/Media/.preview-assets/fox.png`)}` }),
        saveAttachment: async () => { throw new Error('the harness stages attachments itself'); },
        initAttachmentDir: async () => {},
        attachmentDir: () => 'C:/Temp/cubric-agent/attachments',
        cropDir: () => 'C:/Temp/cubric-agent/crops',
    };
    return { tools, record };
}

// ── The cases (brief § Testing) ───────────────────────────────────────────────
// `setup` is the conversation; `check(run)` returns the failures (none = pass);
// `flip` is merged over `setup` for --bite and must make `check` fail.

const called = (turn, tool) => turn.calls.filter((c) => c.tool === tool);
const calledAll = (run, tool) => run.turns.flatMap((t) => called(t, tool));
const parseJson = (text) => { try { return JSON.parse(text); } catch { return text ?? null; } };
/** Generate calls the app refused on a named param: the model sent what the op does not offer. */
const refusedParams = (run) => calledAll(run, 'generate')
    .filter((c) => /^INVALID_/.test(c.result?.error?.code || ''))
    .map((c) => `${c.result.error.code} on ${c.args.modelId}/${c.args.operation}`);
const modelById = (id) => MODELS.models.find((m) => m.id === id);
/** open_project calls the loop refused: a folder nobody gave the model. */
const invented = (run) => calledAll(run, 'open_project')
    .filter((c) => c.result?.error?.code === 'UNKNOWN_PROJECT')
    .map((c) => `tried to open a folder nobody gave it (${c.args.folderPath})`);
const REFUSAL = /(refus|declin|won['’]?t|can['’]?t|cannot|unable|not able)/i;

const CASES = [
    {
        id: 'picks-installed-model',
        title: 'picks an installed model that supports the op',
        setup: { turns: ['Make an image of a red fox standing in fresh snow at dawn.'] },
        flip: { models: NO_IMAGE_MODELS },
        check(run) {
            const gens = calledAll(run, 'generate');
            if (gens.length < 1) return ['no generate call'];
            const f = [];
            const first = gens[0].args;
            const m = modelById(first.modelId);
            if (!m) f.push(`first generate names unknown model "${first.modelId}"`);
            else if (m.type !== 'image') f.push(`first generate picked a ${m.type} model (${m.id})`);
            if (first.operation !== 't2i') f.push(`first generate operation is "${first.operation}", not t2i`);
            const installed = run.models.models.find((x) => x.id === first.modelId)?.ops.some((o) => o.op === first.operation && o.installed);
            if (!installed) f.push(`${first.modelId}/${first.operation} is not installed`);
            if (calledAll(run, 'install_model').length) f.push('asked to install although an installed model fits');
            f.push(...refusedParams(run).map((r) => `sent a param the op does not offer: ${r}`));
            return f;
        },
    },
    {
        id: 'install-needed',
        title: 'says an install is needed when no installed model fits',
        setup: { models: NO_VIDEO_MODELS, turns: [WAVES], confirm: false },
        flip: { models: MODELS },
        check(run) {
            const f = [];
            if (run.record.generates.length) f.push(`generated with no video model installed (${run.record.generates.map((g) => g.modelId).join(', ')})`);
            const asked = calledAll(run, 'install_model').some((c) => modelById(c.args.modelId)?.type === 'video');
            if (!asked && !/install|download/i.test(run.lastReply)) f.push('neither offered a video model install nor said one is needed');
            return f;
        },
    },
    {
        id: 'auto-video-medium-turbo',
        title: 'Auto + video -> qualityTier medium + turbo, zero questions',
        setup: { mode: 'auto', turns: [WAVES] },
        flip: { mode: 'ask' },
        check(run) {
            const gens = called(run.turns[0], 'generate').filter((c) => modelById(c.args.modelId)?.type === 'video');
            if (!gens.length) return ['no video generate in the first turn (it asked, or gave up)'];
            const a = gens[0].args;
            const f = [];
            if (a.qualityTier !== 'medium') f.push(`qualityTier is ${JSON.stringify(a.qualityTier)}, not "medium"`);
            if (a.turbo !== true) f.push(`turbo is ${JSON.stringify(a.turbo)}, not true`);
            f.push(...refusedParams(run).map((r) => `sent a param the op does not offer: ${r}`));
            return f;
        },
    },
    {
        id: 'ask-first',
        title: 'Ask first asks before generating',
        setup: { mode: 'ask', turns: [WAVES, 'Medium quality, turbo on, 16:9. Go ahead.'] },
        flip: { mode: 'auto' },
        check(run) {
            const f = [];
            if (called(run.turns[0], 'generate').length) f.push('generated in the first turn without asking');
            if (!run.turns[0].reply.includes('?')) f.push('the first reply asks no question');
            if (!called(run.turns[1], 'generate').length) f.push('did not generate once the settings were answered');
            return f;
        },
    },
    {
        id: 'install-asks',
        title: 'installs always ask (Yes card), and run only after Yes',
        setup: { mode: 'auto', turns: ['Install the LTX 2.3 Balanced video model for me.'], confirm: true },
        flip: { models: LTX_BALANCED_INSTALLED },
        check(run) {
            const f = [];
            const cards = run.events.filter((e) => e.event === 'agent:confirm');
            if (cards.length !== 1 || cards[0].data.modelId !== 'ltx-23-balanced') {
                f.push(`expected one install card for ltx-23-balanced, got ${JSON.stringify(cards.map((c) => c.data.modelId))}`);
            }
            if (run.record.installs.length !== 1) f.push(`install ran ${run.record.installs.length} times, expected once`);
            else if (!cards.length || run.record.installs[0].at < cards[0].at) f.push('install ran before the card was answered');
            return f;
        },
    },
    {
        id: 'look-before-comment',
        title: 'calls look before commenting on an image',
        setup: { attachments: [FOX], turns: ['What do you think of this picture? Anything I should fix before I use it?'] },
        flip: { attachments: [] },
        check(run) {
            const looks = called(run.turns[0], 'look').filter((c) => c.args.image === FOX.id);
            const f = [];
            if (!looks.length) f.push('commented without looking at att_fox');
            if (!run.record.looks.length) f.push('the look never reached the describer');
            return f;
        },
    },
    {
        id: 'look-refusal',
        title: 'a look refusal -> says so and suggests the local describer',
        setup: { attachments: [FOX], look: LOOKS.refusal, turns: ['Describe this photo for me.'] },
        flip: { look: LOOKS.fox },
        check(run) {
            const f = [];
            const r = run.lastReply;
            if (!calledAll(run, 'look').length) f.push('never looked');
            if (!REFUSAL.test(r)) f.push('did not say the describer refused');
            if (!(/local/i.test(r) && /describ/i.test(r))) f.push('did not suggest the local describer');
            return f;
        },
    },
    {
        id: 'video-limit',
        title: '"watch this video" -> the honest limit',
        setup: { turns: ['Watch the video I generated earlier and tell me if the motion looks smooth.'] },
        flip: { attachments: [FRAME], turns: ['Here is a frame from the video I generated. Look at it and tell me if the motion looks smooth.'] },
        check(run) {
            const f = [];
            if (calledAll(run, 'look').length) f.push('called look for a video request');
            if (calledAll(run, 'generate').length) f.push('generated for a video review request');
            if (!(REFUSAL.test(run.lastReply) && /(watch|video|motion|still image)/i.test(run.lastReply))) f.push('did not state that it cannot watch video');
            return f;
        },
    },
    // Phase 3c (Fabio, 2026-09-16) replaced "asks for a project": the landing agent makes one.
    {
        id: 'create-then-generate',
        title: 'landing page, no project -> creates "New Project", opens it, generates there',
        setup: { project: null, turns: ['Make an image of a cat asleep on a sunny windowsill.'] },
        flip: { project: PROJECT },
        check(run) {
            const calls = run.turns.flatMap((t) => t.calls);
            const created = calls.findIndex((c) => c.tool === 'create_project' && c.result?.ok);
            if (created < 0) return ['no project was created'];
            const f = [];
            const made = calls[created].result.project;
            if (!/new project/i.test(made.name)) f.push(`created "${made.name}", not "New Project"`);
            const opened = calls.findIndex((c, i) => i > created && c.tool === 'open_project' && c.result?.ok && c.args.folderPath === made.folderPath);
            if (opened < 0) f.push('did not open the project it created');
            else if (!calls.some((c, i) => i > opened && c.tool === 'generate' && c.result?.ok)) f.push('no generate went through after opening it');
            f.push(...invented(run));
            return f;
        },
    },
    {
        id: 'open-by-name',
        title: 'opens a project by its name, with the folder list_projects gave',
        setup: { project: null, turns: ['Open my Harbour Nights project. Nothing else for now.'] },
        flip: { projects: PROJECTS.filter((p) => p.name !== 'Harbour Nights') },
        check(run) {
            const f = [];
            const target = PROJECTS.find((p) => p.name === 'Harbour Nights').folderPath;
            if (!calledAll(run, 'list_projects').length) f.push('never listed the projects');
            if (!calledAll(run, 'open_project').some((c) => c.result?.ok && c.args.folderPath === target)) f.push('did not open Harbour Nights');
            if (run.record.creates.length) f.push(`created a project (${run.record.creates.join(', ')}) instead of opening one`);
            if (run.record.generates.length) f.push('generated without being asked');
            f.push(...invented(run));
            return f;
        },
    },
    {
        id: 'new-project-brief',
        title: 'a new project with a goal -> named after it, opened, and a brief note saved there',
        setup: { project: null, turns: ["Let's start a new project. The goal is a short film about a lighthouse keeper who befriends a seal."] },
        flip: { turns: ['Make an image of a lighthouse keeper feeding a seal.'] },
        check(run) {
            const calls = run.turns.flatMap((t) => t.calls);
            const created = calls.find((c) => c.tool === 'create_project' && c.result?.ok);
            if (!created) return ['no project was created'];
            const f = [];
            const made = created.result.project;
            if (!/lighthouse|seal/i.test(made.name)) f.push(`the project is named "${made.name}", not after the goal`);
            const opened = calls.findIndex((c) => c.tool === 'open_project' && c.result?.ok && c.args.folderPath === made.folderPath);
            if (opened < 0) f.push('did not open the new project');
            const brief = calls.find((c, i) => i > opened && c.tool === 'write_memory' && c.result?.ok && /lighthouse/i.test(`${c.args.title} ${c.args.text}`));
            if (!brief) f.push('no project-brief note about the lighthouse film after opening it');
            else if (!run.record.writes.some((w) => w.file === brief.args.file && w.folderPath === made.folderPath)) f.push('the brief note went to another project');
            if (run.record.generates.length) f.push('generated without being asked');
            f.push(...invented(run));
            return f;
        },
    },
    // ── Phase 3b (Fabio, 2026-09-16) ──
    {
        id: 'reads-guide-first',
        title: "reads the model's guide before its first prompt for it",
        setup: { turns: [WAVES] },
        flip: { noGuides: true },
        check(run) {
            const calls = run.turns.flatMap((t) => t.calls);
            const first = calls.findIndex((c) => c.tool === 'generate' && c.result?.ok);
            if (first < 0) return ['no generate went through'];
            const modelId = calls[first].args.modelId;
            const guides = new Set(run.models.models.find((m) => m.id === modelId)?.guides || []);
            const read = calls.slice(0, first).some((c) => c.tool === 'read_knowledge' && c.result?.ok && guides.has(c.args.id));
            return read ? [] : [`generated with ${modelId} before reading its guide (${[...guides].join(', ') || 'none offered'})`];
        },
    },
    {
        id: 'memory-read',
        title: 'reads a project note before relying on it',
        setup: {
            notes: [{
                file: 'mira.md', title: 'Mira', hook: 'the main character of this project',
                text: 'Mira is a courier in her twenties: a long red braid, a bright yellow raincoat and a battered silver bicycle.',
            }],
            turns: ['Make an image of Mira riding through the harbour at night.'],
        },
        flip: { notes: [] },
        check(run) {
            const calls = run.turns.flatMap((t) => t.calls);
            const readAt = calls.findIndex((c) => c.tool === 'read_memory' && c.args.file === 'mira.md' && c.result?.ok);
            const gen = calls.findIndex((c) => c.tool === 'generate' && c.result?.ok);
            if (readAt < 0) return ['never read mira.md'];
            if (gen < 0) return ['no generate went through'];
            if (readAt > gen) return ['generated before reading the note'];
            return /raincoat/i.test(calls[gen].args.prompt || '') ? [] : ['the prompt does not use the note (no raincoat)'];
        },
    },
    {
        id: 'memory-write',
        title: 'saves what the user asks it to remember about the project',
        setup: { turns: ['Remember for this project: every image is 16:9, it is all for YouTube thumbnails. No need to generate anything yet.'] },
        // Not `project: null` any more: with no project the agent may now make one and save the note there.
        flip: { memoryFull: true },
        check(run) {
            const saved = calledAll(run, 'write_memory').filter((c) => c.result?.ok && /16:9/.test(`${c.args.title} ${c.args.text}`));
            return saved.length ? [] : ['no note holding 16:9 was saved'];
        },
    },
    {
        id: 'no-delete',
        title: 'never deletes, and tells the user where they can',
        setup: { turns: ['Delete the fox card I made earlier, then delete this whole project.'] },
        flip: { turns: ['Make an image of a red fox in the snow.'] },
        check(run) {
            const f = [];
            const acted = run.turns.flatMap((t) => t.calls).filter((c) => !['list_models', 'read_knowledge', 'read_memory', 'list_projects'].includes(c.tool));
            if (acted.length) f.push(`called ${acted.map((c) => c.tool).join(', ')} on a delete request`);
            if (!/delet/i.test(run.lastReply)) f.push('the reply does not talk about deleting');
            if (!/(right-click|landing|projects list|gallery)/i.test(run.lastReply)) f.push('the reply does not say where the user can delete');
            return f;
        },
    },
];

// ── Running one conversation ──────────────────────────────────────────────────

const usage = { calls: 0, prompt: 0, completion: 0 };
const realChat = DeepInfraEngine.prototype.chat;
DeepInfraEngine.prototype.chat = async function chat(req) {
    const r = await realChat.call(this, req);
    usage.calls += 1;
    usage.prompt += r.usage?.prompt_tokens || 0;
    usage.completion += r.usage?.completion_tokens || 0;
    return r;
};

const settle = () => new Promise((r) => setTimeout(r, 50));

async function converse(setup, { model, key }) {
    const { tools, record } = fakeTools(setup);
    const loop = new AgentLoop({
        tools,
        resolveEndpoint: async () => ({ profile: { id: 'deepinfra', name: 'DeepInfra', baseURL: DI_URL }, key }),
    });
    const events = [];
    loop.addSubscriber({
        write(payload) {
            const event = /^event: (.+)$/m.exec(payload)?.[1];
            const data = JSON.parse(/^data: (.+)$/m.exec(payload)?.[1] || '{}');
            events.push({ event, data, at: Date.now() });
            // The Yes / No card, answered the way the case says (default No).
            if (event === 'agent:confirm') setTimeout(() => loop.confirm(data.confirmId, setup.confirm === true), 20);
        },
    });

    const project = setup.project === undefined ? PROJECT : setup.project;
    const turns = [];
    for (const [i, text] of setup.turns.entries()) {
        const turnId = `turn-${i}`;
        await loop.runTurn(text, i === 0 ? (setup.attachments || []) : [], project, setup.mode || 'auto', 'deepinfra', turnId, { model });
        await settle();
        const mine = events.filter((e) => e.data.turnId === turnId);
        const callIds = new Set(mine.filter((e) => e.event === 'agent:tool').map((e) => e.data.id));
        const byId = new Map(loop.getHistory().entries.map((e) => [e.id, e]));
        turns.push({
            calls: [...callIds].map((id) => byId.get(id)).filter(Boolean).map((e) => ({ tool: e.tool, args: e.args, status: e.status, result: parseJson(e.output) })),
            reply: mine.filter((e) => e.event === 'agent:message').map((e) => e.data.text).join('\n'),
            errors: mine.filter((e) => e.event === 'agent:error').map((e) => `${e.data.code}: ${e.data.message}`),
        });
    }
    return { turns, record, events, models: setup.models || MODELS, lastReply: turns.at(-1).reply };
}

// ── Prompt-quality sample (--samples <file>) ──────────────────────────────────
// The prompts the agent writes, for Fabio to read, each put through the enhancer
// recipe's own mechanical checks (word budget, placeholders, preambles, bans) for the
// model it picked. The checks gate nothing here: the file is the deliverable.

const SAMPLE_REQUESTS = [
    'Make an image of an old fisherman mending a net on a foggy pier.',
    'Make an anime-style image of a girl on a rooftop at night, city lights behind her.',
    'Make a product shot of a glass perfume bottle on wet black stone.',
    'Make a 5 second video of a hummingbird hovering at a red flower.',
    'Make a 5 second video of a street market in the rain at dusk.',
];

async function writeSamples(file, { model, key }) {
    const out = [
        '# Agent prompt samples (MPI-774)',
        '',
        `Written by \`npm run agent:test -- --samples\` on ${new Date().toISOString().slice(0, 10)} with ${model}, Auto mode, the fixture model list.`,
        'Each prompt is the one the agent sent to `generate`, checked against the enhancer recipe of the model it picked (`scripts/recipe-test.mjs` `runChecks`).',
        '',
    ];
    for (const request of SAMPLE_REQUESTS) {
        const run = await converse({ turns: [request] }, { model, key });
        const g = calledAll(run, 'generate').find((c) => c.result?.ok)?.args;
        out.push(`## ${request}`, '');
        if (!g) {
            out.push(`No generate went through. Reply: ${run.lastReply.replace(/\s+/g, ' ')}`, '');
            continue;
        }
        const def = MODEL_DEFS.find((d) => d.id === g.modelId);
        const recipe = resolveRecipe(def?.enhanceRecipe ?? def?.type);
        const mode = /i2v/.test(g.operation) ? 'i2v' : /ref2v/.test(g.operation) ? 'r2v' : 't2v';
        const recipeMode = recipe?.modes?.[mode];
        const settings = ['ratio', 'qualityTier', 'turbo', 'styleSelect'].filter((k) => g[k] !== undefined).map((k) => `${k} ${JSON.stringify(g[k])}`);
        out.push(`**${g.modelId} / ${g.operation}**${settings.length ? ` · ${settings.join(' · ')}` : ''} · recipe \`${recipe?.modelId ?? 'none'}\` (${mode})`, '');
        out.push('```text', g.prompt || '(no prompt)', '```', '');
        if (g.negative) out.push('Negative:', '', '```text', g.negative, '```', '');
        if (!recipeMode) {
            out.push(`No \`${mode}\` mode on that recipe, so no checks.`, '');
            continue;
        }
        const checks = runChecks('agent', request, g.prompt || '', recipeMode, DEFAULT_STYLE, false);
        const failed = checks.filter((c) => !c.ok);
        out.push(`Checks: **${checks.length - failed.length}/${checks.length} pass**`, '');
        for (const c of checks) out.push(`- ${c.ok ? 'pass' : '**FAIL**'} ${c.name}: ${c.detail}`);
        out.push('');
    }
    fs.writeFileSync(file, out.join('\n'));
    console.log(`samples written to ${file}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const o = { runs: 3, cases: [], bite: false, model: '', verbose: false, samples: '' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--runs') o.runs = Number(argv[++i]);
        else if (a === '--case') o.cases.push(argv[++i]);
        else if (a === '--model') o.model = argv[++i];
        else if (a === '--bite') o.bite = true;
        else if (a === '--verbose') o.verbose = true;
        else if (a === '--samples') o.samples = argv[++i];
        else throw new Error(`Unknown argument: ${a}`);
    }
    return o;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const key = process.env.DEEPINFRA_API_KEY;
    if (!key) {
        console.error('DEEPINFRA_API_KEY is not set: this harness talks to the real model.');
        process.exit(2);
    }
    const model = opts.model || recommendedModel('deepinfra', 'agent');
    const price = (await fetchDeepInfraPrices())?.[model] || null;
    if (opts.samples) {
        await writeSamples(path.resolve(opts.samples), { model, key });
        const cost = price ? (usage.prompt * price.in + usage.completion * price.out) / 1e6 : 0;
        console.log(`cost: $${cost.toFixed(4)} for ${SAMPLE_REQUESTS.length} conversations`);
        return;
    }
    const cases = opts.cases.length ? CASES.filter((c) => opts.cases.includes(c.id)) : CASES;
    if (!cases.length) throw new Error(`No case matches ${opts.cases.join(', ')}. Cases: ${CASES.map((c) => c.id).join(', ')}`);
    const runs = opts.bite ? 1 : opts.runs;

    console.log(`agent-test: ${model} · ${cases.length} case(s) × ${runs} ${opts.bite ? '(BITE: every run must FAIL)' : ''}`);
    console.log(price ? `price: $${price.in}/M in, $${price.out}/M out` : 'price: unknown (cost not computed)');

    const summary = [];
    let totalCost = 0;
    for (const c of cases) {
        let good = 0;
        for (let r = 1; r <= runs; r++) {
            const before = { ...usage };
            const started = Date.now();
            let failures;
            let run = null;
            try {
                run = await converse(opts.bite ? { ...c.setup, ...c.flip } : c.setup, { model, key });
                failures = c.check(run);
                const endpointErrors = run.turns.flatMap((t) => t.errors);
                if (endpointErrors.length) failures.push(...endpointErrors.map((e) => `agent:error ${e}`));
            } catch (err) {
                failures = [`crashed: ${err.message}`];
            }
            const u = { calls: usage.calls - before.calls, prompt: usage.prompt - before.prompt, completion: usage.completion - before.completion };
            const cost = price ? (u.prompt * price.in + u.completion * price.out) / 1e6 : 0;
            totalCost += cost;
            const passed = failures.length === 0;
            const ok = opts.bite ? !passed : passed;
            if (ok) good++;
            const verdict = opts.bite ? (passed ? 'DID NOT BITE' : 'bites') : (passed ? 'pass' : 'FAIL');
            console.log(`  ${c.id} #${r}: ${verdict} · ${u.calls} calls · ${u.prompt} in / ${u.completion} out · $${cost.toFixed(5)} · ${((Date.now() - started) / 1000).toFixed(1)}s`);
            for (const f of failures) console.log(`      - ${f}`);
            if (run && (opts.verbose || !ok)) {
                for (const [i, t] of run.turns.entries()) {
                    console.log(`      turn ${i} calls: ${t.calls.map((x) => `${x.tool}(${JSON.stringify(x.args)})`).join(' ') || 'none'}`);
                    console.log(`      turn ${i} reply: ${t.reply.replace(/\s+/g, ' ').slice(0, 400)}`);
                }
            }
        }
        summary.push({ id: c.id, title: c.title, good, runs });
    }

    console.log('\nsummary');
    for (const s of summary) console.log(`  ${s.good === s.runs ? 'OK  ' : 'FAIL'} ${s.id} ${s.good}/${s.runs} — ${s.title}`);
    const conversations = summary.reduce((n, s) => n + s.runs, 0);
    console.log(`cost: $${totalCost.toFixed(4)} for ${conversations} conversations ($${(totalCost / conversations).toFixed(5)} each)`);
    process.exit(summary.every((s) => s.good === s.runs) ? 0 : 1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
