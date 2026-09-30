/**
 * routineRunner.js — runs a saved routine on cards (MPI-970).
 *
 * Each input card runs the whole chain on its own: step 1 makes a NEW card (the input card
 * is never versioned, D2), every later step lands as that card's next History version,
 * and N cards finish as ONE new stack (one card in -> one new card out, no stack). Every
 * step runs on the previous step's result (D1), plus the run's inputs (D9): the same
 * picture in a reference slot, or the same words in a `{id}`, for every card and every
 * step of the run. A step that fails or is cancelled stops
 * THAT card's chain; its card keeps the versions already made and the other cards carry
 * on (D3); a step with nothing to do on a card is skipped for it (D10). Each card's chain
 * is sequential; cards run side by side through the normal lanes (D4).
 *
 * The run shape is the Phase 1 spike's (`tasks/MPI-970/plan.md` § Phase 1 findings):
 * every card's step 1 is enqueued first and the result stack added after, because the
 * settle drops a filling stack that has no live job; `stackId` rides on EVERY step so the
 * stack reads "filling" until the last step of the last card; the project is re-read
 * before every later step, since a closed project's step-1 snapshot has no result card.
 *
 * Pure orchestration: every touch of the app comes in through `deps`, so the order,
 * landing and failure rules are unit-tested (`tests/routine-runner.test.cjs`). The
 * renderer's `deps` are built in `js/shell/routineDispatch.js`.
 *
 * @typedef {Object} RoutineDeps
 * @property {{models: Object[], flows: Object[]}} lookups - catalogues for `validateRoutine`
 * @property {function(Object): (string|null)} check - a step's missing model/Flow by name, or null
 * @property {function(Object): {billed: boolean, usd: number|null}} price - one run of a step
 * @property {function(string): Promise<Object|null>} readProject - the project as it stands
 *   now: the live one when open, a fresh read when closed
 * @property {function(Object, {url: string, mediaType: string}, Object, Object):
 *   Promise<{ok: true, done: Promise<Object>}|{ok: false, code: string, message: string}>} submit -
 *   builds and ENQUEUES one step on one input; `ok` once queued, `done` settles with
 *   `{ ok: true, item, group }` or `{ ok: false, code, message }`. The step arrives with its
 *   run inputs filled: `{id}` replaced in its texts, and `media` = `[{ role, url }]`, the
 *   reference slots only; the input (2nd arg) goes in the op's one required slot. The
 *   landing (3rd arg) is the run's shared queue opts, plus `existingGroup` for a later step.
 * @property {function(Object, Object): Promise<void>} addStack - adds the result stack
 *   `{ id, name, kind, expected }` to the project
 * @property {function(): string} newId
 */

import { validateRoutine, ROUTINE_PLACEHOLDER } from '../data/routineModel.js';
import { isImageFile, isVideoFile, isAudioFile } from '../utils/file.js';

const _fail = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

// D10: a refusal meaning "nothing to do on THIS card" (a downscale of a picture already
// small enough) is not a D3 failure: the step is skipped and the chain goes on with the
// same picture. ponytail: one such code today; add the next when a tool gains one.
const _nothingToDo = (sub) => sub.code === 'ALREADY_SMALLER';

const _A_KIND = { image: 'a picture', video: 'a video', audio: 'a sound', text: 'words' };

/** The file a card feeds step 1: its selected version, as a stack run feeds it. */
function _cardInput(group) {
    const item = group?.history?.[group.selectedIndex ?? 0];
    return item?.filePath ? { url: item.filePath, mediaType: item.type || group.type } : null;
}

/** The run inputs the caller left out, as refusal-ready `{ id, kind, label }`s. */
function _inputsMissing(routine, given) {
    return (routine.inputs || []).filter(i => {
        const v = given?.[i.id];
        return v === undefined || v === null || (typeof v === 'string' && !v.trim());
    });
}

function _refuseMissing(missing) {
    const names = missing.map(i => `"${i.id}" (${i.label || _A_KIND[i.kind]})`).join(', ');
    return _fail('INPUT_MISSING', `Nothing was run: this routine needs ${names} for this run. Ask the user, then run it again with inputs.`,
        { missing: missing.map(i => i.id) });
}

/**
 * Every run input resolved ONCE for the whole run (D9): text as given, a media input as
 * one card of this project (its selected version) or one file, of the input's kind.
 */
