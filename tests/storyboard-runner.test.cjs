/**
 * storyboard-runner.test.cjs — MPI-1231: the order, landing and failure rules of
 * js/services/storyboardRunner.js, against a fake app whose jobs finish in whatever order
 * the test says, and whose stack gains members in ARRIVAL order the way the queue's landing
 * does. The reorder is the REAL `applyReorderMembers`, so its same-set rule applies here too.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const esm = (p) => import('file:///' + path.join(__dirname, '..', p).replace(/\\/g, '/'));

let runStoryboard, parseStoryboardPlan, panelsWithDrawn, recurringActors, panelStyle, MAX_DRAWN_FIRST, storyboardPlanMarkdown, applyReorderMembers;

test.before(async () => {
    ({ runStoryboard, parseStoryboardPlan, panelsWithDrawn, recurringActors, panelStyle, MAX_DRAWN_FIRST, storyboardPlanMarkdown } = await esm('js/services/storyboardRunner.js'));
    ({ applyReorderMembers } = await esm('js/data/stackModel.js'));
});

const plan = (n) => Array.from({ length: n }, (_, i) => ({ prompt: `panel ${i + 1} picture`, intent: `beat ${i + 1}` }));

/**
 * `refuse(i)` refuses panel i before the queue; `outcome(i)` is what its finished job
 * answers (default: lands). Jobs stay open until `finish(i)` is called.
 */
function fakeApp({ refuse = () => null, outcome = () => null, loop = false } = {}) {
    const calls = [];
    let groups = [];
    let ids = 0;
    const open = new Map();
    const deps = {
        isLoopArmed: () => loop,
        async submit(panel, index, landing) {
            calls.push(['submit', index, landing]);
            const no = refuse(index);
            if (no) return { ok: false, ...no };
            let settle;
            const done = new Promise((r) => { settle = r; });
            open.set(index, () => {
                const bad = outcome(index);
                if (bad) return settle({ ok: false, ...bad });
                const group = { id: `card${index}`, type: 'image', history: [{ id: `item${index}`, filePath: `C:/p/${index}.png` }], selectedIndex: 0 };
                groups = [...groups, group].map(g => (g.id === landing.stackId ? { ...g, members: [...g.members, group.id] } : g));
                settle({ ok: true, item: group.history[0], group });
            });
            return { ok: true, done };
        },
        async addStack(stack) {
            calls.push(['addStack', stack]);
            groups = [...groups, { ...stack, type: 'stack', members: [], history: [] }];
        },
        async writeNote(item, text) { calls.push(['note', item.id, text]); },
        async reorderStack(stackId, order) {
            calls.push(['reorder', order]);
            const next = applyReorderMembers(groups, stackId, order);
            const moved = next !== groups;
            groups = next;
            return moved;
        },
        async makeOverview(order, name) { calls.push(['overview', order, name]); },
        newId: () => `id${++ids}`,
    };
    const finish = (...order) => order.forEach(i => open.get(i)());
    const members = (stackId) => groups.find(g => g.id === stackId).members;
    return { deps, calls, finish, members };
}

test('every job is queued before the stack, all on one landing', async () => {
    const app = fakeApp();
    const run = await runStoryboard(plan(3), { name: 'Heist' }, app.deps);
    assert.strictEqual(run.ok, true);
    assert.deepStrictEqual(app.calls.map(c => c[0]), ['submit', 'submit', 'submit', 'addStack']);
    for (const [, , landing] of app.calls.slice(0, 3)) {
        assert.deepStrictEqual(landing, { batchId: run.runId, batchLabel: 'Heist', batchTotal: 3, stackId: run.stackId });
    }
    assert.deepStrictEqual(app.calls[3][1], { id: run.stackId, name: 'Heist', kind: 'image', expected: 3 });
    app.finish(0, 1, 2);
    await run.finished;
});

test('one picture lands as a plain named card, never a stack of one', async () => {
    const app = fakeApp();
    const run = await runStoryboard(plan(1), { name: 'Dragon', sheet: false }, app.deps);
    assert.strictEqual(run.stackId, null);
    assert.deepStrictEqual(app.calls.map(c => c[0]), ['submit']);
    assert.deepStrictEqual(app.calls[0][2], { batchId: run.runId, batchLabel: 'Dragon', batchTotal: 1, cardName: 'Dragon' });
    app.finish(0);
    const out = await run.finished;
    assert.strictEqual(out.ok, true);
    assert.deepStrictEqual(out.panels.map(p => p.groupId), ['card0']);
});

