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
 * @typedef {{prompt: string, intent?: string, ratio?: string}} StoryboardPanel - `ratio` overrides
 *   the run's (a place drawn before the panels takes the video's shape, a character a square)
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
 * @param {Object<string, number>} [actorImages] - a drawn cast picture's image number per
 *   lower-cased cast name (`recurringActors`): that cast line ends "from image N", like a
 *   pictured one
 * @returns {StoryboardPanel[]}
 */
export function parseStoryboardPlan(text, idea = '', actorImages = {}) {
    const cast = _cast(String(text || ''), idea);
    return _blocks(String(text || '')).map(b => _panel(b, cast, actorImages));
}

/**
 * The panels once the pictures drawn before them have landed, each with the drawn pictures IT
 * gets: every character and object, but a place only in the panels that name it (Fabio,
 * 2026-10-26: the bat-cave board fed the cave to the river panels too). Each panel's "from image
 * N" counts in its OWN reference list, the user's pictures first, then its drawn ones in `drawn`
 * order, so a panel without the cave numbers the helmet one lower.
 * @param {string} text - the plan box
 * @param {string} idea - as `parseStoryboardPlan`
 * @param {Array<{name: string, kind: string}>} drawn - the pictures that landed, in reference order
 * @param {number} userPictures - how many of the user's pictures come before them
 * @returns {Array<StoryboardPanel & {drawn: number[]}>} - `drawn`: indices into `drawn`, in order
 */
export function panelsWithDrawn(text, idea, drawn, userPictures) {
    const cast = _cast(String(text || ''), idea);
    const names = [...cast.values()].map(c => c.name);
    return _blocks(String(text || '')).map((b) => {
        const picks = drawn.map((d, i) => i).filter(i => drawn[i].kind !== 'place' || _mentions(b.prompt, drawn[i].name, names));
        const images = Object.fromEntries(picks.map((i, k) => [drawn[i].name.toLowerCase(), userPictures + k + 1]));
        return { ..._panel(b, cast, images), drawn: picks };
    });
}

/** One block's prompt with the line of each cast, place and object name it mentions. */
function _panel({ prompt, intent }, cast, actorImages) {
    const names = [...cast.values()].map(c => c.name);
    const named = [...cast.values()].filter(c => _mentions(prompt, c.name, names));
    const line = (c) => {
        const n = actorImages[c.name.toLowerCase()];
        return `${c.name} is ${c.desc}${n ? ` from image ${n}` : ''}.`;
    };
    return { prompt: [prompt, ...named.map(line)].join(' '), intent };
}

/**
 * The cast members and places with no picture that two or more panels name: each panel is
 * drawn alone, so a dragon described only in words is a different dragon in every panel, and a
 * ledge a different ledge (Fabio, 2026-10-25; his volcano board drew three ledges in three
 * panels, one with no volcano). The driver draws each one a picture before the panels, and
 * every panel naming it gets that picture as a reference. Characters come first, then places,
 * then objects, each most-named first: only `MAX_DRAWN_FIRST` are drawn, and a face that changes
 * reads worse than a background, a background worse than a prop. A line that already says
 * "from image" is a picture the user gave.
 * @param {string} text - the plan box
 * @param {string} [idea] - as `parseStoryboardPlan`
 * @returns {Array<{name: string, desc: string, kind: 'character'|'place'|'object'}>}
 */
export function recurringActors(text, idea = '') {
    const plan = String(text || '');
    const pictured = new Set(_pictureCast(idea).map(c => c.name.toLowerCase()));
    const blocks = _blocks(plan);
    const names = [..._cast(plan, idea).values()].map(c => c.name);
    return _castLines(plan)
        .filter(c => !pictured.has(c.name.toLowerCase()) && !/\bfrom\s+(?:the\s+\w+\s+)?image\b/i.test(c.desc))
        .map((c, order) => ({ ...c, order, count: blocks.filter(b => _mentions(b.prompt, c.name, names)).length }))
        .filter(c => c.count >= 2)
        .sort((a, b) => _KINDS.indexOf(a.kind) - _KINDS.indexOf(b.kind) || b.count - a.count || a.order - b.order)
        .map(({ name, desc, kind }) => ({ name, desc, kind }));
}

