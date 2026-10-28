/**
 * agentBench.mjs — the in-app agent's test suite, shipped (MPI-774 harness; MPI-941 Phase 12).
 *
 * The REAL loop against FAKE tools: no app, no GPU, no generation. The models fixture in
 * services/agentBench/ is the real /connector/models payload captured from an isolated
 * instance, given each model's guide ids and media roles by the same functions the route
 * uses; knowledge is the live corpus the route serves. So the model reads what it reads in
 * the app.
 *
 * Graded by exact assertions on the calls the MODEL made (the loop's history), never by a judge.
 * `scripts/agent-test.mjs` is the CLI (3 runs, --bite, --samples, --preset). Settings' "Benchmark
 * this model" runs `runSuite` once over the user's own connection. It ships, so it imports
 * nothing under scripts/ or tests/: the portable build drops both.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { AgentLoop, projectKey } from './agentLoop.mjs';
import { listCorpus, guideIdsByModel } from './agentCorpus.mjs';
import * as commandRegistry from '../js/data/commandRegistry.js';
import { resolveNamedParams } from '../js/data/generationControls.js';
import { MODELS as MODEL_DEFS } from '../js/data/modelConstants/models.js';
import { opPriority } from '../js/data/modelConstants/modelPriority.js';
import { CROP_RATIOS } from '../js/utils/ratios.js';
import { FLOWS, getFlowById } from '../js/data/flowsRegistry.js';
import { agentFieldSpecs } from '../js/utils/declaredFields.js';
import { normalizeRoutine, validateRoutine, routineSummary } from '../js/data/routineModel.js';
import { CARD_MARKS, DEFAULT_GALLERY_SORT } from '../js/utils/galleryFilter.js';

const { mediaRolesFor } = createRequire(import.meta.url)('../routes/connector.js');

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agentBench');
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8'));
const LOOKS = readFixture('looks.json');

// What GET /connector/models adds to the renderer's list, by the route's own functions.
const GUIDES = guideIdsByModel();
const CAPTURED = readFixture('connector-models.json');
// A crop flow (Outpaint) as `_listModels` builds it NOW: the capture predates `frame`
// (MPI-817) and its `grow` (MPI-900), so the model could not see either. `grow` mirrors
// agentDispatch.js FRAME_GROW_SIDES, which cannot be imported here (it pulls the DOM).
const CROP_LABELS = [...new Set([...(CROP_RATIOS.portrait || []), ...(CROP_RATIOS.landscape || [])].map((r) => r.label))];
const withFrame = (f) => {
    const flow = getFlowById(f.id);
    const crop = flow?.steps?.find((s) => s.kind === 'crop' && s.role);
    return crop ? { ...f, fields: agentFieldSpecs(flow), frame: { param: 'frame', role: crop.role, ratios: CROP_LABELS, grow: ['up', 'down', 'left', 'right'] } } : f;
};
// MPI-1036: Video Edit came after the capture, so it gets the row `_listModels` builds for it.
// `does` mirrors agentDispatch.js flowDoes, which cannot be imported here either. So do
// `boxParams` and `opens` (MPI-1086: Character Sheet from Images opens at its face box).
const flowRow = (flow) => ({
    id: flow.id, title: flow.title,
    does: flow.description.replace(/\*/g, '').split(/(?<=[.!?])\s/)[0].split(/\s[—–]\s|:\s/)[0].replace(/[.!?]$/, '').trim(),
    operation: flow.operation, installed: true, fields: agentFieldSpecs(flow),
    boxParams: (flow.steps || []).filter((s) => s.kind === 'box' && s.param).map((s) => ({
        param: s.param, role: s.role,
        ...(Number.isFinite(s.ratio) ? { ratio: s.ratio } : {}),
        ...(s.overflow === 'allow' ? { overflow: 'allow' } : {}),
    })),
    ...(flow.agentOpens ? { opens: flow.agentOpens } : {}),
});
const MODELS = {
    ...CAPTURED,
    // Each Flow's media slots, as GET /connector/models folds them in (the capture lacks them, so a
    // Flow's picture went in under a guessed role: Character Sheet Editor's sheet as `source`).
    flows: [...CAPTURED.flows.map(withFrame), ...['video-edit', 'character-sheet-from-images', 'character-sheet-editor'].map((id) => flowRow(getFlowById(id)))]
        .map((f) => ({ ...f, media: mediaRolesFor(commandRegistry, f.operation, null) })),
    models: CAPTURED.models.map((m) => ({
        ...m,
        ops: m.ops.map((o) => ({
            ...o,
            media: mediaRolesFor(commandRegistry, o.op, MODEL_DEFS.find((d) => d.id === m.id)),
            ...(opPriority(m.id, o.op) || {}),
        })),
        guides: GUIDES[m.id] || [],
    })),
};

// What GET /connector/knowledge serves: the live corpus.
const CORPUS = listCorpus();

const PROJECTS_ROOT = 'C:/Users/maker/Documents/Cubric';
const PROJECT = { folderPath: `${PROJECTS_ROOT}/Fox Shoot`, name: 'Fox Shoot' };
// What GET /connector/projects lists (Phase 3c), most recent first.
const PROJECTS = [PROJECT, { name: 'Harbour Nights' }, { name: 'Wedding Stills' }]
    .map((p) => ({ folderPath: `${PROJECTS_ROOT}/${p.name}`, ...p, updatedAt: '2026-09-16T10:00:00Z' }));
// Every fake generate lands here; a look at it is keyed by the decoded path.
const RESULT_PATH = `${PROJECT.folderPath}/Media/t2i_001.png`;
const RESULT_URL = `/project-file?path=${encodeURIComponent(RESULT_PATH)}`;
const FOX = { id: 'att_fox', name: 'fox.png', filePath: 'C:/Temp/cubric-agent/attachments/att_fox.png' };
const FRAME = { id: 'att_frame', name: 'frame-from-my-video.png', filePath: 'C:/Temp/cubric-agent/attachments/att_frame.png' };
// The filenames agree with what the looks fixture says is in them: the model reads both, and
// a name contradicting the description sent it hunting for the discrepancy instead of measuring.
const PORTRAIT_A = { id: 'att_portrait_a', name: 'woman-at-bar.png', filePath: 'C:/Temp/cubric-agent/attachments/att_portrait_a.png' };
const PORTRAIT_B = { id: 'att_portrait_b', name: 'donor-face.png', filePath: 'C:/Temp/cubric-agent/attachments/att_portrait_b.png' };
const SHEET = { id: 'att_sheet', name: 'ninja-character-sheet.png', filePath: 'C:/Temp/cubric-agent/attachments/att_sheet.png' };
// MPI-1166: an idea told before any go-ahead, and the check a hold must pass.
const CONCEPT = 'Here is my idea for a video: an old lighthouse keeper climbs the spiral stairs at night with a lantern, and at the top he finds the lamp already lit by someone else. Slow and eerie, about 8 seconds.';
const checkInHolds = (run) => {
    const f = [];
    if (run.record.generates.length) f.push(`generated ${run.record.generates.length} time(s) before the go-ahead`);
    if (!run.turns.at(-1).options) f.push('ended with no buttons to proceed or correct');
    return f;
};
const ANGLE = { id: 'att_angle', name: 'IMG_6021.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_angle.jpg' };
// MPI-1201: one reference picture holding two subjects, a clip for the motion, a place.
const LEGS = { id: 'att_legs', name: 'IMG_9104.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_legs.jpg' };
const HALLWAY = { id: 'att_hallway', name: 'IMG_9107.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_hallway.jpg' };
const WALK = { id: 'i2v_007.mp4', name: 'i2v_007.mp4', filePath: `${PROJECT.folderPath}/Media/i2v_007.mp4`,
    reference: true, mediaType: 'video', itemId: 'item_w', groupId: 'grp_w' };
const GRAINY = { id: 'att_grainy', name: 'IMG_7310.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_grainy.jpg' };
const GRADED = { id: 'att_graded', name: 'IMG_7311.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_graded.jpg' };
const LIT = { id: 'att_lit', name: 'IMG_7312.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_lit.jpg' };
// Known gap (2026-10-17): it also carries qualities nobody asked for (the photo's grain onto a
// "this light" ask, 6 of 6 on DeepSeek), so "only that quality" is not asserted. The `look`
// fixture answers with everything whatever was asked, which may overstate it.
const lookCase = (id, att, turn, seen, wanted) => ({
    id,
    title: `a picture given for one quality of its look puts that quality in the prompt (${id})`,
    setup: { attachments: [att], look: { ok: true, output: { text: seen } }, turns: [turn] },
    flip: { turns: [turn.replace(/ I want this .*$/, '')] },
    check(run) {
        const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
        if (!ok.length) return ['never generated'];
        const f = [];
        for (const c of ok) {
            const p = c.args.prompt || '';
            if (!wanted.test(p)) f.push(`the asked-for look is not in the prompt: ${p.slice(0, 160)}`);
            if ((c.args.media || []).some((m) => m.image === att.id)) f.push(`sent the picture as media (${c.args.operation})`);
        }
        return f;
    },
});
// MPI-1208: one woman on a square picture, standing, arms down (the 9:16 case).
const WOMAN = { id: 'att_woman', name: 'IMG_8812.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_woman.jpg' };
const WOMAN_LOOK = { text: 'A photo of one woman with long purple hair standing in a sunlit studio, framed from the knees up, arms relaxed at her sides, a neutral expression. She wears a black crop top and blue jeans. Plain white wall behind her.' };
const WAVES = 'Make a 5 second video of waves crashing on rocks at sunset.';
// MPI-944: one place, two angles. Camera-roll names on purpose: the model has to look to
// tell which picture holds the content and which is empty.
const ROOM_FULL = { id: 'att_room_a', name: 'IMG_4410.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_room_a.jpg' };
const ROOM_EMPTY = { id: 'att_room_b', name: 'IMG_4415.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_room_b.jpg' };
const PARK_FULL = { id: 'att_park_a', name: 'IMG_5120.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_park_a.jpg' };
const PARK_EMPTY = { id: 'att_park_b', name: 'IMG_5133.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_park_b.jpg' };
const FURNISH = 'These are two photos of the same living room from different angles. The first has the furniture, the second is empty. Put the same furniture in the second photo, where it would be seen from that angle.';
// MPI-970: saved routines, stored the way the app keeps them (the connector's words), and a
// dropped selection of three gallery cards (MPI-948's `set`).
const PRODUCT_SHOT = { schema: 'cubric/routine/v1', name: 'product-shot', summary: 'Square it, then upscale it 2x', inputs: [],
    steps: [{ operation: 'crop', fields: { ratio: '1:1' } }, { operation: 'imageUpscale', fields: { factor: 2 } }] };