test('cards arriving out of order end in panel order, each with its note, then the overview', async () => {
    const app = fakeApp();
    const run = await runStoryboard(plan(4), { name: 'Heist' }, app.deps);
    app.finish(2, 0, 3, 1);
    const out = await run.finished;
    assert.deepStrictEqual(app.members(run.stackId), ['card0', 'card1', 'card2', 'card3']);
    assert.strictEqual(out.reordered, true);
    assert.deepStrictEqual(app.calls.filter(c => c[0] === 'note').map(c => c.slice(1)).sort(),
        [['item0', 'beat 1'], ['item1', 'beat 2'], ['item2', 'beat 3'], ['item3', 'beat 4']]);
    const last = app.calls.at(-1);
    assert.deepStrictEqual(last, ['overview', ['card0', 'card1', 'card2', 'card3'], 'Heist']);
    assert.deepStrictEqual(out, { ok: true, cancelled: false, reordered: true, overview: true, stackId: run.stackId,
        panels: [0, 1, 2, 3].map(i => ({ index: i, groupId: `card${i}`, item: { id: `item${i}`, filePath: `C:/p/${i}.png` } })) });
});

test('a failed panel leaves no card, the rest keep their order, the result names it', async () => {
    const app = fakeApp({ outcome: i => (i === 1 ? { code: 'RUNTIME_ERROR', message: 'out of memory' } : null) });
    const run = await runStoryboard(plan(4), { name: 'Heist' }, app.deps);
    app.finish(3, 1, 2, 0);
    const out = await run.finished;
    assert.deepStrictEqual(app.members(run.stackId), ['card0', 'card2', 'card3']);
    assert.deepStrictEqual(out.panels[1], { index: 1, groupId: null, error: { code: 'RUNTIME_ERROR', message: 'out of memory' } });
    assert.strictEqual(out.overview, true);
    assert.ok(!app.calls.some(c => c[0] === 'note' && c[1] === 'item1'));
});

test('a refused panel shrinks the stack it was expected in; the others still run', async () => {
    const app = fakeApp({ refuse: i => (i === 0 ? { code: 'REJECTED', message: 'no model' } : null) });
    const run = await runStoryboard(plan(3), { name: 'Heist' }, app.deps);
    assert.strictEqual(app.calls.find(c => c[0] === 'addStack')[1].expected, 2);
    app.finish(2, 1);
    const out = await run.finished;
    assert.deepStrictEqual(app.members(run.stackId), ['card1', 'card2']);
    assert.strictEqual(out.panels[0].error.code, 'REJECTED');
});

test('a stopped run is put in order but gets no overview', async () => {
    const app = fakeApp({ outcome: i => (i >= 2 ? { code: 'CANCELLED', message: 'The user pressed Stop.' } : null) });
    const run = await runStoryboard(plan(4), { name: 'Heist' }, app.deps);
    app.finish(1, 2, 0, 3);
    const out = await run.finished;
    assert.deepStrictEqual(app.members(run.stackId), ['card0', 'card1']);
    assert.strictEqual(out.cancelled, true);
    assert.strictEqual(out.overview, false);
    assert.ok(!app.calls.some(c => c[0] === 'overview'));
});

test('one card is no sheet; a panel with no intent gets no note', async () => {
    const app = fakeApp({ outcome: i => (i > 0 ? { code: 'RUNTIME_ERROR', message: 'x' } : null) });
    const panels = plan(3);
    delete panels[0].intent;
    const run = await runStoryboard(panels, { name: 'Heist' }, app.deps);
    app.finish(0, 1, 2);
    const out = await run.finished;
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.overview, false);
    assert.ok(!app.calls.some(c => c[0] === 'note' || c[0] === 'overview' || c[0] === 'reorder'));
});

