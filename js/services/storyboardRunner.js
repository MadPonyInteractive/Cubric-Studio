/**
 * storyboardRunner.js — runs a Storyboard plan into ONE stack of panel cards (MPI-1231).
 *
 * Every panel is its own job and its own card; the cards fill one result stack, each with
 * its intent line as the card's note, and once every job has ended the stack is put in
 * PANEL order and a numbered overview sheet is made from it as its own card.
 *
 * The run shape is the routine runner's (`routineRunner.js`): every job is enqueued first
 * and the stack added after, because the settle drops a filling stack that has no live
 * job; `stackId` rides on every job so they share one collapsed queue row with Cancel all.
 * Cards join the stack in ARRIVAL order (`applyAddMembers` appends), which is why the
 * runner keeps each panel's card and reorders at the end (`reorderStack`, MPI-1268). A
 * panel that fails leaves no card: the others keep their order, and the result names it.
 * A run the user stopped gets its order but no overview: they asked for it to end.
 *
 * Pure orchestration: every touch of the app comes in through `deps`, so the order,
 * landing and failure rules are unit-tested (`tests/storyboard-runner.test.cjs`).
 *
 * @typedef {{prompt: string, intent?: string}} StoryboardPanel
 * @typedef {Object} StoryboardDeps - none of these throw; a failure they cannot recover is logged by them
 * @property {function(): boolean} isLoopArmed - Loop re-fires the last job, so a batch would never end
 * @property {function(StoryboardPanel, number, Object):
 *   Promise<{ok: true, done: Promise<Object>}|{ok: false, code: string, message: string}>} submit -
 *   builds and ENQUEUES one panel (its 0-based index, and the run's shared queue landing); `ok`
 *   once queued, `done` settles with `{ ok: true, item, group }` or `{ ok: false, code, message }`
 * @property {function(Object): Promise<void>} addStack - adds the result stack `{ id, name, kind, expected }`
 * @property {function(Object, string): Promise<void>} writeNote - the intent line onto a landed item
 * @property {function(string, string[]): Promise<boolean>} reorderStack - the stack's members in this order
 * @property {function(string[], string): Promise<void>} makeOverview - the numbered sheet of these cards, in order
 * @property {function(): string} newId
 */

const _fail = (code, message) => ({ ok: false, code, message });

/**
 * @param {StoryboardPanel[]} panels - in story order
 * @param {{name: string}} opts - the stack's name, and the queue row's label
 * @param {StoryboardDeps} deps
 * @returns {Promise<{ok: false, code: string, message: string}|{ok: true, runId: string, stackId: string,
 *   finished: Promise<{ok: boolean, cancelled: boolean, reordered: boolean, overview: boolean,
 *   panels: Array<{index: number, groupId: string|null, error?: {code: string, message: string}}>}>}>}
 */
export async function runStoryboard(panels, { name }, deps) {
    if (deps.isLoopArmed()) return _fail('LOOP_ARMED', 'Disarm Loop before drawing a storyboard.');
    if (!Array.isArray(panels) || !panels.length) return _fail('NO_PANELS', 'Nothing was drawn: the plan has no panels.');
    const blank = panels.findIndex(p => !p?.prompt?.trim());
    if (blank !== -1) return _fail('EMPTY_PANEL', `Nothing was drawn: panel ${blank + 1} has no picture prompt.`);

    const runId = deps.newId();
    const stackId = deps.newId();
    const landing = { batchId: runId, batchLabel: name, batchTotal: panels.length, stackId };

    // Every job FIRST, the stack after: the settle drops a filling stack with no live job.
    const subs = [];
    for (let i = 0; i < panels.length; i++) subs.push(await deps.submit(panels[i], i, { ...landing }));
    const queued = subs.filter(s => s.ok).length;
    if (!queued) {
        const first = subs[0];
        return _fail(first.code, `Nothing was drawn: panel 1 was refused. ${first.message}`);
    }
    await deps.addStack({ id: stackId, name, kind: 'image', expected: queued });

    const panel = async (sub, index) => {
        if (!sub.ok) return { index, groupId: null, error: { code: sub.code, message: sub.message } };
        const res = await sub.done;
        if (!res.ok) return { index, groupId: null, error: { code: res.code, message: res.message } };
        const intent = panels[index].intent?.trim();
        if (intent) await deps.writeNote(res.item, intent);
        return { index, groupId: res.group.id };
    };

    const finished = Promise.all(subs.map(panel)).then(async (rows) => {
        const landed = rows.filter(r => r.groupId).map(r => r.groupId);
        const cancelled = rows.some(r => r.error?.code === 'CANCELLED');
        const reordered = landed.length > 1 ? await deps.reorderStack(stackId, landed) : false;
        // A sheet needs two pictures (`/combine-images`); a stopped run gets none.
        const overview = landed.length > 1 && !cancelled;
        if (overview) await deps.makeOverview(landed, name);
        return { ok: landed.length > 0, cancelled, reordered, overview, panels: rows };
    });
    return { ok: true, runId, stackId, finished };
}