function _resolveInputs(routine, given, project) {
    const missing = _inputsMissing(routine, given);
    if (missing.length) return _refuseMissing(missing);
    const values = {};
    for (const inp of routine.inputs || []) {
        const v = given[inp.id];
        if (typeof v !== 'string') {
            return _fail('INVALID_INPUT', `Nothing was run: input "${inp.id}" takes ${_A_KIND[inp.kind]}, given as ${inp.kind === 'text' ? 'text' : 'ONE card id or file path'}.`);
        }
        if (inp.kind === 'text') { values[inp.id] = v; continue; }
        const group = (project.itemGroups || []).find(g => g.id === v);
        const media = group
            ? _cardInput(group)
            : { url: v, mediaType: isVideoFile(v) ? 'video' : isAudioFile(v) ? 'audio' : isImageFile(v) ? 'image' : null };
        if (media?.mediaType !== inp.kind) {
            return _fail('INVALID_INPUT', `Nothing was run: input "${inp.id}" takes ${_A_KIND[inp.kind]}, and "${v}" is not ${_A_KIND[inp.kind]} card of this project or ${_A_KIND[inp.kind]} file.`);
        }
        values[inp.id] = media;
    }
    return { ok: true, values };
}

/** A step with the run's inputs filled in, as `submit` takes it. */
function _fillStep(step, values) {
    const fill = s => (typeof s === 'string' ? s.replace(ROUTINE_PLACEHOLDER, (_, id) => values[id]) : s);
    const out = { ...step };
    for (const k of ['positive', 'negative']) if (k in out) out[k] = fill(out[k]);
    if (out.fields) out.fields = Object.fromEntries(Object.entries(out.fields).map(([k, v]) => [k, fill(v)]));
    if (out.media) out.media = out.media.map(m => ({ role: m.role, url: values[m.input].url }));
    return out;
}

/** Every missing model or Flow the routine names, once each. */
function _missing(routine, deps) {
    return [...new Set(routine.steps.map(s => deps.check(s)).filter(Boolean))];
}

/**
 * What running the routine on `cardCount` cards needs and costs, dispatching nothing.
 * `usd` is null when a billed step cannot be priced — still `billed`, so the spend is
 * asked about in words rather than skipped. A run input left out of `inputs` refuses
 * here (`INPUT_MISSING`), so the user is never asked to pay for a run that cannot start.
 *
 * @returns {{ok: true, missing: string[], billed: boolean, usd: number|null}|{ok: false, code: string, message: string}}
 */
export function quoteRoutine(routine, cardCount, deps, inputs = {}) {
    const v = validateRoutine(routine, deps.lookups);
    if (!v.ok) return v;
    const missingInputs = _inputsMissing(v.routine, inputs);
    if (missingInputs.length) return _refuseMissing(missingInputs);
    const runs = Math.max(1, Math.round(Number(cardCount) || 1));
    let billed = false;
    let usd = 0;
    for (const step of v.routine.steps) {
        const p = deps.price(step);
        if (!p?.billed) continue;
        billed = true;
        usd = usd === null || p.usd === null ? null : usd + p.usd * runs;
    }
    return { ok: true, missing: _missing(v.routine, deps), billed, usd: billed ? usd : 0 };
}

/**
 * Start a routine on cards of one project. Resolves once every card's step 1 is queued:
 * `{ ok: true, runId, stackId, finished }`, where `finished` resolves with the run's one
 * summary `{ ok, runId, stackId, cards: [{ inputGroupId, groupId, steps, skipped?, failedAt?, error? }] }`:
 * `steps` = the versions that landed, `skipped` = the step numbers that had nothing to do
 * on that card (D10).
 * Nothing is queued when the routine is illegal, needs something missing, or names a card
 * it cannot run on: those come back as `{ ok: false, code, message }`.
 *
 * @param {Object} routine - a saved routine (`cubric/routine/v1`)
 * @param {string[]} cardIds - input card ids, in the order the results should stack
 * @param {{projectFolder: string, inputs?: Object<string, string>}} opts - `inputs` fills
 *   the routine's declared inputs: `{ <id>: <card id or file path> | <text> }`
 * @param {RoutineDeps} deps
 */
