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
 * The plan's text as panels. A plan saved before MPI-1305 is ONE line (the enhancer graph's
 * `Replace Text` deleted every newline), so blocks are found by their `[PANEL n]` markers and
 * labels, never by newlines; the Markdown plan (`storyboardPlanMarkdown`) reads through
 * `_plain` into the same markers. A block's `Intent:` part is its
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
    const plan = _plain(text);
    const cast = _cast(plan, idea);
    return _blocks(plan).map(b => _panel(b, cast, actorImages));
}

/**
 * The planner's answer as the Markdown the plan holds (MPI-1305): the enhancer's one flattened
 * line was unreadable ("from image 1Lingo: ... [PLACES]Movie Set: ..."), so it lands as a
 * `## Cast` / `## Places` / `## Objects` list of `- **Name**: description` and one `## Panel N`
 * per panel with its `**Picture:**` and `**Intent:**`. Every reader goes through `_plain`, so
 * this Markdown, the bracket form an outside agent writes and a plan saved before both parse
 * the same. An answer with no panel is left as it came, for the user to read.
 * @param {string} text - the planner's answer, or any plan
 * @returns {string}
 */
export function storyboardPlanMarkdown(text) {
    const plan = _plain(text);
    const blocks = _blocks(plan);
    if (!blocks.length) return String(text || '');
    const lines = _castLines(plan);
    const section = (title, kind) => {
        const rows = lines.filter(c => c.kind === kind).map(c => `- **${c.name}**: ${c.desc}`);
        return rows.length ? [`## ${title}`, '', ...rows, ''] : [];
    };
    return [
        '# Storyboard plan', '',
        ...section('Cast', 'character'), ...section('Places', 'place'), ...section('Objects', 'object'),
        ...blocks.flatMap((b, i) => [`## Panel ${i + 1}`, '', `**Picture:** ${b.prompt}`, '',
            ...(b.intent ? [`**Intent:** ${b.intent}`, ''] : [])]),
    ].join('\n').trim();
}

/**
 * A Markdown plan in the bracket form the readers below parse: `## Cast` is `[CAST]`, `## Panel 2`
 * is `[PANEL 2]`, and list marks and bold go (`- **Lena**: ...` is `Lena: ...`). A bracket plan
 * passes through unchanged.
 */
