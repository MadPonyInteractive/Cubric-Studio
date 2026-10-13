/**
 * flow-make-seamless.test.cjs — the Make seamless Flow's wiring (MPI-1101 Phases 2-3).
 *
 * Pins: the op in all four registries; the content line (the user's words, else the describer
 * asked ONCE of the whole picture and carried to every window); and that the planner refuses
 * rather than letting the Flow screen fall back to one pass on the whole picture.
 *
 * Run: node --test tests/flow-make-seamless.test.cjs
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const esm = p => import('file://' + repo(p).replace(/\\/g, '/'));

const SOURCE = { role: 'image1', mediaType: 'image', url: '/project-file?path=C%3A%2Fp%2FMedia%2Fpano.png' };

test('the op is registered in all four places, on the shipped graph', async () => {
    const { getFlowById } = await esm('js/data/flowsRegistry.js');
    const { getCommand } = await esm('js/data/commandRegistry.js');
    const flow = getFlowById('make-seamless');
    assert.ok(flow, 'the Flow is in a source (dev) run');
    const cmd = getCommand(flow.operation);
    assert.equal(cmd?.universal, true);
    assert.equal(cmd.pastesToWorkingCopy, true, 'each window pastes into the working copy');
    assert.ok(!cmd.cropsToMask, 'never cropsToMask: the window IS the cut');
    assert.deepEqual(cmd.mediaInputs.map(s => [s.key, s.title, s.required, !!s.planned]),
        [['image1', 'Input_Image', true, false], ['mask', 'Input_Mask', true, true]], 'the caller sends the picture; the planner adds the mask');
    const uw = fs.readFileSync(repo('js/data/modelConstants/universal_workflows.js'), 'utf8');
    assert.match(uw, /flowMakeSeamless: \{\s*workflow: 'flow_make_seamless\.json',/);
    assert.ok(fs.existsSync(repo(`comfy_workflows/${flow.workflow}`)));
    assert.match(fs.readFileSync(repo('js/core/operationRegistry.js'), 'utf8'), /flowMakeSeamless: \{ latestVersion: '1\.0'/);
    assert.equal(JSON.parse(fs.readFileSync(repo('operation_registry.json'), 'utf8')).flowMakeSeamless?.universal, true);
});

test('the content line: the describer is asked of the WHOLE picture only when the box is empty', async () => {
    const { getFlowById } = await esm('js/data/flowsRegistry.js');
    const { describeAsks } = await esm('js/services/flowEnhance.js');
    const flow = getFlowById('make-seamless');
    const media = [{ ...SOURCE, url: '/project-file?path=win_0.png' }, { role: 'mask', mediaType: 'image', url: 'm.png' },
        { ...SOURCE, role: 'source' }];
    assert.deepEqual(describeAsks(flow, {}, media).map(a => [a.to, a.media]), [['Input_Positive', 'source']]);
    assert.deepEqual(describeAsks(flow, { Input_Positive: 'a cobblestone street' }, media), [], 'typed words win');
    assert.deepEqual(describeAsks(flow, {}, media.slice(0, 2)), [], 'a later window carries no `source`');
});

test('every later window gets the answer pass 1 described', () => {
    const src = fs.readFileSync(repo('js/services/flowService.js'), 'utf8');
    // The describe runs on the first call only (`!_leg.tempId`); each pass re-submits with the
    // run's tempId, so `described` must ride along or windows 2..N run with an empty line.
    assert.match(src, /\.\.\.\(last \? \{\} : \{ runNextPass \}\) \}, callbacks, \{ tempId, run: handle, described \}, io\)\)/);
    assert.match(src, /injectionParams: \{ \.\.\.flowModelParams\(flow, \{ op: operation \}\), \.\.\.\(run\.injectionParams \|\| \{\}\), \.\.\.described,/);
});

// The mask is `planned`: an agent's run with only the picture was refused MEDIA_REQUIRED (Phase 4,
// first live run), and `required: false` instead would have hidden a missing mask at enqueue.
test('a caller sends only the picture: the planned mask is neither demanded nor listed', async () => {
    const { resolveAgentMedia } = await esm('js/data/generationControls.js');
    const res = resolveAgentMedia('flowMakeSeamless', null, [{ role: 'image1', url: SOURCE.url }]);
    assert.ok(!res.error && !res.code, JSON.stringify(res).slice(0, 200));
    const missing = resolveAgentMedia('flowMakeSeamless', null, []);
    assert.match(JSON.stringify(missing), /MEDIA_REQUIRED[\s\S]*image1/, 'the picture is still required');
    assert.match(fs.readFileSync(repo('routes/connector.js'), 'utf8'), /\.filter\(\(i\) => !i\.planned\)/);
});

// A one-window run (an 8K panorama's seam fits one cut) failed AFTER landing: both callers chained
// the plan's `next`, which had no second window, and the chain reported "could not start".
test('only a plan of two or more passes chains, on the Flow screen and the agent path', () => {
    const ui = fs.readFileSync(repo('js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js'), 'utf8');
    const agent = fs.readFileSync(repo('js/shell/agentDispatch.js'), 'utf8');
    assert.match(ui, /\.\.\.\(passes\?\.count > 1 \? \{ runNextPass: passes\.next \} : \{\}\),/);
    assert.match(agent, /\.\.\.\(genericPlan\?\.count > 1 \? \{ runNextPass: genericPlan\.next \} : \{\}\),/);
});

test('the planner refuses instead of returning nothing (no one-pass fallback on the whole picture)', async () => {
    const { getPlanner } = await esm('js/utils/flowPasses.js');
    const { getFlowById } = await esm('js/data/flowsRegistry.js');
    const flow = getFlowById('make-seamless');
    const planner = getPlanner(flow.operation);
    await assert.rejects(planner(flow, {}, [], { fetch: async () => ({ ok: true }) }),
        e => /needs a picture/.test(e.userMessage) && /Nothing was generated/.test(e.userMessage));
    await assert.rejects(planner(flow, {}, [SOURCE], { fetch: async () => ({ ok: false }) }),
        e => /could not prepare/.test(e.userMessage));
    const none = async () => ({ ok: true, json: async () => ({ ok: true, runId: 'r', windows: [] }) });
    await assert.rejects(planner(flow, {}, [SOURCE], { fetch: none }), e => /no edge to join/.test(e.userMessage));
});

test('the agent names the joins with `direction`; the Flow screen\'s gizmo value wins', async () => {
    const { getPlanner } = await esm('js/utils/flowPasses.js');
    const { getFlowById } = await esm('js/data/flowsRegistry.js');
    const flow = getFlowById('make-seamless');
    const sent = [];
    const fetch = async (url, opts) => {
        sent.push(JSON.parse(opts.body));
        if (url === '/seamless/prepare') return { ok: true, json: async () => ({ ok: true, runId: 'r', windows: [{}] }) };
        return { ok: true, json: async () => ({ ok: true, image: '/project-file?path=w.png', mask: '/project-file?path=m.png' }) };
    };
    await getPlanner(flow.operation)(flow, { direction: 'left-right', lightingFlatten: 0.5 }, [SOURCE], { fetch });
    assert.deepEqual(sent[0].handles, { left: 10, right: 10, top: 0, bottom: 0 });
    assert.equal(sent[0].lightingFlatten, 0.5);
    sent.length = 0;
    // The Flow screen's shape: the gizmo by role, its own fields merged in flat (MpiBaseFlow._planPasses).
    await getPlanner(flow.operation)(flow, { image1: { left: 0, right: 0, top: 20, bottom: 5 }, direction: 'both', lightingFlatten: 0.25 },
        [SOURCE], { fetch });
    assert.deepEqual(sent[0].handles, { left: 0, right: 0, top: 20, bottom: 5 });
    assert.equal(sent[0].lightingFlatten, 0.25);
});

test('the Edges step only picks the bands: Tiles is on the result, lighting with Generate (Fabio, 2026-10-13)', async () => {
    const { getFlowById } = await esm('js/data/flowsRegistry.js');
    const flow = getFlowById('make-seamless');
    const edges = flow.steps.find(s => s.kind === 'edges');
    assert.ok(!edges.fields?.length, 'no field on the Edges step: nothing there shows before the result lands');
    assert.equal(flow.result?.tiles, true, 'the result carries the Tiles slider');
    assert.ok(flow.fields.some(f => f.id === 'lightingFlatten'), 'Even out lighting is a Generate field');
    const frame = fs.readFileSync(repo('js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js'), 'utf8');
    assert.match(frame, /planner\(flow, \{ \.\.\._fieldValues, \.\.\._stepValues \}/, 'the Flow screen hands its own fields to the planner');
});