test('the plan parses from the enhancer\'s one flattened line and from hand-edited lines alike', () => {
    const flat = '[PANEL 1] Picture: A wide photograph of a diner at night. Intent: We meet the place. [PANEL 2] Picture: The waitress pours coffee. Intent: She notices the stranger.';
    const want = [
        { prompt: 'A wide photograph of a diner at night.', intent: 'We meet the place.' },
        { prompt: 'The waitress pours coffee.', intent: 'She notices the stranger.' },
    ];
    assert.deepStrictEqual(parseStoryboardPlan(flat), want);
    assert.deepStrictEqual(parseStoryboardPlan(flat.replace(/ \[/g, '\n\n[').replace(/ Intent/g, '\nIntent')), want);
});

// MPI-1305: Fabio's movie-set board, as the old enhancer glued it ("trailersDirector's Station").
const GLUED = "Storyboard plan:[CAST]Vinyl: a small pink robot from image 1Lingo: a pixel art robot from image 2[PLACES]Movie Set: the outdoor filming area with crew trailersDirector's Station: the shaded spot with a monitor[OBJECTS]Clapperboard: a cue stick with a hinged top[PANEL 1]Picture: 2D cartoon film still, a wide shot at Movie Set. Vinyl holds the Clapperboard. Intent: The shoot begins.[PANEL 2]Picture: 2D cartoon film still, Lingo at Movie Set. Intent: He types.";

test('the planner\'s answer becomes a Markdown plan that parses exactly as the bracket form did', () => {
    const md = storyboardPlanMarkdown(GLUED);
    assert.match(md, /^# Storyboard plan\n\n## Cast\n\n- \*\*Vinyl\*\*: a small pink robot from image 1\n- \*\*Lingo\*\*: a pixel art robot from image 2\n\n## Places\n/);
    assert.match(md, /\n## Objects\n\n- \*\*Clapperboard\*\*: a cue stick with a hinged top\n/);
    assert.match(md, /\n## Panel 2\n\n\*\*Picture:\*\* 2D cartoon film still, Lingo at Movie Set\.\n\n\*\*Intent:\*\* He types\.$/);
    for (const plan of [GLUED, CAST_PLAN]) {
        const m = storyboardPlanMarkdown(plan);
        assert.deepStrictEqual(parseStoryboardPlan(m), parseStoryboardPlan(plan));
        assert.deepStrictEqual(recurringActors(m), recurringActors(plan));
        assert.deepStrictEqual(panelsWithDrawn(m, '', [{ name: 'Lena', kind: 'character' }], [1]), panelsWithDrawn(plan, '', [{ name: 'Lena', kind: 'character' }], [1]));
        assert.strictEqual(storyboardPlanMarkdown(m), m, 'converting twice changes nothing');
    }
    assert.strictEqual(storyboardPlanMarkdown('Sorry, I cannot plan that.'), 'Sorry, I cannot plan that.', 'an answer with no panel is left as it came');
});

test('an answer that keeps its newlines splits every name, where the glued one lost them', () => {
    const lines = GLUED.replace(/(\d|trailers|top)(?=[A-Z[])/g, '$1\n').replace(/\[/g, '\n[');
    const names = recurringActors(lines).map(a => a.name);
    assert.ok(lines.includes("trailers\nDirector's Station"));
    assert.deepStrictEqual(storyboardPlanMarkdown(lines).match(/^- \*\*[^*]+\*\*/gm),
        ['- **Vinyl**', '- **Lingo**', '- **Movie Set**', "- **Director's Station**", '- **Clapperboard**']);
    assert.ok(names.includes('Movie Set'), names.join());
});

test('a block with no Intent keeps its words as the prompt; text before the first marker and empty blocks are dropped', () => {
    assert.deepStrictEqual(parseStoryboardPlan('Here is your plan: [panel 1] A fox in snow. [PANEL 2] Picture: Intent: nothing to draw'), [
        { prompt: 'A fox in snow.', intent: '' },
    ]);
    assert.deepStrictEqual(parseStoryboardPlan('just an idea, never enhanced'), []);
    assert.deepStrictEqual(parseStoryboardPlan(undefined), []);
});

// The planner's real v2 shape (Phase 0 bench, diner board): the cast once, then panels by name.
const CAST_PLAN = '[CAST]  Lena: A young woman, 20s, with dark brown hair. Wears a black waitress uniform.  Stranger: Male, late 30s, in a worn leather jacket. [PANEL 1] Picture: Wide shot, Lena wipes the counter as the Stranger walks in. Intent: He arrives. [PANEL 2] Picture: Close-up of lena alone. Intent: She wonders. [PANEL 3] Picture: An empty diner at dawn. Intent: The end.';

test('every panel carries the cast line of each cast name it mentions, and only those', () => {
    const [p1, p2, p3] = parseStoryboardPlan(CAST_PLAN);
    assert.strictEqual(p1.prompt, 'Wide shot, Lena wipes the counter as the Stranger walks in. Lena is a young woman, 20s, with dark brown hair. Wears a black waitress uniform. Stranger is male, late 30s, in a worn leather jacket.');
    assert.strictEqual(p2.prompt, 'Close-up of lena alone. Lena is a young woman, 20s, with dark brown hair. Wears a black waitress uniform.');
    assert.strictEqual(p3.prompt, 'An empty diner at dawn.');
    assert.strictEqual(p1.intent, 'He arrives.');
});

test('cast lines glued by the enhancer\'s newline strip still split, and a longer name is found by one of its words', () => {
    // Verbatim shape of the shipped prompt's bench run (kite board, 2026-10-25).
    const plan = '[CAST]  Leo: 10-year-old boy, short brown hair. He runs barefoot.Grandpa Finn: 65-year-old man, navy wool jacket.Red Kite: A large red diamond-shaped kite. [PANEL 1] Picture: Grandpa holds the kite while Leo watches. Intent: x [PANEL 2] Picture: A red sky. Intent: y';
    const [p1, p2] = parseStoryboardPlan(plan);
    assert.strictEqual(p1.prompt, 'Grandpa holds the kite while Leo watches. Leo is 10-year-old boy, short brown hair. He runs barefoot. Grandpa Finn is 65-year-old man, navy wool jacket.');
    assert.strictEqual(p2.prompt, 'A red sky.', 'a lower-case "red" is not the Red Kite');
});

test('a cast name glued to the image number before it keeps its first word', () => {
    // Fabio's volcano board (Qwen-Image 2.1, 2026-10-25) drew "...from image 1The. Tiger is ...".
    const plan = '[CAST] The Cat: a wrinkled grey hairless cat from image 1The Tiger: a white tiger from image 2 [PANEL 1] Picture: The Cat faces The Tiger. Intent: x';
    assert.strictEqual(parseStoryboardPlan(plan)[0].prompt,
        'The Cat faces The Tiger. The Cat is a wrinkled grey hairless cat from image 1. The Tiger is a white tiger from image 2.');
});

test('the plan\'s cast line wins; the user\'s "Picture N is NAME, a WHAT." fills a pictured name the plan lacks', () => {
    // The planner's line carries the picture's description and the user's own edits (MPI-1231,
    // every picture described before planning), so it is the one every panel gets.
    const plan = '[CAST] Bix: a hairless grey cat with large ears from image 1. Lilo: a purple fox in a red scarf. [PANEL 1] Picture: Bix and Lilo sneak past the diner. Intent: x';
    const idea = 'Picture 1 is Bix, a grumpy hairless cat. Picture 2 is the diner. They sneak around.';
    assert.strictEqual(parseStoryboardPlan(plan, idea)[0].prompt,
        'Bix and Lilo sneak past the diner. Bix is a hairless grey cat with large ears from image 1. diner is the diner from the second image. Lilo is a purple fox in a red scarf.');
    // "The Sphinx" in a note is the planner's "Sphinx": one line, the plan's (Fabio's board, 2026-10-25).
    const sphinx = parseStoryboardPlan('[CAST] Sphinx: a hairless grey cat with wrinkled skin from image 1. [PANEL 1] Picture: The Sphinx bars the path. Intent: x',
        'Picture 1 is The Sphinx, the bad guy.');
    assert.strictEqual(sphinx[0].prompt, 'The Sphinx bars the path. Sphinx is a hairless grey cat with wrinkled skin from image 1.');
    // No cast block at all still gets the pictured names.
    assert.strictEqual(parseStoryboardPlan('[PANEL 1] Bix naps.', idea)[0].prompt, 'Bix naps. Bix is the grumpy hairless cat from the first image.');
});

test('an unpictured cast member or place two panels name recurs, characters first; a pictured one or a one-panel one does not', () => {
    // Fabio, 2026-10-25: a dragon in words alone is a different dragon in every panel, and a
    // ledge a different ledge. The Cave is named by two panels, and comes after both characters.
    const plan = '[CAST] Bix: a hairless grey cat from image 1. Dragon: a huge red dragon with gold horns. Red Truck: a battered red pickup truck. Owl: a small brown owl. [PLACES] Cave: a dark cave mouth. Hill: a grassy hill. [PANEL 1] Picture: Bix and the Dragon at the Cave. Intent: a [PANEL 2] Picture: The Dragon chases the Red Truck past the Cave. Intent: b [PANEL 3] Picture: Bix hides in the Red Truck on the Hill as the Owl watches. Intent: c [PANEL 4] Picture: The Dragon lands. Intent: d';
    assert.deepStrictEqual(recurringActors(plan), [
        { name: 'Dragon', desc: 'a huge red dragon with gold horns', kind: 'character' },
        { name: 'Red Truck', desc: 'a battered red pickup truck', kind: 'character' },
        { name: 'Cave', desc: 'a dark cave mouth', kind: 'place' },
    ]);
    // A name from the user's own note is pictured even when the plan's line lacks "from image".
    assert.deepStrictEqual(recurringActors(plan.replace(' from image 1', ''), 'Picture 1 is Bix, the cat.').map(a => a.name), ['Dragon', 'Red Truck', 'Cave']);
    // A drawn picture's number replaces the actor's and the place's description.
    const [p1] = parseStoryboardPlan(plan, '', { dragon: 2, cave: 3 });
    assert.strictEqual(p1.prompt, 'Bix and the Dragon at the Cave. Bix is a hairless grey cat from image 1. Dragon is the character from image 2. Cave is the place from image 3.');
});

test('objects come after characters and places, whatever their count; an [OBJECTS] line reaches the panels', () => {
    // Fabio's bat-cave board drew seven pictures first; only MAX_DRAWN_FIRST are, so the order
    // decides what is left in words: characters, then places, then objects.
    const plan = '[CAST] Squirrel: a red squirrel in a green cape. [PLACES] Bat Cave: a vast dark cave. [OBJECTS] Gold Helmet: a dented gold helmet with a red plume. [PANEL 1] Picture: The Gold Helmet lies in the Bat Cave. Intent: a [PANEL 2] Picture: Squirrel lifts the Gold Helmet in the Bat Cave. Intent: b [PANEL 3] Picture: Squirrel wears the Gold Helmet. Intent: c';
    assert.deepStrictEqual(recurringActors(plan).map(a => [a.name, a.kind]), [['Squirrel', 'character'], ['Bat Cave', 'place'], ['Gold Helmet', 'object']]);
    assert.strictEqual(parseStoryboardPlan(plan, '', { 'gold helmet': 3 })[0].prompt,
        'The Gold Helmet lies in the Bat Cave. Bat Cave is a vast dark cave. Gold Helmet is the object from image 3.');
    assert.strictEqual(MAX_DRAWN_FIRST, 4);
});

test('a name inside another name is no mention of it, and a name may hold "the"', () => {
    // The bat-cave re-plan (2026-10-25, research/crowd-cap/out.json), flattened as the app does:
    // "Cliff Over the River" read as "River", and "Bat Cave Interior" / "Gold Helmet" counted as
    // mentions of "Bat Cave Entrance" / "Gold Elephant" by their shared word.
    const plan = 'Storyboard plan:[CAST]Squirrel: A young squirrel.[PLACES]Bat Cave Entrance: A dark cave mouth.Bat Cave Interior: Deep, pitch-black cavern with stalactites.Cliff Over the River: A rocky cliff edge.River: A fast blue river.[OBJECTS]Gold Helmet: A gold helmet.Gold Elephant: A gold elephant figurine.'
        + '[PANEL 1]Picture: Squirrel at Bat Cave Entrance. Intent: a[PANEL 2]Picture: Squirrel inside Bat Cave Interior grabs the Gold Helmet. Intent: b'
        + '[PANEL 3]Picture: Squirrel in Bat Cave Interior wears the Gold Helmet. Intent: c[PANEL 4]Picture: Squirrel leaps off Cliff Over the River toward the River below. Intent: d'
        + '[PANEL 5]Picture: Squirrel in the River holds the Gold Elephant. Intent: e';
    assert.deepStrictEqual(recurringActors(plan).map(a => a.name), ['Squirrel', 'Bat Cave Interior', 'River', 'Gold Helmet']);
    const panels = parseStoryboardPlan(plan);
    assert.strictEqual(panels[1].prompt, 'Squirrel inside Bat Cave Interior grabs the Gold Helmet. Squirrel is a young squirrel. Bat Cave Interior is deep, pitch-black cavern with stalactites. Gold Helmet is a gold helmet.');
    assert.strictEqual(panels[3].prompt, 'Squirrel leaps off Cliff Over the River toward the River below. Squirrel is a young squirrel. Cliff Over the River is a rocky cliff edge. River is a fast blue river.');
    // The short-name fallback still works when no other name holds the word.
    assert.match(parseStoryboardPlan('[CAST] Grandpa Finn: an old man. [PANEL 1] Grandpa holds the kite.')[0].prompt, /Grandpa Finn is an old man\./);
});

test('a drawn picture rides only the panels that name it, numbered per panel', () => {
    // Fabio, 2026-10-26: the bat-cave board fed the cave picture to the river panels too.
    const plan = '[CAST] Squirrel: a young squirrel. [PLACES] Bat Cave Entrance: a dark cave mouth. Bat Cave Interior: a pitch-black cavern. River: a fast blue river. [OBJECTS] Gold Helmet: a gold helmet.'
        + ' [PANEL 1] Picture: Squirrel at Bat Cave Entrance. Intent: a [PANEL 2] Picture: Squirrel in Bat Cave Interior grabs the Gold Helmet. Intent: b'
        + ' [PANEL 3] Picture: Squirrel in the River wears the Gold Helmet. Intent: c';
    const drawn = [{ name: 'Squirrel', kind: 'character' }, { name: 'Bat Cave Interior', kind: 'place' }, { name: 'River', kind: 'place' }, { name: 'Gold Helmet', kind: 'object' }];
    // One picture of the user's that no name owns comes first in every panel, so the drawn ones start at image 2.
    const [p1, p2, p3] = panelsWithDrawn(plan, '', drawn, [1]);
    // "Bat Cave Entrance" is no mention of "Bat Cave Interior": no place picture at all, and no helmet.
    assert.deepStrictEqual([p1.pictures, p1.drawn], [[0], [0]]);
    assert.strictEqual(p1.prompt, 'Squirrel at Bat Cave Entrance. Squirrel is the character from image 2. Bat Cave Entrance is a dark cave mouth.');
    assert.deepStrictEqual(p2.drawn, [0, 1, 3]);
    assert.strictEqual(p2.prompt, 'Squirrel in Bat Cave Interior grabs the Gold Helmet. Squirrel is the character from image 2. Bat Cave Interior is the place from image 3. Gold Helmet is the object from image 4.');
    // Without the cave, the river is image 3 and the helmet one lower.
    assert.deepStrictEqual(p3.drawn, [0, 2, 3]);
    assert.strictEqual(p3.prompt, 'Squirrel in the River wears the Gold Helmet. Squirrel is the character from image 2. River is the place from image 3. Gold Helmet is the object from image 4.');
    assert.deepStrictEqual([p1.intent, p2.intent, p3.intent], ['a', 'b', 'c']);
    // Nothing drawn and no picture: the panels read as parseStoryboardPlan's, with no picks.
    assert.deepStrictEqual(panelsWithDrawn(plan, '', [], []).map(({ pictures: u, drawn: d, ...p }) => [u, d, p]), parseStoryboardPlan(plan).map(p => [[], [], p]));
});

test('a panel gets only the pictures it names, the user\'s and the drawn ones, numbered per panel', () => {
    // Fabio's movie-set board (2026-10-27): five robot pictures and three drawn objects rode
    // every panel, and the robots came back merged and duplicated.
    const plan = '[CAST] Bolt: a silver robot with round eyes from image 1. Rusty: a rusty robot from image 3. Dragon: a red dragon. [PLACES] Set: a film set. [OBJECTS] Camera: a big camera.'
        + ' [PANEL 1] Picture: Bolt films Rusty with the Camera. Intent: a [PANEL 2] Picture: Rusty alone on the Set. Intent: b [PANEL 3] Picture: The Dragon roars. Intent: c';
    // Picture 2 is Spark (the note), named by no panel; picture 4 names nobody, so it rides every panel.
    const idea = 'Picture 2 is Spark, a tiny robot.';
    const drawn = [{ name: 'Dragon', kind: 'character' }, { name: 'Camera', kind: 'object' }];
    const [p1, p2, p3] = panelsWithDrawn(plan, idea, drawn, [1, 2, 3, 4]);
    assert.deepStrictEqual([p1.pictures, p1.drawn], [[0, 2, 3], [1]]);
    assert.strictEqual(p1.prompt, 'Bolt films Rusty with the Camera. Bolt is the character from image 1. Rusty is the character from image 2. Camera is the object from image 4.');
    assert.deepStrictEqual([p2.pictures, p2.drawn], [[2, 3], []]);
    assert.strictEqual(p2.prompt, 'Rusty alone on the Set. Rusty is the character from image 1. Set is a film set.');
    assert.deepStrictEqual([p3.pictures, p3.drawn], [[3], [0]]);
    assert.strictEqual(p3.prompt, 'The Dragon roars. Dragon is the character from image 2.');
    // A note's picture number is its slot: with slot 2 empty, "Picture 3" is the second reference.
    assert.deepStrictEqual(panelsWithDrawn('[PANEL 1] Picture: Rusty waves.', 'Picture 1 is Bolt, a robot. Picture 3 is Rusty, a rusty robot.', [], [1, 3])[0].pictures, [1]);
});

test('a panel naming three or more characters says how many and who, so none is dropped', () => {
    // Fabio's robot crew (2026-10-27): "Cosmo, Reel and Vinyl cheer as Prism lifts the Golden
    // Clapperboard high" drew three robots in 8 of 8 FLUX.3 Klein runs, whatever the order, the
    // prop or the action; with the headcount line, four in 6 of 6.
    const plan = '[CAST] Vinyl: a robot. Cosmo: a robot. Reel: a robot. Prism: a robot. [PLACES] Set: a film set. [OBJECTS] Golden Clapperboard: a gold clapperboard.'
        + ' [PANEL 1] Picture: Cosmo, Reel and Vinyl cheer as Prism lifts the Golden Clapperboard high. Intent: a'
        + ' [PANEL 2] Picture: Vinyl and Reel on the Set. Intent: b [PANEL 3] Picture: Cosmo, Reel and Vinyl wave. Intent: c';
    const [p1, p2, p3] = panelsWithDrawn(plan, '', [], []);
    assert.match(p1.prompt, / Four characters are in the picture, each one whole and clearly visible: Vinyl, Cosmo, Reel and Prism\.$/);
    // Places and objects are not counted, and two characters need no headcount.
    assert.doesNotMatch(p2.prompt, /characters are in the picture/);
    assert.match(p3.prompt, / Three characters are in the picture, each one whole and clearly visible: Vinyl, Cosmo and Reel\.$/);
    assert.strictEqual(parseStoryboardPlan(plan)[0].prompt, p1.prompt);
});

test('a pictured cast member gets no description; one whose picture is gone loses its stale number', () => {
    // Fabio, 2026-10-27: the description fights the picture and the model changes the character.
    // The user's own note is the binding; the planner's looks are not sent beside the picture.
    const plan = '[CAST] Bix: a hairless grey cat with large green ears from image 1. Lilo: a purple fox from image 2. [PANEL 1] Picture: Bix and Lilo nap. Intent: a [PANEL 2] Picture: A red sky. Intent: b';
    const [p1, p2] = panelsWithDrawn(plan, 'Picture 1 is Bix, a grumpy hairless cat.', [], [1]);
    assert.strictEqual(p1.prompt, 'Bix and Lilo nap. Bix is the grumpy hairless cat from image 1. Lilo is a purple fox.');
    assert.deepStrictEqual(p1.pictures, [0]);
    // A panel naming nobody pictured gets no reference: it is drawn from its words (t2i).
    assert.deepStrictEqual([p2.prompt, p2.pictures, p2.drawn], ['A red sky.', [], []]);
});

test('the planner is told how the picked panel model reads a picture prompt, from that model\'s own recipe', async () => {
    // Fabio, 2026-10-27: the planner (Cosmo's model) writes every Picture, so it gets the panel
    // model's prompting guide, as the Enhancer does for that model.
    const { withModelGuide } = await esm('js/services/flowEnhance.js');
    const { getFlowById } = await esm('js/data/flowsRegistry.js');
    const d = getFlowById('storyboard').steps[0].fields.find(f => f.id === 'enhance');
    const sys = id => withModelGuide(d.injectionParams, id).Input_System_Prompt;
    for (const [id, name, first] of [['flux3-klein', 'FLUX.3 Klein', 'Medium and style first'], ['qwen-image-2-1', 'Qwen-Image 2.1', 'Opening sentence: medium']]) {
        const s = sys(id);
        assert.match(s, new RegExp(`The panel model is ${name.replace('.', '\\.')}\\.`));
        assert.ok(s.includes(`- ${first}`), `${id}: its recipe's structure`);
        assert.ok(s.indexOf('The panel model is') < s.lastIndexOf('<|im_end|>'), `${id}: inside the system turn`);
        assert.doesNotMatch(s, /\{\{modelGuide\}\}/);
    }
    // A model with no recipe gets the planner's own rules only; a declaration with no marker is untouched.
    assert.doesNotMatch(sys('no-such-model'), /The panel model is|\{\{modelGuide\}\}/);
    const plain = { Input_System_Prompt: 'rewrite this' };
    assert.strictEqual(withModelGuide(plain, 'flux3-klein'), plain);
});

test('the panels\' shared opening is the style a picture drawn before them takes', () => {
    const p = s => ({ prompt: s });
    assert.strictEqual(panelStyle([p('3D-animated cartoon film still, wide shot, the Cave'), p('3D-animated cartoon film still, close-up, Bix')]), '3D-animated cartoon film still');
    // Openings that differ, one panel, or a plan that opens on a sentence give none.
    assert.strictEqual(panelStyle([p('Photo, wide'), p('Watercolour, close')]), '');
    assert.strictEqual(panelStyle([p('3D-animated cartoon film still, wide')]), '');
    assert.strictEqual(panelStyle([p('Bix naps. Then, he wakes'), p('Bix naps. Then, he eats')]), '');
});

test('a cast run with sheet off makes no overview, and every landed row carries its item', async () => {
    const app = fakeApp();
    const run = await runStoryboard(plan(2), { name: 'C', sheet: false }, app.deps);
    app.finish(0, 1);
    const out = await run.finished;
    assert.strictEqual(out.overview, false);
    assert.ok(!app.calls.some(c => c[0] === 'overview'));
    assert.deepStrictEqual(out.panels.map(r => r.item.filePath), ['C:/p/0.png', 'C:/p/1.png']);
});

test('nothing runs and no stack is made when every panel is refused, or Loop is armed, or a panel is blank', async () => {
    const all = fakeApp({ refuse: () => ({ code: 'REJECTED', message: 'Vision rejected the step.' }) });
    assert.deepStrictEqual(await runStoryboard(plan(2), { name: 'H' }, all.deps),
        { ok: false, code: 'REJECTED', message: 'Nothing was drawn: panel 1 was refused. Vision rejected the step.' });
    assert.ok(!all.calls.some(c => c[0] === 'addStack'));

    const loop = fakeApp({ loop: true });
    assert.strictEqual((await runStoryboard(plan(2), { name: 'H' }, loop.deps)).code, 'LOOP_ARMED');
    assert.deepStrictEqual(loop.calls, []);

    const blank = fakeApp();
    const panels = plan(3);
    panels[2].prompt = '  ';
    assert.deepStrictEqual(await runStoryboard(panels, { name: 'H' }, blank.deps),
        { ok: false, code: 'EMPTY_PANEL', message: 'Nothing was drawn: panel 3 has no picture prompt.' });
    assert.strictEqual((await runStoryboard([], { name: 'H' }, blank.deps)).code, 'NO_PANELS');
    assert.deepStrictEqual(blank.calls, []);
});
