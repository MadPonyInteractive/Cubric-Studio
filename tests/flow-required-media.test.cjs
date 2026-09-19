/**
 * flow-required-media.test.cjs — MPI-607.
 *
 * THE PAIR THAT MAKES A RUN VANISH. An `MpiLoad*` node with `block_if_empty: true`
 * returns an `ExecutionBlocker` when its path is empty: the graph produces zero output
 * and ComfyUI reports **success**. Nothing in the flow UI stops a user reaching that —
 * every media slot renders as optional, because `upto` is the only media mode there is.
 *
 * What stands in the way is `required` on the op's media slot. `_findMissingMediaSlot`
 * (js/services/generationService.js) reads it at enqueue AND again at dispatch, and
 * raises "Add an image/video/audio file before generating". A slot declaring
 * `required: false` opts OUT of that guard — and an ABSENT `required` already means
 * required, so `false` is never accidental, it is always a deliberate opt-out.
 *
 * Nine of the twelve shipped flows had opted out of a guard their graph depended on
 * (2026-08-28). This test is the sweep, frozen: every flow, every slot, every graph.
 *
 * IT IS DELIBERATELY NOT "every slot must be required". DramaBox is the counter-example
 * the law has to allow: its voice slot is legitimately optional, so the law is the PAIR —
 * a slot the graph BLOCKS on must not opt out of the guard.
 *
 * 🔴 WHY DramaBox IS EXEMPT, stated correctly (a claim audit caught this stated wrong
 * on 2026-08-28, in this file and in commit b39ebe06's message). It is NOT that its
 * loader carries `block_if_empty: false` — `Input_Audio` (`MpiLoadAudioUpload#11`)
 * carries **true**, same as everyone else. It is exempt because of LAZINESS: the
 * loader's `loaded` output (never blocked, MPI-800) drives `MpiIfElse#15` between two
 * samplers — #9 takes a `voice_ref`, #10 does not. Empty slot -> `loaded` false -> #10,
 * which never requests the blocked audio output. The flag is real and simply unreachable.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const esm = p => import('file://' + repo(p).replace(/\\/g, '/'));

/**
 * Is the node the app INJECTS INTO itself a blocking loader, or does it feed one
 * directly?
 *
 * The flag sits on the LOADER, which is not always the node carrying the title — a
 * role can arrive as an `MpiString` path that a loader one hop downstream consumes
 * (`Input_Audio_2` did exactly that until the VC arm was stripped). So: check the
 * titled node, then its direct consumers.
 *
 * 🔴 IT MODELS ONE FORK ONLY, and must not be read as "the run will block".
 * `MpiIfElse` declares its arms lazy, so a loader whose own `loaded` output picks the
 * arm never has its blocked media requested on the empty route (DramaBox; the case
 * below pins it by its real mechanism). That one shape is recognised here; anything
 * subtler is not. One hop is deliberate: it is the distance between an injected path
 * and the loader that reads it. Going deeper would start crossing forks and answering
 * a different, much harder question.
 */
const LOADED_SLOT = { MpiLoadImage: 4, MpiLoadVideoUpload: 8, MpiLoadAudioUpload: 1 };
const forksOnLoaded = (graph, id, node) => Object.values(graph).some((n) =>
    n.class_type === 'MpiIfElse' && Array.isArray(n.inputs?.boolean)
    && String(n.inputs.boolean[0]) === id && n.inputs.boolean[1] === LOADED_SLOT[node.class_type]);

function blocksWhenEmpty(graph, title) {
    const entry = Object.entries(graph).find(
        ([, n]) => (n._meta?.title || '').toLowerCase() === String(title).toLowerCase());
    if (!entry) return false;                       // no such node — nothing to block
    const [id, node] = entry;
    if (forksOnLoaded(graph, id, node)) return false;
    if (typeof node.inputs?.block_if_empty === 'boolean') return node.inputs.block_if_empty;

    for (const consumer of Object.values(graph)) {
        const feeds = Object.values(consumer.inputs || {})
            .some(v => Array.isArray(v) && String(v[0]) === id);
        if (feeds && typeof consumer.inputs?.block_if_empty === 'boolean') {
            return consumer.inputs.block_if_empty;
        }
    }
    return false;
}

test('no flow can dispatch a run its own graph will silently block', async () => {
    const flowsMod = await esm('js/data/flowsRegistry.js');
    const cmdMod = await esm('js/data/commandRegistry.js');
    const FLOWS = flowsMod.FLOWS || flowsMod.flows || flowsMod.default;
    const COMMANDS = cmdMod.COMMANDS || cmdMod.commands || cmdMod.default;

    const holes = [];
    let checked = 0;

    for (const flow of FLOWS) {
        if (!flow.workflow) continue;
        const file = repo(path.join('comfy_workflows', flow.workflow));
        if (!fs.existsSync(file)) continue;         // a flow whose graph is not baked yet
        const graph = JSON.parse(fs.readFileSync(file, 'utf8'));

        for (const slot of (COMMANDS[flow.operation]?.mediaInputs || [])) {
            if (!blocksWhenEmpty(graph, slot.title)) continue;
            checked++;
            if (slot.required === false) {
                holes.push(`${flow.id}.${slot.key} (${flow.operation}, ${slot.title})`);
            }
        }
    }

    // Guards the guard: if the walk ever stops finding blocking slots — a renamed
    // flag, a moved workflow directory — this test would pass by checking nothing.
    assert.ok(checked >= 10,
        `only ${checked} blocking slots found; the block_if_empty walk has drifted`);

    assert.deepStrictEqual(holes, [],
        'these slots block the graph when empty but declare `required: false`, which opts '
        + 'out of the missing-media toast — the run then reports success and produces '
        + 'nothing:\n  ' + holes.join('\n  '));
});

// DramaBox was the counter-example that kept the law above honest: a slot may declare
// `required: false` ONLY when the graph genuinely forks on it, so an empty slot takes a
// real second route rather than blocking. It left the app as a Flow package (MPI-781),
// taking its graph, so that assertion moved with it —
// c:\AI\Mpi\Cubric-Flows/checks.test.cjs, "the voice stays optional, and the FORK is what
// makes it so".
//
// NOTHING SHIPPED IN THIS APP NOW EXERCISES THE EXEMPTION: every remaining flow's media
// slots are required. The sweep above is therefore currently a one-sided law — it can
// only catch a slot that declares `required: false` without a fork, never a fork wrongly
// marked required. Restore a counter-example here the moment a shipped flow has one.
