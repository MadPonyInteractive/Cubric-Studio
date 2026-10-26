'use strict';

// projectService's settings queues (tool / model / shared) are written into
// `state.currentProject` when their 300 ms debounce fires. Before this, a queue still
// pending across a project switch landed in the project opened NEXT, and one that
// fired with no project open kept its edits and carried them into the next project.
// Each queue is now pinned to the project it was filled for, and
// flushPendingSettings() writes them before the open project changes.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const mod = (...p) => pathToFileURL(path.join(__dirname, '..', ...p)).href;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const WAIT = 900; // past the 300 ms queue debounce AND the 500 ms save debounce

const posts = [];
globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    if (String(url).includes('/update-project-settings')) posts.push(body);
    return { ok: true, json: async () => ({ success: true }) };
};

const project = (name) => ({
    id: name, name, folderPath: `/projects/${name}`, itemGroups: [],
    modelSettings: {}, toolSettings: {}, shared: { image: {}, video: {} },
});

let state, Events, flushPendingSettings, getPendingToolSettings;
test.before(async () => {
    ({ state } = await import(mod('js', 'state.js')));
    ({ Events } = await import(mod('js', 'events.js')));
    ({ flushPendingSettings, getPendingToolSettings } = await import(mod('js', 'services', 'projectService.js')));
});
test.beforeEach(() => { posts.length = 0; });

test('flushPendingSettings writes queued edits into the open project and saves it now', async () => {
    state.currentProject = project('a');
    Events.emit('settings:tool:update', { toolKey: 'crop', key: 'label', value: '16:9' });
    Events.emit('settings:shared:update', { mediaType: 'image', key: 'batch', value: 3 });
    Events.emit('settings:model:update', { modelId: 'm1', key: 'loras', value: ['x'] });
    await flushPendingSettings();
    assert.equal(posts.length, 1, 'one immediate save, not a debounced one');
    assert.equal(posts[0].folderPath, '/projects/a');
    assert.equal(posts[0].updates.toolSettings.crop.label, '16:9');
    assert.equal(posts[0].updates.shared.image.batch, 3);
    assert.deepEqual(posts[0].updates.modelSettings.m1.loras, ['x']);
    await sleep(WAIT);
    assert.equal(posts.length, 1, 'nothing left to fire after the flush');
});

test('a queue pending across a project switch is dropped, never written into the next project', async () => {
    state.currentProject = project('a');
    Events.emit('settings:tool:update', { toolKey: 'crop', key: 'label', value: 'from-a' });
    assert.equal(getPendingToolSettings('crop').label, 'from-a');
    // Switch without flushing — the path a future caller could take by mistake.
    state.currentProject = project('b');
    assert.deepEqual(getPendingToolSettings('crop'), {}, "project a's pending edit is not b's");
    await sleep(WAIT);
    assert.equal(state.currentProject.toolSettings.crop, undefined, "a's edit landed in b");
    assert.equal(posts.length, 0);
});

test('an edit queued with no project open does not ride into the next project', async () => {
    state.currentProject = null;
    Events.emit('settings:tool:update', { toolKey: 'resize', key: 'width', value: 111 });
    await sleep(WAIT);
    state.currentProject = project('c');
    Events.emit('settings:tool:update', { toolKey: 'resize', key: 'height', value: 222 });
    await sleep(WAIT);
    assert.equal(state.currentProject.toolSettings.resize.height, 222);
    assert.notEqual(state.currentProject.toolSettings.resize.width, 111, 'a stale edit from no project rode along');
    assert.equal(posts.length, 1);
    assert.equal(posts[0].folderPath, '/projects/c');
});

test('the debounced path still saves into the project the edit was made in', async () => {
    state.currentProject = project('d');
    Events.emit('settings:tool:update', { toolKey: 'crop', key: 'divisible_by', value: 8 });
    await sleep(WAIT);
    assert.equal(state.currentProject.toolSettings.crop.divisible_by, 8);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].folderPath, '/projects/d');
});

test('openProject and deleteProject flush before the open project changes', () => {
    // Both reach the server before they swap state.currentProject, so a behavioural
    // test needs the whole open path; the order is what matters, so pin the order.
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'services', 'projectService.js'), 'utf8');
    const open = src.slice(src.indexOf('export async function openProject('));
    assert.ok(open.indexOf('await flushPendingSettings()') !== -1
        && open.indexOf('await flushPendingSettings()') < open.indexOf('await fetch('),
        'openProject must flush before its first request');
    const del = src.slice(src.indexOf('export async function deleteProject('));
    assert.ok(del.indexOf('await flushPendingSettings()') !== -1
        && del.indexOf('await flushPendingSettings()') < del.indexOf('state.currentProject = null'),
        'deleteProject must flush before it clears the project');
});

// ── The panel side (AUDIT B2) ───────────────────────────────────────────────
// Eight MpiToolOptions* panels debounced their writes and CLEARED the timers in
// destroy, so a setting changed just before the tool closed was lost.

test('a panel closed inside its debounce still saves the last edit, and a reopened one reads it', async () => {
    const { toolSettingsWriter, readToolSettings } = await import(mod('js', 'services', 'toolSettings.js'));
    state.currentProject = project('e');
    const writer = toolSettingsWriter('crop', { delayMs: 200 });
    writer.persist('label', '4:5');
    writer.dispose(); // the rail switched before 200 ms
    // Reopened straight away: the write is still in projectService's queue.
    assert.equal(readToolSettings('crop', { label: '1:1' }).label, '4:5');
    await sleep(WAIT);
    assert.equal(state.currentProject.toolSettings.crop.label, '4:5');
    assert.equal(posts.length, 1);
});

test('dispose sends each key once, only what is still waiting', async () => {
    const { toolSettingsWriter } = await import(mod('js', 'services', 'toolSettings.js'));
    state.currentProject = project('f');
    const sent = [];
    const off = Events.on('settings:tool:update', (e) => { if (e.toolKey === 'resize') sent.push([e.key, e.value]); });
    try {
        const writer = toolSettingsWriter('resize', { delayMs: 50 });
        writer.persist('width', 1);
        writer.persist('width', 2);
        await sleep(120);               // fired on its own
        writer.persist('height', 3);
        writer.dispose();               // still waiting: sent now
        writer.dispose();               // nothing left: sends nothing
        await sleep(120);
        assert.deepEqual(sent, [['width', 2], ['height', 3]]);
    } finally {
        off();
    }
});

test('a panel closed after the agent opened another project does not write into it', async () => {
    const { toolSettingsWriter } = await import(mod('js', 'services', 'toolSettings.js'));
    state.currentProject = project('g');
    const writer = toolSettingsWriter('crop', { delayMs: 200 });
    writer.persist('label', 'from-g');
    // agentDispatch opens the project first and only then navigates, which destroys the panel.
    state.currentProject = project('h');
    writer.dispose();
    await sleep(WAIT);
    assert.equal(state.currentProject.toolSettings.crop, undefined);
    assert.equal(posts.length, 0);
});