export async function runRoutine(routine, cardIds, { projectFolder, inputs: given = {} }, deps) {
    // Re-validated here, not only at save: a model update can make a saved setting illegal.
    const v = validateRoutine(routine, deps.lookups);
    if (!v.ok) return v;

    const missing = _missing(v.routine, deps);
    if (missing.length) {
        return _fail('NOT_INSTALLED', `Nothing was run: this routine needs ${missing.join(', ')}, which ${missing.length === 1 ? 'is' : 'are'} not installed.`, { missing });
    }
    const ids = [...new Set(Array.isArray(cardIds) ? cardIds : [])];
    if (!ids.length) return _fail('NO_CARDS', 'Nothing was run: name at least one card to run the routine on.');

    let project = await deps.readProject(projectFolder);
    if (!project) return _fail('PROJECT_NOT_FOUND', `Nothing was run: no project at "${projectFolder}".`);

    const resolved = _resolveInputs(v.routine, given, project);
    if (!resolved.ok) return resolved;
    const steps = v.routine.steps.map(s => _fillStep(s, resolved.values));

    // Every card is checked before anything runs, so a bad card never leaves half a run.
    const inputs = [];
    for (const id of ids) {
        const group = (project.itemGroups || []).find(g => g.id === id);
        const input = _cardInput(group);
        if (!input) return _fail('CARD_NOT_FOUND', `Nothing was run: no card "${id}" with a picture, video or sound in this project.`);
        if (input.mediaType !== v.inputKind) {
            return _fail('WRONG_MEDIA_TYPE', `Nothing was run: this routine starts on ${v.inputKind === 'image' ? 'a picture' : `a ${v.inputKind}`}, and card "${group.customName || group.name || id}" is ${input.mediaType === 'image' ? 'a picture' : `a ${input.mediaType}`}.`);
        }
        inputs.push({ id, input });
    }

    const runId = deps.newId();
    // A stack holds pictures or videos (stackModel's STACKABLE_KINDS): sound results stay loose.
    const stackId = ids.length > 1 && (v.outputKind === 'image' || v.outputKind === 'video') ? deps.newId() : null;
    // On every step, not only step 1: it groups the run in the queue, and `stackId` keeps
    // a job live for the stack settle until the last step of the last card.
    const shared = { batchId: runId, batchLabel: routine.name, batchTotal: ids.length, ...(stackId ? { stackId } : {}) };

    // The first step of every card FIRST, the stack after. The first step is step 1 unless
    // step 1 has nothing to do on that card (D10): then the next one makes the new card (D2).
    const firsts = [];
    for (const { id, input } of inputs) {
        const skipped = [];
        let at = 0;
        let sub = await deps.submit(steps[0], input, { ...shared }, project);
        while (_nothingToDo(sub)) {
            skipped.push(at + 1);
            if (++at === steps.length) break;
            sub = await deps.submit(steps[at], input, { ...shared }, project);
        }
        firsts.push({ id, at, sub, skipped });
    }
    const queued = firsts.filter(f => f.sub.ok).length;
    if (!queued) {
        const why = firsts.find(f => f.at < steps.length);
        return why
            ? _fail(why.sub.code, `Nothing was run: step ${why.at + 1} was refused. ${why.sub.message}`)
            : _fail(firsts[0].sub.code, `Nothing was run: no step had anything to do. ${firsts[0].sub.message}`);
    }
    if (stackId) {
        await deps.addStack({ id: stackId, name: routine.name, kind: v.outputKind, expected: queued }, project);
    }

    const chain = async ({ id, at, sub, skipped }) => {
        const row = { inputGroupId: id, groupId: null, steps: 0 };
        const out = (extra) => ({ ...row, ...(skipped.length ? { skipped } : {}), ...extra });
        const stop = (n, err) => out({ failedAt: n, error: { code: err.code, message: err.message } });
        if (at === steps.length) return out();
        if (!sub.ok) return stop(at + 1, sub);
        let res = await sub.done;
        if (!res.ok) return stop(at + 1, res);
        row.groupId = res.group.id;
        row.steps = 1;
        for (let i = at + 1; i < steps.length; i++) {
            // As it stands NOW: a closed project's earlier snapshot has no result card, and
            // an open one may have moved on while the last step ran.
            project = await deps.readProject(projectFolder);
            const card = (project?.itemGroups || []).find(g => g.id === row.groupId);
            if (!card) return stop(i + 1, { code: 'CARD_GONE', message: 'The result card was deleted while the routine ran.' });
            const input = { url: res.item.filePath, mediaType: res.item.type || card.type };
            const next = await deps.submit(steps[i], input, { ...shared, existingGroup: card }, project);
            if (_nothingToDo(next)) { skipped.push(i + 1); continue; }
            if (!next.ok) return stop(i + 1, next);
            res = await next.done;
            if (!res.ok) return stop(i + 1, res);
            row.steps++;
        }
        return out();
    };

    const finished = Promise.all(firsts.map(chain)).then(cards => ({
        ok: cards.some(c => c.groupId && !c.failedAt),
        runId,
        stackId,
        cards,
    }));
    return { ok: true, runId, stackId, finished };
}