const _plain = text => String(text || '')
    .replace(/^[ \t]*#{1,6}[ \t]*(cast|places|objects)[ \t]*$/gim, (m, tag) => `[${tag.toUpperCase()}]`)
    .replace(/^[ \t]*#{1,6}[ \t]*panel[ \t]*(\d*)[ \t]*$/gim, (m, n) => `[PANEL ${n}]`)
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')
    .replace(/\*\*|__/g, '');

/**
 * The panels as they are drawn, each with only the pictures of what IT names (Fabio, 2026-10-27:
 * his movie-set board fed five robot pictures and three drawn objects to every panel, and the
 * robots came back merged and duplicated). A user's picture belongs to the cast member whose note
 * says "Picture N is NAME", or whose plan line ends "from image N"; one no name owns rides every
 * panel, as nothing says what it shows. A drawn picture rides the panels naming it. Each panel's
 * "image N" counts in its OWN reference list, its user pictures first, then its drawn ones in
 * `drawn` order. A panel with no picture is drawn from its words alone.
 * @param {string} text - the plan box
 * @param {string} idea - as `parseStoryboardPlan`
 * @param {Array<{name: string, kind: string}>} drawn - the pictures drawn before the panels that landed, in order
 * @param {number[]} pictures - each of the user's references' picture number (its slot, from 1), in reference order
 * @returns {Array<StoryboardPanel & {pictures: number[], drawn: number[]}>} - indices into `pictures` and `drawn`, in order
 */
export function panelsWithDrawn(text, idea, drawn, pictures) {
    const plan = _plain(text);
    const cast = _cast(plan, idea);
    const names = [...cast.values()].map(c => c.name);
    const owners = [...cast.values()].map(c => [c.name.toLowerCase(), c.picture || _imageNumber(c.desc)]).filter(([, no]) => no);
    const owned = new Set(owners.map(([, no]) => no));
    return _blocks(plan).map((b) => {
        const wanted = new Set(owners.filter(([n]) => _mentions(b.prompt, cast.get(n).name, names)).map(([, no]) => no));
        const mine = pictures.map((no, i) => i).filter(i => !owned.has(pictures[i]) || wanted.has(pictures[i]));
        const picks = drawn.map((d, i) => i).filter(i => _mentions(b.prompt, drawn[i].name, names));
        const images = {};
        for (const [n, no] of owners) {
            const k = mine.findIndex(i => pictures[i] === no);
            if (k !== -1) images[n] = k + 1;
        }
        picks.forEach((i, k) => { images[drawn[i].name.toLowerCase()] = mine.length + k + 1; });
        return { ..._panel(b, cast, images, true), pictures: mine, drawn: picks };
    });
}

/**
 * One block's prompt with the line of each cast, place and object name it mentions. One whose
 * picture rides this panel gets NO description, only which picture is theirs: the words fight the
 * picture and the model changes the character (Fabio, 2026-10-27). `stale`: a "from image N" left
 * in an unpictured line goes, as its picture is not in this panel's list.
 */
function _panel({ prompt, intent }, cast, actorImages, stale = false) {
    const names = [...cast.values()].map(c => c.name);
    const named = [...cast.values()].filter(c => _mentions(prompt, c.name, names));
    const line = (c) => {
        const n = actorImages[c.name.toLowerCase()];
        if (n) return `${c.name} is the ${c.what || c.kind || 'character'} from image ${n}.`;
        return `${c.name} is ${stale ? c.desc.replace(_FROM_IMAGE, '') : c.desc}.`;
    };
    return { prompt: [prompt, ...named.map(line), _headcount(named)].filter(Boolean).join(' '), intent };
}

/**
 * "Four characters are in the picture, ...: A, B, C and D." for a panel naming three or more. FLUX.3
 * Klein drew three of four robots in 8 of 8 runs, whatever the order, the prop or the action, and
 * all four in 6 of 6 with this line (Fabio's robot crew, MPI-1305, 2026-10-27). Only the plan's
 * `[CAST]` counts: a picture's own line ("Picture 2 is the diner") has no kind and may be a place.
 */
function _headcount(named) {
    const who = named.filter(c => c.kind === 'character').map(c => c.name);
    if (who.length < 3) return '';
    const count = _NUMBERS[who.length - 1] || String(who.length);
    const list = `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}`;
    return `${count[0].toUpperCase()}${count.slice(1)} characters are in the picture, each one whole and clearly visible: ${list}.`;
}

const _NUMBERS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "from image 3" / "from the third image" in a cast line. */
const _FROM_IMAGE = /\s*\bfrom\s+(?:image\s+\d+|the\s+\w+\s+image)\b/gi;

/** The picture number a cast line's "from image 3" / "from the third image" names, or 0. */
function _imageNumber(desc) {
    const m = String(desc).match(/\bfrom\s+(?:image\s+(\d+)|the\s+(\w+)\s+image)\b/i);
    return m ? Number(m[1]) || _ORDINALS.indexOf(String(m[2]).toLowerCase()) + 1 : 0;
}

const _ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

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
    const plan = _plain(text);
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
 * carries the picture's description and the user's own edits. The note's picture number and own
 * words (`picture`, `what`) stay on it. */
const _cast = (plan, idea) => [..._pictureCast(idea), ..._castLines(plan)]
    .reduce((m, c) => m.set(c.name.toLowerCase(), { ...m.get(c.name.toLowerCase()), ...c }), new Map());

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
    const ord = _ORDINALS;
    return [...String(idea || '').matchAll(/\bpicture\s+(\d+)\s+is\s+([^,.]+?)(?:,\s*(?:an?\s+)?([^.]+))?(?:\.|$)/gi)]
        .filter(([, n]) => ord[n - 1])
        .map(([, n, name, what]) => ({
            // "Picture 1 is The Sphinx" names the planner's "Sphinx": without the article it is the
            // same key, so the picture's line replaces the planner's instead of riding beside it.
            name: name.trim().replace(/^(the|an?)\s+/i, ''),
            // "Picture 2 is the diner." names nothing more: the line is "the diner from the second image".
            desc: `the ${(what || name).trim().replace(/^(the|an?)\s+/i, '')} from the ${ord[n - 1]} image`,
            picture: Number(n),
            what: (what || name).trim().replace(/^(the|an?)\s+/i, ''),
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
 *   stackId: string|null, panels: Array<{index: number, groupId: string|null, item?: Object, error?: {code: string, message: string}}>}>}>}
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
        return { ok: landed.length > 0, cancelled, reordered, overview, stackId, panels: rows };
    });
    return { ok: true, runId, stackId, finished };
}