/** The order `recurringActors` puts them in. */
const _KINDS = ['character', 'place', 'object'];

/**
 * How many pictures are drawn before the panels, at most. Fabio's bat-cave board drew seven
 * (Squirrel, Rabbit, Bats, Gold Helmet, Gold Elephant, Bat Cave, River) and fed all seven to
 * every panel, one short of Qwen-Image 2.1's limit, when a panel shows two or three of them.
 */
export const MAX_DRAWN_FIRST = 4;

/**
 * The style every panel opens on ("3D-animated cartoon film still"), or '' when they differ:
 * the planner opens each panel on the same style, and a picture drawn before the panels needs
 * it too, or a cartoon board gets a photo of its dragon. The opening is the words before the
 * first comma, when no full stop comes first; one panel, or a hand-written plan that opens on
 * a sentence, has none.
 * @param {StoryboardPanel[]} panels
 * @returns {string}
 */
export function panelStyle(panels) {
    const heads = panels.map(p => String(p?.prompt || '').match(/^([^.,]+),/)?.[1].trim() || '');
    return heads.length > 1 && heads[0] && heads.every(h => h === heads[0]) ? heads[0] : '';
}

/** Every cast, place and object line by lower-cased name. The plan box's line wins over the note's: it
 * carries the picture's description and the user's own edits. */
const _cast = (plan, idea) => [..._pictureCast(idea), ..._castLines(plan)].reduce((m, c) => m.set(c.name.toLowerCase(), c), new Map());

/** The panels' own words: a block's `Intent:` part, and the rest less a leading `Picture:`. */
const _blocks = plan => plan.split(/\[\s*PANEL\s*\d*\s*\]/i).slice(1).map((block) => {
    const [picture, intent = ''] = block.split(/\bIntent\s*:/i);
    return { prompt: picture.replace(/^\s*Picture\s*:/i, '').trim(), intent: intent.trim() };
}).filter(b => b.prompt);

const _escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A panel names a cast member by the whole name ("lena" too), or by one capitalised word of a
 * longer one: the planner cast "Grandpa Finn" and then wrote "Grandpa holds the kite". Every
 * other cast name is taken out first, unless it is part of this one: "at Bat Cave Interior" is
 * no mention of "Bat Cave Entrance", "the Gold Helmet" none of "Gold Elephant", and "Cliff Over
 * the River" none of "River" (the bat-cave re-plan, 2026-10-25, put both caves in every cave panel).
 * @param {string[]} [names] - every cast, place and object name in the plan
 */
function _mentions(prompt, name, names = []) {
    prompt = names.filter(o => !new RegExp(`\\b${_escape(o)}\\b`, 'i').test(name))
        .reduce((p, o) => p.replace(new RegExp(`\\b${_escape(o)}\\b`, 'gi'), ' '), prompt);
    if (new RegExp(`\\b${_escape(name)}\\b`, 'i').test(prompt)) return true;
    // A word that is another whole name ("River" of "Cliff Over the River") names that one.
    const words = name.split(/\s+/).filter(w => w.length >= 4);
    return words.length > 1 && words.filter(w => !names.some(o => o.toLowerCase() === w.toLowerCase())).some(w => new RegExp(`\\b${_escape(w)}\\b`).test(prompt));
}

/**
 * `[CAST] Lena: a young waitress ... Stranger: a man in his 40s ... [PLACES] Diner: ... [OBJECTS]
 * Gold Helmet: ...`, up to the first panel; a line's `kind` is its block's. A hand-written plan
 * with an object in `[CAST]` reads it as a character.
 * A name is one to four Capitalised words before a colon, with small linking words between
 * ("Cliff Over the River"; without them it read "River"); its description runs to the next
 * name. The enhancer deletes newlines without a space, so a line can end glued to the next
 * name ("nervous energy.Jasper: A man", "from image 1The Tiger: a white tiger"): a name may
 * follow a full stop or a digit directly.
 */
