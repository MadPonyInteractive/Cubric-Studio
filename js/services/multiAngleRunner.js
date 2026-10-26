/**
 * multiAngleRunner.js — runs one Multi-angle pick as a chain of edits on ONE card (MPI-1039).
 *
 * The source is described once (`MULTI_ANGLE_DESCRIBE_ASK`); the answer becomes the prompt
 * builder's facts and the source's framing, and `multiAnglePlan` turns the pick into 1-3 passes
 * (turn or front, height, zoom). Each pass is its own job and its own queue row, and takes the previous
 * pass's result as its first image: pass 1 lands a new card, every later pass lands in that card's
 * history, so the card shows the final view and keeps each step under it. A pass that carries a doll
 * ref gets it padded to its own input's size first (round 20: the ref matches image 1's frame).
 * A pass that fails or is stopped ends the chain; the passes before it stay on the card.
 *
 * Pure orchestration: every touch of the app comes in through `deps`, so the order, chaining and
 * failure rules are unit-tested (`tests/multi-angle-runner.test.cjs`).
 *
 * @typedef {Object} MultiAngleDeps - none of these throw
 * @property {function(): boolean} isLoopArmed - Loop re-fires the last job, so a chain would never end
 * @property {function(string): Promise<{ok: true, text: string}|{ok: false, code?: string, message: string}>}
 *   describe - the source's URL -> the describer's answer
 * @property {function(string, string): Promise<{ok: true, url: string}|{ok: false, message: string}>} ref -
 *   a doll ref (`room/tq_fl`) padded to the size of the picture at this URL
 * @property {function(Object, Array, Object, Object): Promise<{ok: true, done: Promise<Object>}|{ok: false, code: string,
 *   message: string}>} submit - builds and ENQUEUES one pass `{ kind, model, prompt }` with its media, its
 *   landing (`{}` = a new card, `{ existingGroup }` = that card's history) and its place in the chain
 *   (`{ index, total }`, 1-based); `done` settles with `{ ok: true, item, group }` or `{ ok: false, code, message }`
 */

import { multiAnglePlan, parseMultiAngleFacts } from '../data/flowPrompts/multiAngle.js';

const _fail = (code, message) => ({ ok: false, code, message });

/**
 * @param {Object} run - { source: url, pick: { turn, height, zoom? (target rung) }, outfit?: { words, url } }
 * @param {MultiAngleDeps} deps
 * @returns {Promise<{ok: false, code: string, message: string}|{ok: true, steps: Object[],
 *   finished: Promise<{ok: boolean, cancelled: boolean, done: number, total: number, group: Object|null,
 *   error?: {code: string, message: string}}>}>}
 */
export async function runMultiAngle({ source, pick = {}, outfit = {} }, deps) {
    if (deps.isLoopArmed()) return _fail('LOOP_ARMED', 'Disarm Loop before changing the camera angle.');
    if (!source) return _fail('NO_SOURCE', 'Add the picture of the person first.');

    const described = await deps.describe(source);
    if (!described.ok) {
        return _fail(described.code || 'DESCRIBE_FAILED', `The picture could not be read: ${described.message}`);
    }
    const { facts, framing } = parseMultiAngleFacts(described.text);
    const plan = multiAnglePlan({
        turn: pick.turn,
        height: pick.height,
        zoom: pick.zoom ? { from: framing, to: pick.zoom } : undefined,
        outfit: { words: outfit.words, ref: !!outfit.url },
    }, facts);
    if (!plan.ok) return _fail('NOT_BENCHED', plan.reason);
    if (!plan.steps.length) return _fail('NOTHING_TO_DO', 'The picture is already seen from this camera: move a slider first.');

    const total = plan.steps.length;
    const ended = (i, group, error, cancelled = false) => ({ ok: i > 0, cancelled, done: i, total, group, error });
    const chain = async () => {
        let input = source;
        let group = null;
        for (let i = 0; i < total; i++) {
            const step = plan.steps[i];
            const media = [{ role: 'inputImage', url: input }];
            if (step.ref) {
                const ref = await deps.ref(step.ref, input);
                if (!ref.ok) return ended(i, group, { code: 'REF_FAILED', message: ref.message });
                media.push({ role: 'inputImage2', url: ref.url });
            } else if (step.outfitRef) {
                media.push({ role: 'inputImage2', url: outfit.url });
            }
            const sub = await deps.submit(step, media, group ? { existingGroup: group } : {}, { index: i + 1, total });
            const res = sub.ok ? await sub.done : sub;
            if (!res.ok) return ended(i, group, { code: res.code, message: res.message }, res.code === 'CANCELLED');
            input = res.item.filePath;
            group = res.group;
        }
        return ended(total, group);
    };
    return { ok: true, steps: plan.steps, finished: chain() };
}
