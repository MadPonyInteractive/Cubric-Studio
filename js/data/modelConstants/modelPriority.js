/**
 * modelPriority.js — which model does a task best, ranked (MPI-774 Phase 5).
 *
 * WHY: `list_models` says which models are installed and which ops they support, and
 * nothing at all about which one is GOOD at a job. Live, the in-app agent sent an edit to
 * `krea2Edit` with Klein 9B installed and had no way to know better; only the user naming
 * "Kline9b" moved it. The op ids are per model (`kleinEdit`, `krea2Edit`, `qwenEdit`,
 * `edit`), so a preference cannot be expressed as an op name — it has to be a ranked list
 * of `{modelId, op}` pairs per TASK. `GET /connector/models` puts each op's `rank` and
 * `note` on that op, and the agent's Model rule reads them.
 *
 * The order is Fabio's (2026-09-18), and so is the shape: he asked for best/second/third
 * rather than one featured model, because "best" depends on the task and on what is
 * installed.
 *
 * NOTES are the half a ranking cannot hold: Qwen Edit is last on speed and first on "do
 * not touch the rest of the picture", which is the whole request for some edits. One short
 * line, in the user's terms, for the entries where it changes the pick.
 *
 * NOT RANKED, on purpose: the `-nsfw` variants (an agent must not drift to one on its own;
 * with only those installed the rule falls back to any op that does the task), and the
 * single-entry task `pid` (nvidia-pid) — a list of one ranks nothing. `ref2v` is a list of
 * one too, but it is RANKED (MPI-916): its note is what sends a character sheet there
 * instead of to i2v's rank 1, and only a ranked op carries a note.
 *
 * Adding a model? `docs/playbooks/add-model/` step 5 — a model missing here is invisible
 * to the agent's preference, which reads as the agent ignoring it.
 */

import { MODELS } from './models.js';
import { estimateCost } from './deepinfraPricing.js';

/** Every image task shares one order: the op id IS the task id for all of them. */
const IMAGE_TASKS = ['t2i', 'i2i', 'control', 'inpaint', 'upscale', 'detail'];

/**
 * Best first. Each task takes this order filtered by the models that declare it, so a
 * model without `inpaint` (chroma) drops out of inpaint rather than needing its own list.
 * The anime/stylised three sit at the end with notes: they are not worse at photography,
 * they are not FOR photography, and the note is what makes the agent pick one on purpose.
 */
const IMAGE_ORDER = [
    'krea2',
    'klein-9b',
    'chroma-flash',
    'chroma-hyper',
    'klein-4b',
    'sdxl-realistic',
    'ill-anime',
    'ill-anime-beauty',
    'pony-mix',
];

/** `[modelId, op]`, best first. */
const EDIT = [
    ['boogu-edit-high', 'edit'],
    ['boogu-edit-balanced', 'edit'],
    ['klein-9b', 'kleinEdit'],
    ['klein-4b', 'kleinEdit'],
    ['krea2', 'krea2Edit'],
    ['qwen-edit', 'qwenEdit'],
];

const T2V = [
    ['minimax-h3', 't2v_ms'],
    ['ltx-23-balanced', 't2v_ms'],
    ['wan22-5b', 't2v'],
    ['ltx-23', 't2v_ms'],
];

// wan-22 is i2v only — it has no t2v op to rank.
const I2V = [
    ['minimax-h3', 'i2v_ms'],
    ['ltx-23-balanced', 'i2v_ms'],
    ['wan-22', 'i2v_ms'],
    ['wan22-5b', 'i2v'],
    ['ltx-23', 'i2v_ms'],
];

const REF2V = [
    ['minimax-h3-ref2va', 'ref2v_ms'],
];

/** Keyed `modelId:op` where the strength is about that op, else by `modelId`. */
const NOTES = {
    'boogu-edit-high:edit': 'the strongest editor here, but it takes exactly one image',
    'boogu-edit-balanced:edit': 'the same editor on a lighter tier, and still one image only',
    'klein-9b:kleinEdit': 'the native editor: it follows the instruction and keeps the likeness, but it tends to cover a bare subject unless the instruction says to keep it as it is',
    'klein-4b:kleinEdit': 'the small native editor — lighter, and weaker on realism',
    'krea2:krea2Edit': 'faster than Qwen Edit and strong on realism, but it tends to change the surroundings too',
    'qwen-edit:qwenEdit': 'the slowest of these, and the only one that leaves everything outside the edit area untouched',
    'minimax-h3-ref2va:ref2v_ms': 'the identity route: a character sheet, a turnaround or several views of one subject go in as references, and the clip is made new around them',
    'krea2': 'realism',
    'klein-9b': 'realism, well past any SDXL model',
    'chroma-flash': 'candid, real-life, influencer-style photography',
    'chroma-hyper': 'candid, real-life photography, on the faster tier',
    'sdxl-realistic': 'realistic by an older standard: today it sits below Klein 9B',
    'ill-anime': 'anime and stylised art, not photography',
    'ill-anime-beauty': 'anime and stylised art, not photography',
    'pony-mix': 'stylised character art, not photography',
};

/**
 * Keyed by op: what the TECHNIQUE buys and costs, whatever model runs it. Appended to the
 * model's own note rather than replacing it, because a restyle needs both halves — which
 * model paints the look, and how the op gets there.
 *
 * MPI-817, Fabio 2026-09-21: a restyle is i2i FIRST, edit only on escalation. The reverse
 * rule shipped while the describer misread pictures, so prompting i2i from a description was
 * unsafe; a kept, correct description now makes it the better route. Live the same morning,
 * with no i2i note at all, "make this anime" went to klein's editor, which dressed the
 * subject — and "can you use a different technique?" could not be answered, because nothing
 * told the agent another technique existed.
 *
 * MPI-916: each note also says what its op is NOT, at the moment the op is chosen. Cheaper
 * models ran "this image but with <model>" as that model's i2i, and fed a character sheet to
 * i2v as its first frame, with the rule sitting in the system prompt and not in front of them.
 */
