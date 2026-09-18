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
 * single-entry tasks `ref2v` (minimax-h3-ref2va) and `pid` (nvidia-pid) — a list of one
 * ranks nothing.
 *
 * Adding a model? `docs/playbooks/add-model/` step 5 — a model missing here is invisible
 * to the agent's preference, which reads as the agent ignoring it.
 */

import { MODELS } from './models.js';

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

/** Keyed `modelId:op` where the strength is about that op, else by `modelId`. */
const NOTES = {
    'boogu-edit-high:edit': 'the strongest editor here, but it takes exactly one image',
    'boogu-edit-balanced:edit': 'the same editor on a lighter tier, and still one image only',
    'klein-9b:kleinEdit': 'the native editor: it follows the instruction and keeps the likeness',
    'klein-4b:kleinEdit': 'the small native editor — lighter, and weaker on realism',
    'krea2:krea2Edit': 'faster than Qwen Edit and strong on realism, but it tends to change the surroundings too',
    'qwen-edit:qwenEdit': 'the slowest of these, and the only one that leaves everything outside the edit area untouched',
    'krea2': 'realism',
    'klein-9b': 'realism, well past any SDXL model',
    'chroma-flash': 'candid, real-life, influencer-style photography',
    'chroma-hyper': 'candid, real-life photography, on the faster tier',
    'sdxl-realistic': 'realistic by an older standard: today it sits below Klein 9B',
    'ill-anime': 'anime and stylised art, not photography',
    'ill-anime-beauty': 'anime and stylised art, not photography',
    'pony-mix': 'stylised character art, not photography',
};

const _ranked = new Map();

function _rank(pairs) {
    pairs.forEach(([modelId, op], i) => {
        const note = NOTES[`${modelId}:${op}`] || NOTES[modelId];
        _ranked.set(`${modelId}:${op}`, { rank: i + 1, ...(note ? { note } : {}) });
    });
}

_rank(EDIT);
_rank(T2V);
_rank(I2V);
for (const task of IMAGE_TASKS) {
    _rank(IMAGE_ORDER
        .filter(id => MODELS.find(m => m.id === id)?.supportedOps?.includes(task))
        .map(id => [id, task]));
}

/**
 * This op's place in its task's ranking, or null when the task has no ranking.
 * @returns {{ rank: number, note?: string } | null} rank 1 is the best for that task.
 */
export function opPriority(modelId, op) {
    return _ranked.get(`${modelId}:${op}`) || null;
}