function _castLines(plan) {
    const block = (tag, kind) => {
        const m = plan.match(new RegExp(`\\[\\s*${tag}\\s*\\]([\\s\\S]*?)(?=\\[\\s*(?:PANEL|PLACES|CAST|OBJECTS)|$)`, 'i'));
        if (!m) return [];
        const heads = [...m[1].matchAll(/(?:^|[\s.;,\d])([A-Z][\w'-]*(?: (?:(?:the|of|over|under|on|in|at|by|and|to|an?) )*[A-Z][\w'-]*){0,3})\s*:/g)];
        return heads.map((h, i) => {
            const from = h.index + h[0].length;
            const desc = m[1].slice(from, i + 1 < heads.length ? heads[i + 1].index + 1 : undefined);
            return { name: h[1], desc: _lowerLead(desc.trim().replace(/[.;,]+$/, '')), kind };
        }).filter(c => c.desc);
    };
    return [...block('CAST', 'character'), ...block('PLACES', 'place'), ...block('OBJECTS', 'object')];
}

/**
 * The user's "Picture 1 is Bix, a grumpy hairless cat." as Bix's cast line, "the grumpy hairless
 * cat from the first image", for a pictured name the plan's [CAST] lacks (a plan written by hand).
 * FLUX.3 Klein's edit names its references by ordinal. It used to win over the planner's line,
 * when the planner could not see the pictures and invented their looks (Bix's eyes came back
 * green); now every picture is described before planning and the planner's line carries that.
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
 * @param {{name: string, sheet?: boolean}} opts - the stack's name, and the queue row's label;
 *   `sheet: false` makes no overview (the cast pictures drawn before the panels)
 * @param {StoryboardDeps} deps
 * @returns {Promise<{ok: false, code: string, message: string}|{ok: true, runId: string, stackId: string|null,
 *   finished: Promise<{ok: boolean, cancelled: boolean, reordered: boolean, overview: boolean,
 *   panels: Array<{index: number, groupId: string|null, item?: Object, error?: {code: string, message: string}}>}>}>}
 */
export async function runStoryboard(panels, { name, sheet = true }, deps) {
    if (deps.isLoopArmed()) return _fail('LOOP_ARMED', 'Disarm Loop before drawing a storyboard.');
    if (!Array.isArray(panels) || !panels.length) return _fail('NO_PANELS', 'Nothing was drawn: the plan has no panels.');
    const blank = panels.findIndex(p => !p?.prompt?.trim());
    if (blank !== -1) return _fail('EMPTY_PANEL', `Nothing was drawn: panel ${blank + 1} has no picture prompt.`);

    const runId = deps.newId();
    // ONE picture is a plain card named for the run, never a stack of one (Fabio: the lone
    // Dragon of a Cast). `stackId` is then null.
    const stackId = panels.length > 1 ? deps.newId() : null;
    const landing = { batchId: runId, batchLabel: name, batchTotal: panels.length,
        ...(stackId ? { stackId } : { cardName: name }) };

    // Every job FIRST, the stack after: the settle drops a filling stack with no live job.
    const subs = [];
    for (let i = 0; i < panels.length; i++) subs.push(await deps.submit(panels[i], i, { ...landing }));
    const queued = subs.filter(s => s.ok).length;
    if (!queued) {
        const first = subs[0];
        return _fail(first.code, `Nothing was drawn: panel 1 was refused. ${first.message}`);
    }
    if (stackId) await deps.addStack({ id: stackId, name, kind: 'image', expected: queued });

    const panel = async (sub, index) => {
        if (!sub.ok) return { index, groupId: null, error: { code: sub.code, message: sub.message } };
        const res = await sub.done;
        if (!res.ok) return { index, groupId: null, error: { code: res.code, message: res.message } };
        const intent = panels[index].intent?.trim();
        if (intent) await deps.writeNote(res.item, intent);
        return { index, groupId: res.group.id, item: res.item };
    };

    const finished = Promise.all(subs.map(panel)).then(async (rows) => {
        const landed = rows.filter(r => r.groupId).map(r => r.groupId);
        const cancelled = rows.some(r => r.error?.code === 'CANCELLED');
        const reordered = landed.length > 1 ? await deps.reorderStack(stackId, landed) : false;
        // A sheet needs two pictures (`/combine-images`); a stopped run gets none.
        const overview = sheet && landed.length > 1 && !cancelled;
        if (overview) await deps.makeOverview(landed, name);
        return { ok: landed.length > 0, cancelled, reordered, overview, panels: rows };
    });
    return { ok: true, runId, stackId, finished };
}
