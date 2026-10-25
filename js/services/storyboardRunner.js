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
 * The plan box's text as panels. The enhancer flattens its answer to ONE line (the shared
 * graph's `Replace Text`, carried to every backend by `postProcessLikeGraph`), so blocks
 * are found by their `[PANEL n]` markers and labels, never by newlines; the user's own
 * edits may add newlines back, and those read the same. A block's `Intent:` part is its
 * card note; the rest, less a leading `Picture:`, is its prompt. A block with no picture
 * text is dropped.
 *
 * THE CAST IS REPEATED BY CODE, never by the planner (Phase 0, 2026-10-25). Each panel is a
 * separate generation, and the 4B wrote "the same waitress" from panel 2 on, which draws a
 * stranger. So the plan opens on a `[CAST] Name: description ...` block, written once and
 * editable once, and every panel gets the line of each cast name it mentions.
 * @param {string} text
 * @param {string} [idea] - the user's idea: its "Picture N is NAME, a WHAT." sentences
 *   become cast lines (see `_pictureCast`)
 * @returns {StoryboardPanel[]}
 */
export function parseStoryboardPlan(text, idea = '') {
    const plan = String(text || '');
    const cast = [..._castLines(plan), ..._pictureCast(idea)].reduce((m, c) => m.set(c.name.toLowerCase(), c), new Map());
    return plan.split(/\[\s*PANEL\s*\d*\s*\]/i).slice(1).map((block) => {
        const [picture, intent = ''] = block.split(/\bIntent\s*:/i);
        const prompt = picture.replace(/^\s*Picture\s*:/i, '').trim();
        if (!prompt) return null;
        const named = [...cast.values()].filter(c => _mentions(prompt, c.name));
        return { prompt: [prompt, ...named.map(c => `${c.name} is ${c.desc}.`)].join(' '), intent: intent.trim() };
    }).filter(Boolean);
}

const _escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A panel names a cast member by the whole name ("lena" too), or by one capitalised word of a
 * longer one: the planner cast "Grandpa Finn" and then wrote "Grandpa holds the kite".
 */
function _mentions(prompt, name) {
    if (new RegExp(`\\b${_escape(name)}\\b`, 'i').test(prompt)) return true;
    const words = name.split(/\s+/).filter(w => w.length >= 4);
    return words.length > 1 && words.some(w => new RegExp(`\\b${_escape(w)}\\b`).test(prompt));
}

/**
 * `[CAST] Lena: a young waitress ... Stranger: a man in his 40s ...`, up to the first panel.
 * A name is one to four Capitalised words before a colon; its description runs to the next
 * name. The enhancer deletes newlines without a space, so a line can end glued to the next
 * name ("nervous energy.Jasper: A man"): a name may follow a full stop directly.
 */
function _castLines(plan) {
    const m = plan.match(/\[\s*CAST\s*\]([\s\S]*?)(?=\[\s*PANEL|$)/i);
    if (!m) return [];
    const heads = [...m[1].matchAll(/(?:^|[\s.;,])([A-Z][\w'-]*(?: [A-Z][\w'-]*){0,3})\s*:/g)];
    return heads.map((h, i) => {
        const from = h.index + h[0].length;
        const desc = m[1].slice(from, i + 1 < heads.length ? heads[i + 1].index + 1 : undefined);
        return { name: h[1], desc: _lowerLead(desc.trim().replace(/[.;,]+$/, '')) };
    }).filter(c => c.desc);
}

/**
 * The user's "Picture 1 is Bix, a grumpy hairless cat." as Bix's cast line, "the grumpy hairless
 * cat from the first image": the planner cannot see the pictures and invented their looks however
 * it was told (Bix's eyes came back green), and FLUX.3 Klein's edit names its references by
 * ordinal. It wins over the planner's line for the same name.
 */
function _pictureCast(idea) {
    const ord = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
    return [...String(idea || '').matchAll(/\bpicture\s+(\d+)\s+is\s+([^,.]+?)(?:,\s*(?:an?\s+)?([^.]+))?(?:\.|$)/gi)]
        .filter(([, n]) => ord[n - 1])
        .map(([, n, name, what]) => ({
            // "Picture 1 is The Sphinx" names the planner's "Sphinx": without the article it is the
            // same key, so the picture's line replaces the planner's instead of riding beside it.
            name: name.trim().replace(/^(the|an?)\s+/i, ''),
            // "Picture 2 is the diner." names nothing more: the line is "the diner from the second image".
            desc: `the ${(what || name).trim().replace(/^(the|an?)\s+/i, '')} from the ${ord[n - 1]} image`,
        }));
}

/** "A young woman" -> "a young woman", so it reads after "Lena is"; "DJ" or "8-year-old" stay. */
const _lowerLead = s => (/^(?:A\s|[A-Z][a-z])/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

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