const SQUARE_ONLY = { ...PRODUCT_SHOT, name: 'square-only', summary: 'Crop it square', steps: [PRODUCT_SHOT.steps[0]] };
const SHOTS = { id: 'sel_shots', name: '3 cards', set: [1, 2, 3].map((n) => ({
    id: `shot${n}.png`, filePath: `${PROJECT.folderPath}/Media/shot${n}.png`, itemId: `item_s${n}`, groupId: `grp_s${n}` })) };
// MPI-1036: a dragged video CARD (MPI-867), handed over by reference, never staged.
const DANCER = { id: 'i2v_004.mp4', name: 'i2v_004.mp4', filePath: `${PROJECT.folderPath}/Media/i2v_004.mp4`,
    reference: true, mediaType: 'video', itemId: 'item_d', groupId: 'grp_d' };

// ── Fixture edits ─────────────────────────────────────────────────────────────

/** The models payload with every model matching `pred` installed or not, ops included. */
function setInstalled(pred, installed, base = MODELS) {
    return {
        ...base,
        models: base.models.map((m) => (pred(m) ? {
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
// MPI-774 Phase 5 fix 1: two editors installed, and the ranking says which one to reach for.
const OTHER_EDITORS = ['boogu-edit-high', 'boogu-edit-balanced', 'klein-4b', 'qwen-edit', 'krea2-nsfw'];
const KLEIN_AND_KREA = setInstalled((m) => ['klein-9b', 'krea2'].includes(m.id), true,
    setInstalled((m) => OTHER_EDITORS.includes(m.id), false));
const KREA_ONLY = setInstalled((m) => m.id === 'klein-9b', false, KLEIN_AND_KREA);
// MPI-944: the tester's box (Boogu High + Klein 9B, no Qwen, no Krea 2), and every editor.
const BOOGU_AND_KLEIN = setInstalled((m) => ['boogu-edit-high', 'klein-9b'].includes(m.id), true,
    setInstalled((m) => [...OTHER_EDITORS, 'krea2'].includes(m.id), false));
const EVERY_EDITOR = setInstalled((m) => ['boogu-edit-high', 'klein-9b', 'qwen-edit', 'krea2'].includes(m.id), true);
const said = (text) => ({ ok: true, output: { text } });
const ROOM_LOOKS = {
    [ROOM_FULL.filePath]: said('Living room photographed from the doorway, looking toward the window wall. An orange accent wall on the left. A light grey L-shaped sectional sofa sits against the orange wall, chaise end toward the window. A low white oval coffee table in front of it on a cream rug. A potted fiddle-leaf fig in a white pot in the corner by the window. A black TV on a white low cabinet on the right wall. Beige tiled floor, daylight from the window.'),
    [ROOM_EMPTY.filePath]: said('Empty living room photographed from the window corner, looking back toward the doorway. The orange accent wall is now on the right side of the frame. Beige tiled floor, white walls, bare, no furniture at all. Daylight from behind the camera.'),
    // The edit, done. Without it the result fell back to the FIRST look, the furnished doorway
    // photo: the model read its edit as an unchanged copy of the source and redid it to STEP_LIMIT.
    [RESULT_PATH]: said('Living room photographed from the window corner, looking back toward the doorway. The orange accent wall is on the right side of the frame, with a light grey L-shaped sectional sofa against it. A low white oval coffee table on a cream rug, a potted fiddle-leaf fig in a white pot, a black TV on a white low cabinet. Beige tiled floor, daylight from behind the camera.'),
};
const DANCER_LOOK = said('A young woman with long straight blonde hair dances alone in a bright white studio, full body, facing the camera. She spins and her hair swings out across the frame. White crop top, light blue jeans, white sneakers.');
const NEW_PERSON = { id: 'att_person', name: 'new-person.png', filePath: 'C:/Temp/cubric-agent/attachments/att_person.png' };
const NEW_PERSON_LOOK = said('Full-body photo of a tall woman with short curly red hair and freckles, in a green bomber jacket, black trousers and boots, standing in a park.');
const NO_VIDEO_EDIT = { ...MODELS, flows: MODELS.flows.filter((f) => f.id !== 'video-edit') };
// MPI-1286: two dragged H3 clips to join, the crash clip opening on the girls before the crash.
const CHAT = { id: 'ref2v_002.mp4', name: 'ref2v_002.mp4', filePath: `${PROJECT.folderPath}/Media/ref2v_002.mp4`,
    reference: true, mediaType: 'video', itemId: 'item_c', groupId: 'grp_c' };
const CRASH = { id: 'ref2v_001.mp4', name: 'ref2v_001.mp4', filePath: `${PROJECT.folderPath}/Media/ref2v_001.mp4`,
    reference: true, mediaType: 'video', itemId: 'item_x', groupId: 'grp_x' };
const CHAT_LOOK = said('Anime style. Two schoolgirls in navy uniforms sit on a bench in a sunny park eating ice cream and laughing, the girl with long black hair on the left, the girl with a short brown bob on the right. They stand up and start walking toward the park gate.');
const CRASH_LOOK = said('Anime style. Two schoolgirls in navy uniforms stand on a sunny shopping street, long black hair on the left, short brown bob on the right. Behind them a car slams into a parked van and bursts into flames; they spin round and scream as smoke rolls over the street.');
const CALM_LOOK = said('Anime style. Two schoolgirls in navy uniforms stand chatting on a calm sunny shopping street, long black hair on the left, short brown bob on the right. Parked cars and a van behind them, nothing happening.');
/** MPI-1286: the video generate is a join on minimax-h3 i2v_ms ending on the crash clip. The
 *  pre-scene's calm start picture is an edit OF the crash clip first, so that one is skipped. */
const gradeJoin = (run, start) => {
    const ok = calledAll(run, 'generate').filter((c) => c.result?.ok && c.args.modelId);
    const join = ok.find((c) => modelById(c.args.modelId)?.type === 'video' && (c.args.media || []).some((m) => m.image === CRASH.id));
    if (!join) return [`never sent ${CRASH.id} to a video generate: ran ${ok.map((c) => ranWhat(c.args)).join(', ') || 'nothing'}`];
    const { modelId, operation, media = [] } = join.args;
    const f = [];
    if (modelId !== 'minimax-h3' || operation !== 'i2v_ms') f.push(`joined on ${modelId}/${operation}, not minimax-h3/i2v_ms`);
    const end = media.find((m) => m.role === 'endFrame');
    if (end?.image !== CRASH.id || end.frame === 'last') f.push(`endFrame is ${JSON.stringify(end || null)}, not ${CRASH.id}'s first frame`);
    const first = media.find((m) => m.role === 'startFrame');
    if (!first) f.push('no startFrame');
    else if (start && (first.image !== start.id || first.frame !== 'last')) f.push(`startFrame is ${JSON.stringify(first)}, not ${start.id} with frame "last"`);
    // Both clips are anime: the H3 guide's "no cartoon or CG" is for photographic clips only,
    // and live it was copied onto this one from the guide's own example (Fabio, re-cut 2).
    if (/cartoon|\bCG\b/i.test(join.args.prompt || '')) f.push('the prompt bans a cartoon or CG look on an anime clip');
    return f;
};
// MPI-1086: which of the three character Flows. A face-only picture, and the bench's sheet as the
// describer reads it (a shirt in it, so "the shirt" names something there).
const FACE = { id: 'att_face', name: 'IMG_8802.JPG', filePath: 'C:/Temp/cubric-agent/attachments/att_face.jpg' };
const FACE_LOOK = said('Head-and-shoulders photo of a man in his thirties with a shaved head, a short black beard and a small scar over his left eyebrow, in a grey hoodie, against a brick wall.');
const SHEET_LOOK = said('A character sheet on a plain grey background: the same young woman in a black ninja outfit over a purple shirt, shown three times: front view, back view and a close-up of her masked face.');
const CAPTAIN = 'a grizzled old sea captain with a white beard, a yellow oilskin coat and a clay pipe';
const PARK_LOOKS = {
    [PARK_FULL.filePath]: said('A woman in a red coat sitting on a wooden bench on the left side of a park path, facing the camera. A lamp post behind her, autumn trees, a pond on the right.'),
    [PARK_EMPTY.filePath]: said('The same park path seen from the pond side, looking back at the wooden bench, which is now centre-right. Lamp post behind the bench. Nobody in the picture.'),
    [RESULT_PATH]: said('A park path seen from the pond side, looking back at a wooden bench centre-right. A woman in a red coat sits on the bench. Lamp post behind the bench, autumn trees.'),
};

// ── Fake tools (the agentTools.mjs surface) ───────────────────────────────────

function fakeTools({ models = MODELS, look = LOOKS.fox, noGuides = false, notes = [], projects = PROJECTS, memoryFull = false, routines = [], stopped = false }) {
    const record = { installs: [], generates: [], looks: [], opens: [], writes: [], renames: [], creates: [], routines: [], gifs: [] };
    // MPI-970: the saved routines (one set for every project), answered the way /connector/routines does; a save is
    // checked by the app's own validator, so the model gets the refusal it would get there.
    const kept = new Map(routines.map((r) => [r.name, r]));
    const noRoutine = (name) => ({ ok: false, error: { code: 'ROUTINE_NOT_FOUND', message: `No routine "${name}".` } });
    const known = [...projects];
    // --bite for the guide case: no model has a guide, and the index offers none to read.
    const served = noGuides
        ? { ...models, models: models.models.map((m) => ({ ...m, guides: [] })) }
        : models;
    const corpus = noGuides ? CORPUS.filter((e) => e.kind !== 'guide') : CORPUS;
    const store = new Map(notes.map((n) => [n.file, n]));
    const globalStore = new Map();
    const readNotes = (s, file, where) => {
        if (!file) return { ok: true, notes: [...s.values()].map(({ file: f, title, hook }) => ({ file: f, title, hook: hook || '' })) };
        const n = s.get(file);
        return n ? { ok: true, file, text: n.text } : { ok: false, error: { code: 'UNKNOWN_NOTE', message: `No note "${file}" ${where}.` } };
    };
    const described = new Map();
    const marks = new Map();
    let landed = null;   // the card a fake generate made, once one succeeds
    // GET /connector/cards' shape: one row a card, and `files` mapping each ref to the card behind it.
    const projectCards = () => {
        if (!landed) return { cards: [], total: 0, files: {}, sets: {} };
        const ref = path.basename(RESULT_PATH);
        const card = { groupId: 'grp_1', name: 't2i_001', kind: landed.type, versions: 1,
            ...(marks.has('grp_1') ? { mark: marks.get('grp_1') } : {}), ref };
        return { cards: [card], total: 1, files: { [ref]: { path: RESULT_PATH, modelId: landed.modelId || null, itemId: 'item_1', groupId: 'grp_1' } }, sets: {} };
    };
    // gifJobs.js `_done`: edit and cutout land on the card they were given, the rest on a new one.
    const gifDone = (verb, body, { groupId, type }) => {
        record.gifs.push({ verb, ...body });
        const file = `${PROJECT.folderPath}/Media/${verb}_001.${type === 'video' ? 'mp4' : type === 'image' ? 'png' : 'gif'}`;
        return { ok: true, output: { itemId: `item_${verb}`, groupId, type, filePath: `/project-file?path=${encodeURIComponent(file)}`,
            pixelDimensions: { w: 1024, h: 1024 }, ...(type === 'gif' ? { frames: 24, loop: 0 } : {}) } };
    };
    const tools = {
        listModels: async () => structuredClone(served),
        readKnowledge: async (id) => {
            if (!id) return { ok: true, entries: corpus.map(({ id: i, kind, title, tags }) => ({ id: i, kind, title, tags })) };
            const e = corpus.find((x) => x.id === id);
            return e ? { ok: true, id, title: e.title, text: e.text() } : { ok: false, error: { code: 'UNKNOWN_ENTRY', message: `No corpus entry "${id}".` } };
        },
        // The project's notes, in memory, answering the way /connector/memory does.
        readMemory: async (folderPath, file) => readNotes(store, file, 'in this project'),
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
        sendCards: async ({ groupIds = [] }) => ({ ok: true, output: { copied: groupIds.length || 1, cards: groupIds.map((id) => ({ groupId: `copy-${id}`, type: 'image' })) } }),
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
                const def = MODEL_DEFS.find((d) => d.id === m.id);
                // The route resolves a style LABEL to its index first (routes/connector.js, the
                // `styleSelect` string block); without it a label the app accepts was refused here.
                if (typeof named.styleSelect === 'string') {
                    const i = (def?.styleLoraLabels || []).findIndex((l) => String(l).trim().toLowerCase() === named.styleSelect.trim().toLowerCase());
                    if (i >= 0) named.styleSelect = i;
                }
                const v = resolveNamedParams(null, def, body.operation, named);
                if (!v.ok) return { ok: false, error: { code: v.code, message: v.message } };
                if (!m.ops.some((o) => o.op === body.operation && o.installed)) {
                    return { ok: false, error: { code: 'MODEL_NOT_INSTALLED', message: `${m.name} cannot run ${body.operation}: not installed.` } };
                }
            }
            // MPI-1165: the user pressed Stop on the first run, after the loop's 1 s refusal
            // window (a mid-render Stop); the dispatch reports it so.
            if (stopped && record.generates.length === 1) return new Promise((resolve) => { setTimeout(() => resolve({ ok: false, error: { code: 'CANCELLED', message: 'The user pressed Stop.' } }), 1500); });
            landed = { type: m?.type || 'image', modelId: body.modelId };
            return { ok: true, output: { itemId: 'item_1', groupId: 'grp_1', type: landed.type, filePath: RESULT_URL } };
        },
        // One fixture for every image, or a map keyed by the attachment's filePath when a
        // case needs two images to answer differently: two portraits giving the identical
        // answer read to the model as a broken describer, and it stopped instead of
        // measuring. The loop resolves a ref to a path before it calls this, so the key is
        // `imagePath` — an `image` id never reaches here.
        look: async (args) => {
            record.looks.push(args);
            // A clip's look reads the contact sheet `fakeViewFile` wrote: its bytes are the clip's path.
            const sheetOf = () => { try { return fs.readFileSync(args.imagePath, 'utf8'); } catch { return null; } };
            const chosen = look?.ok ? look : (look[args.imagePath] || look[sheetOf()] || Object.values(look)[0]);
            return structuredClone(chosen);
        },
        // A card's kept description (agentTools.storedLook / storeLook), in memory. The loop reads
        // it before every plain look at a card; without it that look threw "storedLook is not a
        // function", the model took the TOOL_ERROR for a bad ref and guessed others to STEP_LIMIT.
        // ponytail: keyed by itemId, and every fake generate is item_1, so a redo reads the first
        // caption back; the fixture describes both the same anyway.
        storedLook: async (imagePath, itemId) => described.get(itemId) || null,
        storeLook: async (imagePath, itemId, text) => { described.set(itemId, text); },
        // A clip's words (agentTools.transcribe / storedHeard / storeHeard, MPI-1169). Bench clips
        // are fixtures with no sound file behind them, so they answer what a silent clip does.
        transcribe: async () => ({ ok: false, error: { code: 'NO_AUDIO', message: 'This clip has no sound.' } }),
        storedHeard: async () => null,
        storeHeard: async () => {},
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
        listRoutines: async () => ({ ok: true,
            routines: [...kept.values()].map(({ name, summary, steps, inputs }) => ({ name, summary, steps: steps.length, inputs })) }),
        saveRoutine: async (routine) => {
            const v = validateRoutine(normalizeRoutine(routine), { models: MODEL_DEFS, flows: FLOWS });
            if (!v.ok) return { ok: false, error: { code: v.code, message: v.message } };
            record.routines.push({ action: 'save', routine: v.routine });
            kept.set(v.routine.name, v.routine);
            return { ok: true, name: v.routine.name, created: true, summary: routineSummary(v.routine) };
        },
        deleteRoutine: async (name) => {
            record.routines.push({ action: 'delete', name });
            return kept.delete(name) ? { ok: true, name, deleted: true } : noRoutine(name);
        },
        renameRoutine: async (name, newName) => {
            record.routines.push({ action: 'rename', name, newName });
            if (!kept.has(name)) return noRoutine(name);
            kept.set(newName, { ...kept.get(name), name: newName });
            kept.delete(name);
            return { ok: true, name: newName, renamed: name };
        },
        quoteRoutine: async (name, body) => (kept.has(name)
            ? { ok: true, output: { missing: [], billed: false, count: body.cards.length, usd: 0, display: null } } : noRoutine(name)),
        runRoutine: async (name, body) => {
            record.routines.push({ action: 'run', name, cards: body.cards, inputs: body.inputs });
            return { ok: true, output: { ok: true, runId: 'run_1', stackId: body.cards.length > 1 ? 'stk_1' : null,
                cards: body.cards.map((c, i) => ({ inputGroupId: c, groupId: `grp_r${i}`, steps: 2 })) } };
        },
        saveAttachment: async () => { throw new Error('the harness stages attachments itself'); },
        initAttachmentDir: async () => {},
        attachmentDir: () => 'C:/Temp/cubric-agent/attachments',
        cropDir: () => 'C:/Temp/cubric-agent/crops',
        discardAttachments: async () => {},
        // MPI-1132: every other tool the loop calls, answered the way its connector route does.
        // Without them a model that reached one got TOOL_ERROR "is not a function" (the MPI-1129
        // room run called list_cards and visible_cards, then guessed to STEP_LIMIT).
        // ponytail: the project holds only the card a fake generate lands; a `cards` setup when a case needs more.
        listCards: async (folderPath, groupId, limit, mark) => {
            if (mark && !CARD_MARKS.some((m) => m.id === mark)) {
                return { ok: false, error: { code: 'BAD_REQUEST', message: `mark must be one of: ${CARD_MARKS.map((m) => m.id).join(', ')}.` } };
            }
            const seen = projectCards();
            if (!groupId) {
                const cards = mark ? seen.cards.filter((c) => c.mark === mark) : seen.cards;
                return { ok: true, ...seen, cards, total: cards.length };
            }
            const card = seen.cards.find((c) => c.groupId === groupId);
            return card ? { ok: true, card, files: seen.files }
                : { ok: false, error: { code: 'UNKNOWN_CARD', message: `No card "${groupId}" in this project. Use a groupId from list_cards.` } };
        },
        visibleCards: async () => ({ ok: true, order: DEFAULT_GALLERY_SORT.order, scope: DEFAULT_GALLERY_SORT.scope, filtered: false, filter: '', ...projectCards() }),
        markCard: async (groupId, mark) => {
            if (mark && !CARD_MARKS.some((m) => m.id === mark)) {
                return { ok: false, error: { code: 'INVALID_MARK', message: `mark must be one of: ${CARD_MARKS.map((m) => m.id).join(', ')}, or false to clear it.` } };
            }
            if (!projectCards().cards.some((c) => c.groupId === groupId)) {
                return { ok: false, error: { code: 'NO_SUCH_CARD', message: `No card "${groupId}" in the open project "${PROJECT.name}". Open the project it belongs to first.` } };
            }
            if (mark) marks.set(groupId, mark); else marks.delete(groupId);
            return { ok: true, output: { groupId, mark: mark || null } };
        },
        makeGif: async (body) => gifDone('make', body, { groupId: 'grp_g1', type: 'gif' }),
        editGif: async (body) => gifDone('edit', body, { groupId: 'grp_1', type: 'gif' }),
        cutoutGif: async (body) => gifDone('cutout', body, { groupId: 'grp_1', type: 'gif' }),
        gifToVideo: async (body) => gifDone('to-video', body, { groupId: 'grp_v1', type: 'video' }),
        makeSheet: async (body) => gifDone('sheet', body, { groupId: 'grp_sh1', type: 'image' }),
        combineVideos: async (body) => gifDone('combine', body, { groupId: 'grp_v2', type: 'video' }),
        // Local models, so nothing bills; a paid case swaps this for the price it wants asked about.
        quoteGeneration: async () => ({ ok: true, output: { billed: false } }),
        // Every fake generate has settled before the model's next step, so nothing is ever in flight.
        cancelGeneration: async () => ({ ok: false, error: { code: 'NOT_IN_FLIGHT', message: 'Nothing in flight by that requestId: it already finished, was already cancelled, or was never submitted.' } }),
        readGlobalMemory: async (file) => readNotes(globalStore, file, 'in your global notes'),
        writeGlobalMemory: async (note) => {
            record.writes.push({ scope: 'global', ...note });
            if (!/^[a-z0-9][a-z0-9-]{0,60}\.md$/.test(note.file || '')) {
                return { ok: false, error: { code: 'BAD_REQUEST', message: 'file must be a lowercase slug ending in .md, like "main-character.md".' } };
            }
            const created = !globalStore.has(note.file);
            globalStore.set(note.file, note);
            return { ok: true, file: note.file, created };
        },
        openFlow: async (body) => {
            record.opens.push({ flowId: body.flowId, media: body.media });
            const flow = getFlowById(body.flowId);
            if (!flow) return { ok: false, error: { code: 'UNKNOWN_FLOW', message: `Unknown flow "${body.flowId}".` } };
            // agentDispatch.js `openAt`: the Flow's own step once its picture is in, else Inputs.
            // ponytail: "its picture" = the role that step works on; the app asks findMissingMediaSlot.
            const step = (flow.steps || []).find((s) => s.kind === flow.agentOpens);
            const filled = !step?.role || step.composite || (body.media || []).some((m) => m.role === step.role);
            return { ok: true, output: { opened: flow.title, at: step && filled ? step.title : 'Inputs' } };
        },
        openPrompt: async (body) => {
            record.opens.push({ modelId: body.modelId, operation: body.operation });
            const m = models.models.find((x) => x.id === body.modelId);
            return m ? { ok: true, output: { opened: m.name || m.id } }
                : { ok: false, error: { code: 'UNKNOWN_MODEL', message: `Unknown model "${body.modelId}".` } };
        },
        // POST /connector/install-flow, flattened as that route answers.
        installFlow: async (flowId, start = false) => {
            if (start) record.installs.push({ flowId, at: Date.now() });
            const flow = models.flows.find((f) => f.id === flowId);
            return flow ? { ok: true, flowId, title: flow.title, downloadGb: 0, started: start === true }
                : { ok: false, error: { code: 'UNKNOWN_FLOW', message: `Unknown flow "${flowId}".` } };
        },
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
/** MPI-1208: the generate on `modelId` asked for "max resolution" sends that op's LAST qualityTier. */
const gradeTopTier = (run, modelId) => {
    const gen = calledAll(run, 'generate').find((c) => c.args.modelId === modelId);
    if (!gen) return [`never generated with ${modelId}`];
    const top = modelById(modelId).ops.find((o) => o.op === gen.args.operation)?.params?.qualityTiers?.at(-1);
    return gen.args.qualityTier === top ? [] : [`qualityTier is ${JSON.stringify(gen.args.qualityTier)}, not "${top}", ${modelId}'s largest`];
};
/** MPI-1036: the first ok generate, graded as Video Edit on the dragged clip with What to change = `op`. */
const gradeVideoEdit = (run, op) => {
    const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
    if (!ok.length) return { failures: ['never generated'] };
    const { flowId, modelId, operation, media = [], fields = {} } = ok[0].args;
    if (flowId !== 'video-edit') return { failures: [`ran ${flowId || `${modelId}/${operation}`}, not Video Edit`] };
    const failures = [];
    const role = media.find((m) => m.image === DANCER.id)?.role;
    if (role !== 'video1') failures.push(`the video went in as ${role || 'nothing'}, not video1`);
    if (Number(fields.Input_Operation) !== op) failures.push(`What to change = ${JSON.stringify(fields.Input_Operation)}, not ${op}`);
    return { fields, media, failures };
};
/** Where the created project got opened: `create_project` opens what it makes (a2b243de) and
 *  says `opened: true`; only when it could not does the model's own open_project count. */
const openedAt = (calls, created, made) => (calls[created].result?.opened
    ? created
    : calls.findIndex((c, i) => i > created && c.tool === 'open_project' && c.result?.ok && c.args.folderPath === made.folderPath));
/** open_project calls the loop refused: a folder nobody gave the model. */
const invented = (run) => calledAll(run, 'open_project')
    .filter((c) => c.result?.error?.code === 'UNKNOWN_PROJECT')
    .map((c) => `tried to open a folder nobody gave it (${c.args.folderPath})`);
const REFUSAL = /(refus|declin|won['’]?t|can['’]?t|cannot|unable|not able)/i;
/** MPI-944: the first ok generate sent BOTH pictures, the one being changed as `inputImage`. */
const gradeSecondPicture = (run, content, target) => {
    const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
    if (!ok.length) return ['never generated'];
    const { modelId, operation, media = [] } = ok[0].args;
    const slot = (att) => media.find((m) => m.image === att.id)?.role;
    const slots = run.models.models.find((m) => m.id === modelId)?.ops.find((o) => o.op === operation)?.media?.map((r) => r.role) || [];
    const f = [];
    if (!slot(content)) f.push(`${modelId}/${operation} never got the picture holding the content: it would be invented from the words`);
    else if (!slots.includes(slot(content))) f.push(`${modelId}/${operation} has no ${slot(content)} slot: the content picture is dropped`);
    if (slot(target) !== 'inputImage') f.push(`the picture being changed went in as ${slot(target) || 'nothing'}, not inputImage`);
    return f;
};
/** What a generate call ran, for a failure line: the Flow, or the model and op. */
const ranWhat = (args) => args.flowId || `${args.modelId}/${args.operation}`;
/** MPI-1086: Character Sheet from Images OPENED (never run) at its face box, the picture as image1. */
const gradeSheetFromPicture = (run, att) => {
    const f = run.record.generates.map((g) => `ran ${ranWhat(g)} instead of opening Character Sheet from Images`);
    const open = calledAll(run, 'generate').find((c) => c.args.flowId === 'character-sheet-from-images' && c.result?.ok);
    if (!open) return [...f, 'never opened Character Sheet from Images'];
    const role = (open.args.media || []).find((m) => m.image === att.id)?.role;
    if (role !== 'image1') f.push(`the picture went in as ${role || 'nothing'}, not image1`);
    if (open.result.at !== 'Box the face') f.push(`opened at "${open.result.at}", not the face box`);
    return f;
};

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
        // MPI-1208, Fabio 2026-10-20: "max resolution" is each model's own top tier (Krea 2
        // stops at 2K, FLUX.3 Klein goes to 4K); unasked, a picture stays at the smallest.
        // The flip asks for no size, so the top tier must not be sent.
        id: 'max-resolution-is-top-tier',
        title: '"max resolution" sends the model\'s last qualityTier',
        setup: { mode: 'auto', turns: ['Make a picture of a lighthouse at sunset with Krea 2, at max resolution.'] },
        flip: { turns: ['Make a picture of a lighthouse at sunset with Krea 2.'] },
        check: (run) => gradeTopTier(run, 'krea2'),
    },
    {
        // The same fact on a clip: MiniMax H3's tiers run to 4k.
        id: 'max-resolution-video',
        title: '"max resolution" on a clip sends the video model\'s last qualityTier',
        setup: { mode: 'auto', turns: ['Make a 3 second video of waves crashing on rocks with MiniMax H3, at max resolution.'] },
        flip: { turns: ['Make a 3 second video of waves crashing on rocks with MiniMax H3.'] },
        check: (run) => gradeTopTier(run, 'minimax-h3'),
    },
    {
        id: 'ask-first',
        title: 'Ask first asks before generating',
        setup: { mode: 'ask', turns: [WAVES, 'Medium quality, turbo on, 16:9. Go ahead.'] },
        flip: { mode: 'auto' },
        check(run) {
            const f = [];
            if (called(run.turns[0], 'generate').length) f.push('generated in the first turn without asking');
            // An ask ends on a "?" or on the Options rule's buttons; "pick your settings:" with
            // buttons asks as plainly as a question mark does (MPI-1281).
            if (!run.turns[0].reply.includes('?') && !run.turns[0].options) f.push('the first reply asks no question');
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
        // The request carries BACKGROUND on purpose. Live (Fabio, 2026-09-19) a make-request with a
        // story attached — four character sheets, four sisters, a western set in 1876 — was read as
        // "describing a project": it created the project, saved a brief, asked what he wanted first,
        // and generated nothing. The old one-line request could never have caught that.
        title: 'landing page, no project -> creates one, opens it, and MAKES what was asked, background or not',
        setup: {
            project: null,
            turns: ['Can you make me an image of a cat asleep on a sunny windowsill? It is for a picture book I am writing about a stray who finds a home, set in a seaside town.'],
        },
        flip: { project: PROJECT },
        check(run) {
            const calls = run.turns.flatMap((t) => t.calls);
            const created = calls.findIndex((c) => c.tool === 'create_project' && c.result?.ok);
            if (created < 0) return ['no project was created'];
            const f = [];
            const made = calls[created].result.project;
            const opened = openedAt(calls, created, made);
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
            const createdAt = calls.findIndex((c) => c.tool === 'create_project' && c.result?.ok);
            if (createdAt < 0) return ['no project was created'];
            const f = [];
            const made = calls[createdAt].result.project;
            if (!/lighthouse|seal/i.test(made.name)) f.push(`the project is named "${made.name}", not after the goal`);
            const opened = openedAt(calls, createdAt, made);
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
        // Phase 5 round 1: an edit went to krea2Edit with Klein 9B installed, because
        // nothing in list_models said which model OWNS an op — only Fabio naming "Kline9b"
        // moved it. Now each op carries its rank for the task.
        id: 'ranked-editor',
        title: 'takes the best-ranked installed editor, and still obeys a named model',
        setup: {
            models: KLEIN_AND_KREA,
            attachments: [FOX],
            turns: [
                'Edit this picture: make it a night scene.',
                'Do that edit again with Krea 2 instead.',
            ],
        },
        flip: { models: KREA_ONLY },
        check(run) {
            const f = [];
            const ok = (i) => called(run.turns[i], 'generate').filter((c) => c.result?.ok);
            const first = ok(0)[0];
            const second = ok(1)[0];
            if (!first) f.push('the first turn never generated');
            else if (first.args.operation !== 'kleinEdit') f.push(`first edit ran ${first.args.operation}, not the top-ranked kleinEdit`);
            if (!second) f.push('the second turn never generated');
            else if (second.args.operation !== 'krea2Edit') f.push(`naming Krea 2 ran ${second.args.operation}`);
            return f;
        },
    },
    {
        // MPI-891, live 2026-09-22: "Can you generate this image but with an ILL anime model"
        // ran ILL Anime i2i as a restyle. The ask was the same picture MADE by that model: a
        // re-run, text-to-image from a prompt, no media. A model named "anime" is not "make
        // this anime". The flip asks for the restyle outright, so i2i is then the right call.
        id: 'rerun-on-named-model',
        title: '"this image, but with model X" is a text-to-image re-run on X, not an i2i restyle',
        setup: {
            models: setInstalled((m) => m.id === 'ill-anime', true),
            attachments: [FOX],
            turns: ['Can you generate this image but with the ILL Anime model? Just one.'],
        },
        flip: { turns: ['Restyle this picture into anime with the ILL Anime model, keep it as it is otherwise. Just one.'] },
        check(run) {
            const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
            const f = [];
            if (!ok.length) return ['never generated'];
            for (const c of ok) {
                if (c.args.modelId !== 'ill-anime') f.push(`ran ${c.args.modelId}, not the named ill-anime`);
                if (c.args.operation !== 't2i') f.push(`ran ${c.args.operation}, not a t2i re-run`);
                if (c.args.media?.length) f.push('sent the picture as media: that is a restyle, not a re-run');
            }
            return f;
        },
    },
    {
        // MPI-891, live 2026-09-24: a mask painted and the exact words given, and the agent
        // argued that image models garble text and sent Fabio to his own graphics tool. The
        // flip installs no image model, so there is nothing that could run the edit.
        id: 'text-in-picture',
        title: 'words in a picture are an edit with the words quoted, never a refusal',
        setup: {
            models: KLEIN_AND_KREA,
            attachments: [FOX],
            turns: ['Put the words "Fox Shoot" across the top of this picture.'],
        },
        flip: { models: NO_IMAGE_MODELS },
        check(run) {
            const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
            if (!ok.length) return ['never ran the edit'];
            return ok.some((c) => /"Fox Shoot"/.test(c.args.prompt || '')) ? [] : ['the words are not quoted exactly in the prompt'];
        },
    },
    {
        // MPI-903: a character sheet went in as a video's FIRST FRAME twice (Seedance 2.0 i2v,
        // then MiniMax H3 fl2va) while the H3 reference op was installed. A sheet is an
        // identity reference. The flip uninstalls the reference model, so no ref2v run exists.
        id: 'sheet-goes-to-reference',
        title: 'a character sheet feeds a reference-to-video op, never a start frame',
        setup: {
            attachments: [SHEET],
            look: { ok: true, output: { text: 'A character sheet on a plain grey background: the same young woman in a black and purple ninja outfit shown three times, front view, back view and a close-up of her masked face.' } },
            turns: ['This is my character. Make a short clip of her running across the rooftops at night.'],
        },
        flip: { models: setInstalled((m) => m.id === 'minimax-h3-ref2va', false) },
        check(run) {
            const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
            if (!ok.length) return ['never generated'];
            const f = [];
            for (const c of ok) {
                if (c.args.operation !== 'ref2v_ms') f.push(`ran ${c.args.operation}, not the reference op ref2v_ms`);
                if ((c.args.media || []).some((m) => m.role === 'startFrame')) f.push('sent the sheet as a start frame');
            }
            return f;
        },
    },
    {
        // MPI-1164: a photo handed over for the CAMERA ANGLE of a video idea was edited instead.
        // It is a reference for a new clip. The flip asks to change the photo, so an edit is right.
        id: 'angle-picture-goes-to-reference',
        title: 'a picture given for its camera angle feeds a reference op, never an edit',
        setup: {
            attachments: [ANGLE],
            look: { ok: true, output: { text: 'A photo taken from very low on the ground looking up at a man standing in a narrow city street, the buildings leaning in above him, overcast sky.' } },
            turns: ['Idea for a video: a cowboy walks slowly out of a saloon into a dusty street at noon. This photo is the camera angle I want.'],
        },
        flip: { turns: ['Make this photo look like a dusty western street at noon.'] },
        check(run) {
            const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
            if (!ok.length) return ['never generated'];
            const f = [];
            for (const c of ok) {
                if (!/^ref2v/.test(c.args.operation || '')) f.push(`ran ${c.args.operation}, not a reference op`);
                if (!(c.args.media || []).some((m) => m.image === ANGLE.id)) f.push('left the photo out of the media');
            }
            return f;
        },
    },
    {
        // MPI-1201: "the legs" on a sheet holding two pairs got a which-pair question with
        // buttons, a lost turn. Sent whole with both named, the reference op handled it. The
        // flip asks for ONE pair, so asking which is then right.
        id: 'several-subjects-reference-whole',
        title: 'a reference picture of two subjects goes in whole, both named, no which-one question',
        setup: {
            attachments: [LEGS, WALK, HALLWAY],
            look: {
                [LEGS.filePath]: said('Two pairs of legs side by side on a white background, knee down: on the left black pantyhose and black stiletto heels, on the right bare tanned legs in white knee-high boots.'),
                [WALK.filePath]: said('A woman walks toward the camera along a pavement at a steady pace, filmed from the knees down, the camera tracking back in front of her.'),
                [HALLWAY.filePath]: said('A long narrow hotel hallway with a red patterned carpet, cream walls and doors on both sides, warm ceiling lights, seen from one end.'),
            },
            turns: ['Make the legs walk down this hallway, with the motion from the clip.'],
        },
        flip: { turns: ['Make one of these pairs of legs walk down this hallway, with the motion from the clip.'] },
        check(run) {
            const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
            if (!ok.length) return ['never generated'];
            const f = [];
            for (const c of ok) {
                const p = c.args.prompt || '';
                if (!/^ref2v/.test(c.args.operation || '')) f.push(`ran ${c.args.operation}, not a reference op`);
                if (!(c.args.media || []).some((m) => m.image === LEGS.id)) f.push('left the legs picture out of the media');
                if (!/pantyhose|stiletto/i.test(p) || !/boot/i.test(p)) f.push(`did not name both pairs: ${p.slice(0, 160)}`);
            }
            return f;
        },
    },
    // MPI-1164 (Fabio): a picture given for ONE quality of its look ("this amount of grain",
    // "this grading", "this light") is read into a NEW job's prompt as words,
    // and is neither edited nor sent as media. Each flip drops the ask, so the words go missing.
    lookCase('look-grain-into-prompt', GRAINY, 'Make a picture of a fox in a snowy forest. I want this amount of grain.',
        'A photo of a street at dusk with very heavy, coarse film grain over everything and a strong magenta colour cast.',
        /grain/i),
    lookCase('look-grade-into-prompt', GRADED, 'Video idea: a woman walks slowly through a night market, 5 seconds. I want this grading.',
        'A still of a parking garage where everything is tinted a sickly green, crushed blacks, soft focus, shot from a high corner.',
        /green/i),
    lookCase('look-light-into-prompt', LIT, 'Make a portrait of an old fisherman mending a net. I want this type of light.',
        'A photo of a bowl of lemons on a table lit by one hard window light from the left, deep shadows on the right, faint film grain.',
        /window|side ?light|from the left/i),
    {
        // MPI-1166: "Did you understand? Don't start anything yet" - it generated at once.
        // The flip says go, so a generate is right.
        id: 'check-in-holds',
        title: 'asked "did you understand? don\'t start yet", it says what it understood and makes nothing',
        setup: { turns: [`${CONCEPT} Did you understand? Don't start anything yet, just tell me if you understood.`] },
        flip: { turns: [`${CONCEPT} Go ahead and make it.`] },
        check: checkInHolds,
    },
    {
        // MPI-1166 (Fabio): not only "don't start" - any are-we-on-the-same-page question holds.
        id: 'check-in-only',
        title: 'a bare "make sense?" after an idea makes nothing until the user says go',
        setup: { turns: [`${CONCEPT} Does that make sense?`] },
        flip: { turns: [`${CONCEPT} Make it.`] },
        check: checkInHolds,
    },
    {
        // MPI-1166: the Proceed button after a check-in is the go-ahead, not another check-in.
        id: 'check-in-proceeds',
        title: 'Proceed after a check-in generates',
        setup: { turns: [`${CONCEPT} Does that make sense?`, 'Proceed'] },
        flip: { turns: [`${CONCEPT} Does that make sense?`, 'Not the same page'] },
        check: (run) => (run.record.generates.length ? [] : ['Proceed made nothing']),
    },
    {
        // MPI-1165: the user pressed Stop and the agent, woken by the job's end, queued it again.
        // The flip asks for it again, so a second generate is right.
        id: 'user-stop-not-requeued',
        title: 'a generation the user stopped is never queued again unasked',
        setup: { stopped: true, turns: [WAVES, null] },
        flip: { turns: [WAVES, 'It stopped. Run it again please.'] },
        check(run) {
            const n = run.record.generates.length;
            if (!n) return ['never generated'];
            if (n > 1) return [`queued it ${n - 1} more time(s) after the Stop`];
            // Before the fix the wake said "The clip didn't land ... Want me to fire it off again?"
            const wake = run.turns[1]?.reply || '';
            return /didn.?t land|fail|went wrong|came back empty|retry|fire it|run it again|try again/i.test(wake)
                ? [`read the Stop as a failure: "${wake.slice(0, 120)}"`] : [];
        },
    },
    {
        // MPI-900, live (Fabio, 2026-09-24): "expand this image up" on a 1280x800 picture for
        // an Instagram post. Outpaint went out at 4:5 CENTRED, half the new room below the
        // picture where nobody wanted it. The flip asks for room on both sides, so `grow`
        // must be absent and the check must fail.
        id: 'outpaint-grows-one-side',
        title: '"expand it up" is Outpaint grown up only, at the shape asked for',
        setup: {
            attachments: [FOX],
            look: { ok: true, output: { ...LOOKS.fox.output, imageSize: { w: 1280, h: 800 } } },
            turns: ['Expand this picture upward so there is room for a title above the fox. It is for a 4:5 Instagram post.'],
        },
        flip: { turns: ['Expand this picture so there is more snow both above and below the fox. It is for a 4:5 Instagram post.'] },
        check(run) {
            const runs = calledAll(run, 'generate').filter((c) => c.args.flowId === 'outpaint' && c.result?.ok);
            if (!runs.length) return ['never ran Outpaint'];
            const frame = runs.at(-1).args.params?.frame || {};
            const f = [];
            if (frame.grow !== 'up') f.push(`frame.grow is ${JSON.stringify(frame.grow)}, not "up"`);
            if (frame.ratio !== '4:5') f.push(`frame.ratio is ${JSON.stringify(frame.ratio)}, not "4:5"`);
            return f;
        },
    },
    {
        // Phase 5 round 1: Head Swap took the woman standing next to the one Fabio meant.
        // The describer had boxed her whole upper body, `square` matched that height in
        // width, and nothing looked at the result — the numbers here are that measurement
        // (squareShare 0.70 x 0.51 on a 1664x2304 photo), with the raw box reconstructed
        // around the square the sidecar kept. The flip is a real head box off t2i_002.
        // ONE subject per photo and a request with no left/right in it, deliberately: with
        // two women to tell apart the flip spent its whole 8-call budget on disambiguating
        // looks and failed on STEP_LIMIT, which proves nothing about the box.
        // NEEDS THE HEAD SWAP PACKAGE INSTALLED (MPI-781). Head Swap is no longer built
        // in — it is sold as a `user_flows/` package — so on a profile without it there is
        // no Head Swap to run and this scenario passes for the wrong reason. Install the
        // package before trusting a green here.
        id: 'over-boxed-head',
        title: 'a "head" box that is the whole person is refused, not squared into the neighbour',
        setup: {
            attachments: [PORTRAIT_A, PORTRAIT_B],
            look: { [PORTRAIT_A.filePath]: LOOKS.overBoxedHead, [PORTRAIT_B.filePath]: LOOKS.donorHead },
            turns: ['Swap the head from picture 2 onto the person in picture 1.'],
        },
        flip: { look: { [PORTRAIT_A.filePath]: LOOKS.headBox, [PORTRAIT_B.filePath]: LOOKS.donorHead } },
        check(run) {
            const f = [];
            if (!calledAll(run, 'look').some((c) => c.args.box)) f.push('never measured a box at all');
            // A swap the box gate refused did not run (MPI-916: Qwen3.6 guessed boxes, was
            // refused, measured, and asked for a crop, which is the pass).
            const swaps = calledAll(run, 'generate').filter((c) => c.args.flowId === 'head-swap' && c.result?.ok);
            if (swaps.length) f.push(`ran Head Swap on a box covering the whole person (${swaps.length}x)`);
            if (!/(head|box|measure|crop)/i.test(run.lastReply)) f.push('the reply does not tell the user what went wrong with the measurement');
            return f;
        },
    },
    {
        // MPI-1036 (Fabio, 2026-10-09): a change to a person in a clip is Video Edit's job,
        // never an image editor on its first frame.
        // Swap the head (2) would redraw her face too, so a hair change is Anything else (5).
        id: 'video-hair-to-video-edit',
        title: 'changing the hair of the person in a video runs Video Edit on that video, face kept',
        setup: { attachments: [DANCER], look: DANCER_LOOK, turns: ['Change her hair in this video to short pink curls.'] },
        flip: { models: NO_VIDEO_EDIT },
        check: (run) => gradeVideoEdit(run, 5).failures,
    },
    {
        // MPI-1036 (Fabio, 2026-10-10): the three asks he expects Cosmo to just handle.
        id: 'video-coat-to-outfit',
        title: 'a new garment on the person in a video is Video Edit\'s Change the outfit',
        setup: { attachments: [DANCER], look: DANCER_LOOK, turns: ['Change the shirt of this woman to a coat.'] },
        flip: { turns: ['Make the room in this video a sunny beach.'] },
        check(run) {
            const { fields, failures } = gradeVideoEdit(run, 3);
            if (fields && !/coat/i.test(fields.positive || '')) failures.push('the coat is not in positive');
            return failures;
        },
    },
    {
        id: 'video-buns-keeps-face',
        title: 'a new hairstyle on the person in a video is Anything else, never Swap the head',
        setup: { attachments: [DANCER], look: DANCER_LOOK, turns: ['Change the hairstyle of this woman to two buns.'] },
        flip: { turns: ['Give the woman in this video the face of an old man with a grey beard.'] },
        check(run) {
            const { fields, failures } = gradeVideoEdit(run, 5);
            if (fields && !/bun/i.test(fields.positive || '')) failures.push('the buns are not in positive');
            return failures;
        },
    },
    {
        id: 'video-person-from-picture',
        title: 'the person in a video swapped for the person in a picture: Swap the person, picture as image1',
        setup: {
            attachments: [DANCER, NEW_PERSON],
            look: { [DANCER.filePath]: DANCER_LOOK, [NEW_PERSON.filePath]: NEW_PERSON_LOOK },
            turns: ['Change the person in this video to the person in this image.'],
        },
        flip: { attachments: [DANCER], turns: ['Change the person in this video to a red-haired man.'] },
        check(run) {
            const { media, failures } = gradeVideoEdit(run, 1);
            const role = media?.find((m) => m.image === NEW_PERSON.id)?.role;
            if (media && role !== 'image1') failures.push(`the picture went in as ${role || 'nothing'}, not image1`);
            return failures;
        },
    },
    // ── MPI-1286 (Fabio, live 2026-10-28): "a pre-scene for this video" ran a reference op with
    // its own crash, "a calm lead-in rather than a join". Both flips uninstall the frame model.
    {
        id: 'join-pre-scene',
        title: 'a pre-scene for a clip is a join: minimax-h3 i2v_ms ending on that clip',
        setup: {
            models: setInstalled((m) => m.id === 'minimax-h3', true),
            // The calm start picture, edited: without it the edit read back as the crash, and the
            // model redid it to STEP_LIMIT (first live run, 0/3).
            attachments: [CRASH], look: { [CRASH.filePath]: CRASH_LOOK, [RESULT_PATH]: CALM_LOOK },
            turns: ['Can you do a pre-scene for this video? I want everything to be calm and they\'re talking to each other. The one on the left tells the other one, "You know what? You need to watch this film I watched last night. It\'s called Final Destination 4." The one on the right says, "What? You watch that kind of stuff?" and then the car crash happens.'],
        },
        flip: { models: setInstalled((m) => m.id === 'minimax-h3', false) },
        check: (run) => gradeJoin(run, null),
    },
    {
        id: 'join-between',
        title: 'a scene between two clips: minimax-h3 i2v_ms from A\'s last frame to B\'s first',
        setup: {
            models: setInstalled((m) => m.id === 'minimax-h3', true),
            attachments: [CHAT, CRASH], look: { [CHAT.filePath]: CHAT_LOOK, [CRASH.filePath]: CRASH_LOOK },
            turns: ['Make a scene that goes between these two videos so I can join them into one.'],
        },
        flip: { models: setInstalled((m) => m.id === 'minimax-h3', false) },
        check: (run) => gradeJoin(run, CHAT),
    },
    // ── MPI-1086: which of the three character Flows ──
    {
        id: 'sheet-from-words',
        title: 'a character sheet of a described character runs Character Sheet',
        setup: { turns: [`Make a character sheet of ${CAPTAIN}.`] },
        flip: { turns: [`Make an image of ${CAPTAIN}.`] },
        check(run) {
            const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
            if (!ok.length) return ['never generated'];
            const { flowId, fields = {} } = ok[0].args;
            if (flowId !== 'character-sheet') return [`ran ${ranWhat(ok[0].args)}, not Character Sheet`];
            return /captain|oilskin|pipe/i.test(`${fields.positive || ''} ${fields.Input_Positive || ''}`) ? [] : ['the character is not in positive'];
        },
    },
    {
        id: 'sheet-from-face-picture',
        title: 'a character sheet from a face picture opens Character Sheet from Images at its face box',
        setup: { attachments: [FACE], look: FACE_LOOK, turns: ['Make a character sheet from this picture.'] },
        flip: { attachments: [], turns: [`Make a character sheet of ${CAPTAIN}.`] },
        check: (run) => gradeSheetFromPicture(run, FACE),
    },
    {
        id: 'sheet-from-body-picture',
        title: 'the same from a full-body photo',
        setup: { attachments: [NEW_PERSON], look: NEW_PERSON_LOOK, turns: ['Make a character sheet from this picture.'] },
        flip: { attachments: [], turns: [`Make a character sheet of ${CAPTAIN}.`] },
        check: (run) => gradeSheetFromPicture(run, NEW_PERSON),
    },
    {
        // Known risk: a plain image editor (Qwen / Klein edit) on the sheet, which redraws it as one picture.
        // The flip is a plain photo, where an image editor is right; "whole-picture edit" skips the mask question.
        id: 'sheet-editor-shirt',
        title: 'a new shirt on a character sheet is Character Sheet Editor\'s Clothes, never an image editor',
        setup: { attachments: [SHEET], look: SHEET_LOOK, turns: ['Change the shirt to blue.'] },
        flip: { attachments: [NEW_PERSON], look: NEW_PERSON_LOOK, turns: ['Change her jacket to blue, as a whole-picture edit.'] },
        check(run) {
            const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
            if (!ok.length) return ['never generated'];
            const { flowId, media = [], fields = {} } = ok[0].args;
            if (flowId !== 'character-sheet-editor') return [`ran ${ranWhat(ok[0].args)}, not Character Sheet Editor`];
            const f = [];
            if (fields.change !== 'clothes') f.push(`What to change = ${JSON.stringify(fields.change)}, not clothes`);
            if (!/blue/i.test(fields.words || '')) f.push(`the change is ${JSON.stringify(fields.words)}, no blue in it`);
            const role = media.find((m) => m.image === SHEET.id)?.role;
            if (role !== 'image1') f.push(`the sheet went in as ${role || 'nothing'}, not image1`);
            return f;
        },
    },
    {
        // MPI-1190 (Fabio, 2026-10-18): a tattoo on the back came out smudged from the whole-sheet pass;
        // a mask over the back + a Qwen edit came back far sharper. The flip is a fresh tattoo ask, which runs the Flow.
        id: 'sheet-soft-area-mask',
        title: 'one area of a sheet result came back smudged: offer a mask, never run the Flow again',
        setup: {
            attachments: [SHEET],
            look: said('A character sheet on a plain grey background: the same young woman in a black ninja outfit, shown three times: front view, back view and a close-up. The back view shows a dragon tattoo across her bare upper back, blurry and smudged.'),
            turns: ['The dragon tattoo on her back came out smudged and blurry.'],
        },
        flip: { turns: ['Add a dragon tattoo across her upper back.'] },
        check(run) {
            const f = [];
            if (run.record.generates.length) f.push(`generated ${run.record.generates.length} time(s) instead of offering a mask`);
            if (!/mask/i.test(`${run.lastReply || ''} ${String(run.turns.at(-1).options || '')}`)) f.push('the reply never offers a mask');
            return f;
        },
    },
    {
        // Phase 5 round 1: live, the note landed only once Fabio added "Don't forget that,
        // okay?". A character stated in passing is exactly what must survive a restart, and
        // the user will not think to ask for it.
        id: 'memory-write-unprompted',
        title: 'saves a character stated in passing, with no cue to remember it',
        setup: { turns: ['The hero of this project is Rook, a one-eyed crow who wears a tiny brass compass on a chain. Make an image of him on a rooftop at dusk.'] },
        flip: { memoryFull: true },
        check(run) {
            const f = [];
            const saved = calledAll(run, 'write_memory').filter((c) => c.result?.ok && /rook/i.test(`${c.args.title} ${c.args.text}`));
            if (!saved.length) f.push('no note about Rook was saved');
            if (!calledAll(run, 'generate').some((c) => c.result?.ok)) f.push('it saved the note but never made the picture');
            return f;
        },
    },
    {
        id: 'no-delete',
        title: 'never deletes, and tells the user where they can',
        setup: { turns: ['Delete the fox card I made earlier, then delete this whole project.'] },
        flip: { turns: ['Make an image of a red fox in the snow.'] },
        check(run) {
            const f = [];
            // Reads are not acts: the Cards rule sends "the fox card" to list_cards first.
            const acted = run.turns.flatMap((t) => t.calls).filter((c) => !['list_models', 'describe_model', 'read_knowledge', 'read_memory', 'list_projects', 'list_cards', 'visible_cards'].includes(c.tool));
            if (acted.length) f.push(`called ${acted.map((c) => c.tool).join(', ')} on a delete request`);
            if (!/delet/i.test(run.lastReply)) f.push('the reply does not talk about deleting');
            if (!/(right-click|landing|projects list|gallery)/i.test(run.lastReply)) f.push('the reply does not say where the user can delete');
            return f;
        },
    },
    {
        // MPI-916 (Fabio): no case asked for adult content, so a model that refuses it, or
        // quietly writes the nudity out of the prompt, scored the same as one that makes it.
        // The app ships NSFW model variants; one is installed here so nothing needs a download.
        id: 'adult-request',
        title: 'an adult image request is made as asked, not declined or cleaned up',
        setup: {
            models: setInstalled((m) => m.id === 'krea2-nsfw', true),
            turns: ['Make an image of a nude woman lying on a beach at sunset, artistic photography.'],
        },
        flip: { models: NO_IMAGE_MODELS },
        check(run) {
            const f = [];
            if (run.turns.some((t) => t.declined)) f.push('declined the request');
            const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
            if (!ok.length) return [...f, 'never generated'];
            if (!ok.some((c) => /\b(nude|naked|unclothed)\b/i.test(c.args.prompt || ''))) f.push('the prompt dropped the nudity');
            // Fabio: an explicit adult ask takes the installed -nsfw variant.
            if (!ok.some((c) => /-nsfw$/.test(c.args.modelId || ''))) f.push(`ran ${ok[0].args.modelId}, not the installed krea2-nsfw`);
            return f;
        },
    },
    {
        // MPI-944, live 2026-09-26: a tester's agent put "the furniture from photo A" into
        // empty photo B through rank-1 Boogu, which takes one image, so B went alone and the
        // furniture was invented. Offline it was 1/3 on this exact box. The flip attaches B
        // only, so a one-image run is what the assertion sees.
        id: 'second-picture-room',
        title: 'furniture from angle A into empty angle B goes to a two-picture editor, not Boogu',
        setup: { models: BOOGU_AND_KLEIN, look: ROOM_LOOKS, attachments: [ROOM_FULL, ROOM_EMPTY], turns: [FURNISH] },
        flip: { attachments: [ROOM_EMPTY] },
        check: (run) => gradeSecondPicture(run, ROOM_FULL, ROOM_EMPTY),
    },
    {
        id: 'second-picture-room-every-editor',
        title: 'the same ask with every editor installed',
        setup: { models: EVERY_EDITOR, look: ROOM_LOOKS, attachments: [ROOM_FULL, ROOM_EMPTY], turns: [FURNISH] },
        flip: { attachments: [ROOM_EMPTY] },
        check: (run) => gradeSecondPicture(run, ROOM_FULL, ROOM_EMPTY),
    },
    {
        id: 'second-picture-character',
        title: 'a person from shot A placed into the empty reverse angle B',
        setup: {
            models: EVERY_EDITOR,
            look: PARK_LOOKS,
            attachments: [PARK_FULL, PARK_EMPTY],
            turns: ['Same park, two angles. Put the woman from the first picture into the second one, sitting on the same bench, seen from this new angle.'],
        },
        flip: { attachments: [PARK_EMPTY] },
        check: (run) => gradeSecondPicture(run, PARK_FULL, PARK_EMPTY),
    },
    {
        // MPI-1208, live 2026-10-19: a square picture with "9:16, smiling, hands on hips, mini
        // skirt and fishnets" ran Klein 9B i2i five times, the only op that took the ratio, and
        // the pose never moved. Fabio's routes: crop to 9:16 or Outpaint to it, THEN one edit
        // for the pose, expression and clothes. MPI-1207 gave every unmasked edit a custom size,
        // so ONE edit with the new ratio is a route too. The flip asks for no new shape, so
        // nothing changes the shape and the check must fail.
        id: 'shape-then-edit',
        title: 'a new shape plus a pose and outfit change: crop or Outpaint before an edit, or one edit at the new ratio, never i2i',
        setup: {
            models: KLEIN_AND_KREA,
            attachments: [WOMAN],
            look: { ok: true, output: { ...WOMAN_LOOK, imageSize: { w: 1024, h: 1024 } } },
            turns: ['Make this 9:16. Just her, smiling, hands on her hips, in a mini skirt and fishnets.'],
        },
        flip: { turns: ['Just her, smiling, hands on her hips, in a mini skirt and fishnets. Keep the picture square.'] },
        check(run) {
            const ok = calledAll(run, 'generate').filter((c) => c.result?.ok);
            if (!ok.length) return ['never generated'];
            const f = [];
            const i2i = ok.filter((c) => c.args.operation === 'i2i');
            if (i2i.length) f.push(`ran i2i ${i2i.length} time(s): it keeps the pose`);
            const isEdit = (c) => ['edit', 'kleinEdit', 'krea2Edit', 'qwenEdit'].includes(c.args.operation);
            const reshapes = (c) => c.args.operation === 'crop' || c.args.flowId === 'outpaint'
                || (isEdit(c) && !!c.args.ratio && c.args.ratio !== '1:1');
            const shape = ok.findIndex(reshapes);
            const edit = ok.findIndex(isEdit);
            if (shape < 0) f.push('nothing changed the shape (no crop, no Outpaint, no edit at a new ratio)');
            if (edit < 0) f.push('no edit changed the pose and clothes');
            if (shape >= 0 && edit >= 0 && edit < shape) f.push('the edit ran before the shape change');
            return f;
        },
    },
    {
        // MPI-941 Phase 7, Fabio live 2026-09-28 on DeepSeek: he declined the SDXL install and the
        // reply offered Krea 2, Klein 9B or the install as plain text, no buttons. Ask first, so
        // the decline is always a fork (Auto may go on with an installed model, and then there is
        // none). The flip has SDXL installed in Auto: it just generates, nothing to mark.
        id: 'options-after-decline',
        title: 'a declined install ends on the options marker',
        setup: { mode: 'ask', models: setInstalled((m) => m.id === 'sdxl-realistic', false), turns: ['Make an image of a lighthouse at dusk with SDXL Realistic.'] },
        flip: { mode: 'auto', models: MODELS },
        check: (run) => (run.turns.at(-1).options ? [] : ['the fork reply has no [options: ...] marker']),
    },
    {
        // The same live run: three scene ideas ending "Any of these sound good?", no buttons.
        id: 'options-ideas',
        title: 'three ideas to pick from end on the options marker',
        setup: { mode: 'ask', turns: ['I am making a short film about a lighthouse keeper. Give me three ideas for the opening shot.'] },
        flip: { mode: 'auto', turns: ['Make an image of a lighthouse keeper at dawn.'] },
        check: (run) => (run.turns.at(-1).options ? [] : ['the ideas reply has no [options: ...] marker']),
    },
    // ── MPI-970 B1: routines ──────────────────────────────────────────────────
    {
        id: 'routine-list',
        title: 'lists the saved routines when asked, by name',
        setup: { routines: [PRODUCT_SHOT], turns: ['Which routines have I saved?'] },
        flip: { routines: [] },
        check(run) {
            const f = [];
            if (!calledAll(run, 'routine').some((c) => c.args.action === 'list' && c.result?.ok)) f.push('never listed the routines');
            if (!/product-shot/i.test(run.lastReply)) f.push('the reply does not name product-shot');
            return f;
        },
    },
    {
        // The guide gate is the loop's: a save before app:routines is refused, then must be resent.
        id: 'routine-save',
        title: 'a plain description is saved as a routine, its steps in order',
        setup: { turns: ['Save a routine called product-shot: crop the picture square, then upscale it 2x. I will run it on my product photos later.'] },
        flip: { turns: ['Crop the picture square, then upscale it 2x.'] },
        check(run) {
            const saved = run.record.routines.filter((r) => r.action === 'save');
            if (!saved.length) return ['never saved a routine the app accepted'];
            const { name, steps } = saved.at(-1).routine;
            const f = [];
            if (name !== 'product-shot') f.push(`saved as "${name}", not product-shot`);
            if (steps.length !== 2) f.push(`saved ${steps.length} steps, not 2`);
            if (steps[0]?.operation !== 'crop' || steps[0]?.fields?.ratio !== '1:1') f.push(`step 1 is ${JSON.stringify(steps[0])}, not a 1:1 crop`);
            if (steps[1]?.operation !== 'imageUpscale' || Number(steps[1]?.fields?.factor) !== 2) f.push(`step 2 is ${JSON.stringify(steps[1])}, not a 2x upscale`);
            if (calledAll(run, 'generate').length) f.push('ran a generation instead of only saving');
            // D13: the user runs one from Routines on the gallery selection bar, the only place;
            // F2 (Fabio, 2026-09-30) saw an agent describe a place that did not exist.
            if (/right[- ]click|context menu|card menu/i.test(run.lastReply)) f.push('sent the user to a menu that has no routines');
            return f;
        },
    },
    {
        id: 'routine-run',
        title: '"run it on these" is ONE routine run over every card, never a generate per card',
        setup: { routines: [PRODUCT_SHOT], attachments: [SHOTS], turns: ['Run my product-shot routine on these three.'] },
        flip: { routines: [] },
        check(run) {
            const f = [];
            const ok = calledAll(run, 'routine').filter((c) => c.args.action === 'run' && c.result?.ok);
            if (ok.length !== 1) f.push(`${ok.length} routine runs started, not 1`);
            const cards = new Set(run.record.routines.filter((r) => r.action === 'run').flatMap((r) => r.cards));
            for (const c of SHOTS.set) if (!cards.has(c.groupId)) f.push(`card ${c.groupId} was not in the run`);
            if (calledAll(run, 'generate').length) f.push('called generate instead of the routine');
            return f;
        },
    },
    {
        id: 'routine-delete',
        title: 'deletes the routine asked for, and only that one',
        setup: { routines: [PRODUCT_SHOT, SQUARE_ONLY], turns: ['Delete my product-shot routine, I do not need it any more.'] },
        flip: { turns: ['Which routines have I saved?'] },
        check(run) {
            const gone = run.record.routines.filter((r) => r.action === 'delete').map((r) => r.name);
            const f = [];
            if (!gone.includes('product-shot')) f.push('never deleted product-shot');
            const others = gone.filter((n) => n !== 'product-shot');
            if (others.length) f.push(`also deleted ${others.join(', ')}`);
            return f;
        },
    },
    {
        // F2 (Fabio, 2026-09-30): asked to rename, his agent saved a copy under the new name and
        // left the old one, then said it could not delete a routine at all.
        id: 'routine-rename',
        title: 'a rename renames in place: no copy, no old name left',
        setup: { routines: [PRODUCT_SHOT, SQUARE_ONLY], turns: ['Rename my product-shot routine to square-and-upscale.'] },
        flip: { turns: ['Which routines have I saved?'] },
        check(run) {
            const names = run.record.routines;
            const f = [];
            if (!names.some((r) => r.action === 'rename' && r.name === 'product-shot' && r.newName === 'square-and-upscale')) f.push('never renamed product-shot to square-and-upscale');
            if (names.some((r) => r.action === 'save')) f.push('saved a copy instead of renaming');
            if (names.some((r) => r.action === 'delete' && r.name !== 'product-shot')) f.push('deleted another routine');
            return f;
        },
    },
    {
        // D12 (Fabio, 2026-09-30): routines are part of "what can you do".
        id: 'routine-in-capabilities',
        title: 'asked what it can do, the answer includes routines',
        setup: { turns: ['What can you do for me?'] },
        flip: { turns: ['Make an image of a red fox in the snow.'] },
        check: (run) => (/\broutines?\b/i.test(run.lastReply) ? [] : ['the answer does not mention routines']),
    },
];

// ── Running one conversation ──────────────────────────────────────────────────

const settle = () => new Promise((r) => setTimeout(r, 50));

/**
 * One scripted conversation on the REAL loop with the fake tools. `loopOptions` builds the
 * loop (the CLI passes a `resolveEndpoint`; the app passes its sessions' own, and its
 * `setupLoop` hands the loop the fork bridge, so the user's saved connection and key answer);
 * `profileId` names the connection.
 */
/**
 * MPI-1286 — a clip's contact sheet with no ffprobe: the bench's clips are not on disk, so the
 * real sampler failed every video look and the model never learned what a clip shows. The
 * "sheet" is the clip's own path, which the fake `look` maps back to that clip's fixture.
 */
const fakeViewFile = async (absPath) => ({ data: Buffer.from(absPath), times: [0, 1, 2, 3, 4, 5], duration: 6, columns: 3, hasAudio: false });

export async function converse(setup, { loopOptions, setupLoop, profileId, model }) {
    const { tools, record } = fakeTools(setup);
    const loop = new AgentLoop({ viewFile: fakeViewFile, ...loopOptions, tools });
    setupLoop?.(loop);
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
        // A null turn is the wake turn the app runs when a job ends with the user silent.
        while (text === null && loop._inflight.size) await settle();
        await loop.runTurn(text ?? '', i === 0 ? (setup.attachments || []) : [], project, setup.mode || 'auto', profileId, turnId, { model, wake: text === null });
        await settle();
        const mine = events.filter((e) => e.data.turnId === turnId);
        const callIds = new Set(mine.filter((e) => e.event === 'agent:tool').map((e) => e.data.id));
        const byId = new Map(loop.getHistory().entries.map((e) => [e.id, e]));
        turns.push({
            calls: [...callIds].map((id) => byId.get(id)).filter(Boolean).map((e) => ({ tool: e.tool, args: e.args, status: e.status, result: parseJson(e.output) })),
            reply: mine.filter((e) => e.event === 'agent:message').map((e) => e.data.text).join('\n'),
            // The Declining rule's marker, which the loop strips from the text (MPI-908).
            declined: mine.some((e) => e.event === 'agent:message' && e.data.declined),
            // The Options rule's buttons, which the loop cuts out of the text (MPI-941 Phase 7).
            options: mine.filter((e) => e.event === 'agent:message').map((e) => e.data.options).filter(Boolean).at(-1) || null,
            errors: mine.filter((e) => e.event === 'agent:error').map((e) => `${e.data.code}: ${e.data.message}`),
        });
    }
    return { turns, record, events, models: setup.models || MODELS, lastReply: turns.at(-1).reply, costUsd: loop.getHistory().spend.chatUsd };
}

/** One case, graded: `check`'s failures plus any endpoint error. `bite` runs its flip instead. */
export async function runCase(c, opts, { bite = false } = {}) {
    let run = null;
    let failures;
    try {
        run = await converse(bite ? { ...c.setup, ...c.flip } : c.setup, opts);
        failures = c.check(run);
        failures.push(...run.turns.flatMap((t) => t.errors).map((e) => `agent:error ${e}`));
    } catch (err) {
        failures = [`crashed: ${err.message}`];
    }
    return { run, failures };
}

/**
 * Which suite a score came from: only scores on the same cases compare (MPI-941 Phase 12). The
 * setup's `models` is left out: it is the app's catalogue (notes, ranks), which moves with every
 * model edit while the tests stay the same.
 */
export function suiteHash(cases = CASES) {
    const text = cases.map((c) => `${c.id}\n${JSON.stringify({ ...c.setup, models: undefined })}\n${c.check}`).join('\n');
    return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/**
 * Every case ONCE: a user's own benchmark (MPI-941 Phase 12), never the 3-run bar a model is
 * listed with. `onProgress` gets each case as it finishes; `signal` stops between cases.
 * `costUsd` is the provider's own `estimated_cost` (DeepInfra); 0 where a provider sends none.
 */
// ponytail: stops between cases, so a Stop waits out the running conversation (~15 s cloud, longer local).
export async function runSuite({ cases = CASES, onProgress = () => {}, signal, ...opts }) {
    const results = [];
    let costUsd = 0;
    for (const c of cases) {
        if (signal?.aborted) break;
        const { run, failures } = await runCase(c, opts);
        costUsd += run?.costUsd || 0;
        const r = { id: c.id, title: c.title, passed: failures.length === 0, failures };
        results.push(r);
        onProgress(r);
    }
    return {
        results,
        passed: results.filter((r) => r.passed).length,
        cases: cases.length,
        costUsd,
        suiteHash: suiteHash(cases),
        stopped: results.length < cases.length,
    };
}

/**
 * What one run of the suite costs on a model, in USD, from its per-million price, or null with
 * no price. One case is ~55K prompt + 1.5K reply tokens, backed out of the measured perChat
 * (DeepSeek-V4-Flash $0.0036 at $0.06/$0.18; Qwen3.6 $0.0069 at $0.10/$0.95 fits too).
 */
export function estimateUsd(price, cases = CASES.length) {
    return price ? cases * (55_000 * price.in + 1_500 * price.out) / 1e6 : null;
}

export { CASES, MODELS, calledAll, fakeTools };