const I2V_NOTE = 'animates THIS picture: it becomes the first frame exactly as it is, so a character sheet or several views of one subject is never a start frame (that is a reference op)';
const OP_NOTES = {
    i2i: 'the restyle route, only when the user asks to change how THIS picture looks; "this picture, but with <model>" is a re-run: that model\'s t2i, with no media. It repaints the whole picture from the WORDS, so prompt it with the description of THIS image and then the style you want, never a better scene. denoise decides how much moves — keep it low to hold the pose and composition. If the result comes back wrong (the look did not take, or it strays from the original), the next try is an edit op, never this op at another denoise',
    i2v_ms: I2V_NOTE,
    i2v: I2V_NOTE,
};

const _ranked = new Map();

/** How many LOCAL models each task ranked, so the paid ones can carry on from there. */
const _localCount = new Map();

// `task` rides along so the agent's catalogue can mark the best op it can RUN per task
// (`compactCatalogue` in services/agentLoop.mjs): "the lowest rank among what is installed"
// is arithmetic that cheaper models get wrong (MPI-916). The op ids differ per model, so
// only the task says that kleinEdit and krea2Edit compete.
function _rank(pairs, task) {
    pairs.forEach(([modelId, op], i) => {
        const note = [NOTES[`${modelId}:${op}`] || NOTES[modelId], OP_NOTES[op]].filter(Boolean).join('; ');
        _ranked.set(`${modelId}:${op}`, { rank: i + 1, task, ...(note ? { note } : {}) });
    });
    _localCount.set(task, pairs.length);
}

_rank(EDIT, 'edit');
_rank(T2V, 't2v');
_rank(I2V, 'i2v');
_rank(REF2V, 'ref2v');
for (const task of IMAGE_TASKS) {
    _rank(IMAGE_ORDER
        .filter(id => MODELS.find(m => m.id === id)?.supportedOps?.includes(task))
        .map(id => [id, task]), task);
}

/**
 * The paid models rank AFTER every local one, and say what they cost (MPI-875).
 *
 * Live on 2026-09-21 the agent picked `nano-banana-2-cloud` for a plain t2i and billed the
 * user for it unasked. It was not ignoring a ranking: no cloud model appeared in any list
 * above, so `opPriority` answered null — and null reads to the agent as "unranked", not as
 * "avoid". MPI-865 gave the HUMAN picker a cloud badge; this is the agent's equivalent.
 *
 * A rank alone would not do it. The agent also has to be able to say what a cloud run
 * costs when someone asks for one on purpose, so the note carries the price — read from
 * the same snapshot the picker quotes, never typed here, because a hand-written price
 * drifts silently while the snapshot fails `sync-deepinfra-prices.mjs --check` loudly.
 *
 * The four tasks below are every task a cloud model declares an op for. Roster order
 * decides the order among them; the price is in each note, so nothing is hidden by it.
 */
const CLOUD_TASKS = ['t2i', 'edit', 't2v', 'i2v'];

/** What this model charges, in the terms the agent should repeat to the user. */
function _cloudNote(model) {
    const video = model.mediaType === 'video';
    // A 1K image and a 720p clip: the commonest run, and the figure the agent quotes as
    // "about". Veo publishes no duration field at all, so `duration` is ignored there and
    // its own fixed clip length is priced instead — which is why this says "a clip"
    // rather than naming a length it cannot promise.
    const est = estimateCost(model.cloud.endpointId,
        video ? { resolution: '720p', duration: 5 } : { resolution: '1k' });
    const price = est ? `${est.display} ${video ? 'a clip' : 'an image'}` : 'real money';
    return `PAID: runs at ${model.provider} and charges the user's own account, ${price}. `
        + 'Every model ranked above this one is local and free. Pick it only when the user '
        + 'asked for this model, or for the cloud, by name.';
}

for (const task of CLOUD_TASKS) {
    const offset = _localCount.get(task) || 0;
    MODELS
        .filter(model => model.provider && model.cloud?.endpointId && model.supportedOps?.includes(task))
        .forEach((model, i) => _ranked.set(`${model.id}:${task}`, {
            rank: offset + i + 1,
            task,
            // Never `best`: a paid run is picked only when asked for by name (the note).
            paid: true,
            note: _cloudNote(model),
        }));
}

/**
 * The `-nsfw` variants stay UNRANKED (no rank, no task, so never `best`), but carry a note:
 * Fabio, 2026-09-25, an explicit adult request takes one when it is installed. Without the note
 * an unranked op reads as merely "unranked", and the pick declined the ask outright.
 */
const NSFW_NOTE = 'the NSFW bake: take it, when installed, for an explicit adult request, never otherwise';
for (const model of MODELS.filter(m => m.id.endsWith('-nsfw'))) {
    for (const op of model.supportedOps || []) _ranked.set(`${model.id}:${op}`, { note: NSFW_NOTE });
}

/**
 * This op's place in its task's ranking, or null when the task has no ranking.
 * @returns {{ rank?: number, task?: string, paid?: true, note?: string } | null} rank 1 is the best
 *   for that task; an `-nsfw` op has a note and no rank.
 */
export function opPriority(modelId, op) {
    return _ranked.get(`${modelId}:${op}`) || null;
}
