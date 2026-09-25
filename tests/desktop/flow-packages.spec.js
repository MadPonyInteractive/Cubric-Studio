const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-532 — Flow packages in `<userData>/user_flows/` reach the real Flow Library.
 *
 * WHY THIS NEEDS A REAL APP. The unit test proves the scan, the validator, the install and
 * the registration against stubs; only a booted app proves the join: main.js hands the
 * profile to the server fork as APP_USER_DATA, shell boot awaits the scan before the first
 * sync, and the preview and graph are served under the `/comfy_workflows/` paths every
 * fetch site already uses — through express.static and workflowStatic, which both have to
 * pass the nested path on.
 */
test.setTimeout(90000);

const ROOT = path.join(__dirname, '..', '..');

/** Write one package into `dir`. */
function writePackage(dir, id, title, extra = {}) {
    const { MODELS } = require(path.join(ROOT, 'js/data/modelConstants/models.js'));
    const display = path.join(ROOT, 'comfy_workflows', 'display');
    const still = fs.readdirSync(display).find(f => f.endsWith('.webp'));
    const graph = {
        1: { class_type: 'MpiLoadImageFromPath', inputs: { string: '' }, _meta: { title: 'Input_Image' } },
        2: { class_type: 'SaveImage', inputs: { images: ['1', 0], filename_prefix: 'x' }, _meta: { title: 'Output_Image' } },
    };
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(display, still), path.join(dir, 'preview.webp'));
    fs.writeFileSync(path.join(dir, 'workflow.json'), JSON.stringify(graph));
    fs.writeFileSync(path.join(dir, 'flow.json'), JSON.stringify({
        schema: 'cubric/flow-package/v1', id, version: '1.0.0',
        flow: {
            title, description: 'Seeded by flow-packages.spec.js.', preview: 'preview.webp',
            requiredModels: [MODELS[0].id], mediaType: 'image', type: 'edit', ...extra,
        },
        op: {
            label: `Flow: ${title}`, mediaType: 'image',
            mediaInputs: [{ key: 'image1', mediaType: 'image', title: 'Input_Image', required: true }],
        },
    }));
}

// Two packages seeded before launch: one valid, one naming a dep no app has. The broken
// one must be LISTED, disabled, with its reason — silence reads as a broken app.
test('Flow packages load from user_flows, serve their files, and a broken one says why', async ({}, testInfo) => {
    const flowsDir = path.join(testInfo.outputPath('user-data'), 'user_flows');
    writePackage(path.join(flowsDir, 'spec-flow'), 'spec-flow', 'Spec Package');
    writePackage(path.join(flowsDir, 'spec-broken'), 'spec-broken', 'Spec Broken', { requiredDeps: ['no-such-dep'] });
    const { app, window, pageErrors, consoleErrors } = await launchApp(testInfo);

    try {
        await window.waitForTimeout(6000);

        const r = await window.evaluate(async () => {
            const { MpiFlowLibrary } = await import('/js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js');
            const { getFlowById, flowAvailability } = await import('/js/data/flowsRegistry.js');
            const { getFilePrefix } = await import('/js/data/commandRegistry.js');
            const { getUniversalWorkflow } = await import('/js/data/modelRegistry.js');

            const out = {};
            const ok = getFlowById('user:spec-flow');
            const off = getFlowById('user:spec-broken');
            out.registered = [!!ok, !!off];
            out.prefix = getFilePrefix('user:spec-flow');
            out.reason = flowAvailability(off).reason || null;

            // The graph through the exact URL commandExecutor builds.
            const wf = await fetch(`/comfy_workflows/${getUniversalWorkflow('user:spec-flow')}`);
            out.graphTitles = wf.ok ? Object.values(await wf.json()).map(n => n._meta.title) : wf.status;

            const lib = MpiFlowLibrary.mount(document.createElement('div'));
            window.__mpi532lib = lib;
            const root = lib.el;
            lib.el.open();
            const tile = (title) => [...root.querySelectorAll('.mpi-tile')].find(t => t.textContent.includes(title));
            out.okChip = tile('Spec Package')?.querySelector('.mpi-tile__chip')?.textContent || null;
            out.offChip = tile('Spec Broken')?.querySelector('.mpi-tile__chip')?.className || null;

            // The preview through the exact src the tile sheet builds. The thumb is
            // `loading="lazy"`, so it only fetches once it is near the viewport — and
            // since MPI-831 a package tile sits in the Third-party Flows section at the
            // BOTTOM of the library, measured ~2700px down against a 720px viewport.
            // Without the scroll the image never loads, `onload` never fires, and this
            // await hangs until the 90s test timeout rather than failing an assertion.
            const img = tile('Spec Package')?.querySelector('img');
            img?.scrollIntoView();
            if (img && !img.complete) await new Promise(res => { img.onload = img.onerror = res; });
            out.previewSrc = img?.getAttribute('src') || null;
            out.previewPixels = img?.naturalWidth || 0;

            tile('Spec Broken').click();
            await new Promise(res => setTimeout(res, 300));
            const panel = root.querySelector('#flow-detail-panel');
            out.drawerOpen = panel.classList.contains('is-open');
            out.drawerText = root.querySelector('#flow-detail-body').textContent.replace(/\s+/g, ' ').trim();
            out.drawerButtons = root.querySelectorAll('#flow-detail-actions .mpi-button, #flow-detail-actions button').length;
            return out;
        });

        expect(r.registered).toEqual([true, true]);
        expect(r.prefix).toBe('flowSpecPackage');
        expect(r.reason).toContain('Needs dependency "no-such-dep"');
        expect(r.graphTitles).toEqual(['Input_Image', 'Output_Image']);
        expect(r.okChip).not.toBeNull();
        expect(r.offChip).toContain('mpi-tile__chip--unavailable');
        expect(r.previewSrc).toBe('comfy_workflows/display/user-flows/spec-flow/preview.webp');
        expect(r.previewPixels).toBeGreaterThan(0);
        expect(r.drawerOpen).toBe(true);
        expect(r.drawerText).toContain("Can't run");
        expect(r.drawerText).toContain('Needs dependency "no-such-dep"');
        expect(r.drawerButtons).toBe(0);
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    } finally {
        await window.evaluate(() => window.__mpi532lib?.el?.destroy?.()).catch(() => {});
        await closeApp(app);
    }
});

// A shipped Flow republished as a package gets the SAME licence gate as the built-in one.
// Draw It In needs klein-9b, the same gated model Head Swap did. Head Swap WAS this
// fixture until MPI-781 took it out of the app and sold it as a package; the law is what
// mattered and klein-9b is what gates it, so the fixture moved to a flow that still ships.
// The real sold package's own gate is proved on the live run MPI-781 hands to Fabio.
test('a packaged Draw It In shows the licence gate the built-in one does, on a fresh profile', async ({}, testInfo) => {
    const { FLOWS } = require(path.join(ROOT, 'js/data/flowsRegistry.js'));
    const { COMMANDS } = require(path.join(ROOT, 'js/data/commandRegistry.js'));
    const { UNIVERSAL_WORKFLOWS } = require(path.join(ROOT, 'js/data/modelConstants/universal_workflows.js'));
    const { id, operation, workflow, ...flow } = FLOWS.find(f => f.id === 'scribble-object');
    const { universal, ...op } = COMMANDS[operation];
    const graph = JSON.parse(fs.readFileSync(path.join(ROOT, 'comfy_workflows', UNIVERSAL_WORKFLOWS[operation].workflow), 'utf8'));
    // The shipped graph bakes an author path into its loaders; a package must ship clean.
    for (const node of Object.values(graph)) {
        for (const [k, v] of Object.entries(node.inputs || {})) if (/^[A-Za-z]:[\\/]/.test(v)) node.inputs[k] = '';
    }
    const dir = path.join(testInfo.outputPath('user-data'), 'user_flows', 'scribble-object-test');
    fs.mkdirSync(dir, { recursive: true });
    for (const f of [flow.preview, flow.video]) fs.copyFileSync(path.join(ROOT, 'comfy_workflows', 'display', f), path.join(dir, f));
    fs.writeFileSync(path.join(dir, 'workflow.json'), JSON.stringify(graph));
    fs.writeFileSync(path.join(dir, 'flow.json'), JSON.stringify({
        schema: 'cubric/flow-package/v1', id: 'scribble-object-test', version: '1.0.0',
        flow: { ...flow, title: 'Draw It In Package' }, op,
    }));
    const { app, window, pageErrors, consoleErrors } = await launchApp(testInfo);

    try {
        await window.waitForTimeout(6000);
        const r = await window.evaluate(async () => {
            const { MpiFlowLibrary } = await import('/js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js');
            const { getFlowById, flowAvailability } = await import('/js/data/flowsRegistry.js');
            const { flowLicences } = await import('/js/utils/flowLicences.js');
            const { hasAcceptedLicence } = await import('/js/data/modelConstants/licences.js');
            const lib = MpiFlowLibrary.mount(document.createElement('div'));
            window.__mpi532licence = lib;
            const root = lib.el;
            lib.el.open();

            const drawer = async (title, not) => {
                [...root.querySelectorAll('.mpi-tile')]
                    .find(t => t.textContent.includes(title) && !(not && t.textContent.includes(not))).click();
                await new Promise(res => setTimeout(res, 300));
                const out = {
                    licences: [...root.querySelectorAll('#flow-detail-licences .mpi-detail__licence-name')].map(n => n.textContent),
                    buttons: [...root.querySelectorAll('#flow-detail-actions button')].map(b => b.textContent.trim()),
                };
                root.querySelector('#flow-detail-close')?.click();
                await new Promise(res => setTimeout(res, 100));
                return out;
            };
            const pkg = getFlowById('user:scribble-object-test');
            const built = getFlowById('scribble-object');
            return {
                reason: flowAvailability(pkg).reason || null,
                sameLicences: JSON.stringify(flowLicences(pkg)) === JSON.stringify(flowLicences(built)),
                licenceKeys: flowLicences(pkg).map(l => l.key),
                accepted: flowLicences(pkg).map(l => hasAcceptedLicence(l.key)),
                pkg: await drawer('Draw It In Package'),
                built: await drawer('Draw It In', 'Package'),
            };
        });

        expect(r.reason).toBeNull();
        expect(r.licenceKeys).toContain('klein-9b');
        expect(r.accepted).not.toContain(true);
        expect(r.sameLicences).toBe(true);
        expect(r.pkg.licences.length).toBeGreaterThan(0);
        expect(r.pkg).toEqual(r.built);
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    } finally {
        await window.evaluate(() => window.__mpi532licence?.el?.destroy?.()).catch(() => {});
        await closeApp(app);
    }
});

// Refresh: packages deleted from or copied into user_flows by hand, with the app running.
test('the Library Refresh drops a deleted package and shows a copied-in one, no restart', async ({}, testInfo) => {
    const flowsDir = path.join(testInfo.outputPath('user-data'), 'user_flows');
    writePackage(path.join(flowsDir, 'spec-gone'), 'spec-gone', 'Spec Gone');
    writePackage(path.join(flowsDir, 'spec-kept'), 'spec-kept', 'Spec Kept');
    const { app, window, pageErrors, consoleErrors } = await launchApp(testInfo);

    try {
        await window.waitForTimeout(6000);

        const titles = () => window.evaluate(() => {
            const text = [...window.__mpi532refresh.el.querySelectorAll('.mpi-tile')].map(t => t.textContent);
            return ['Spec Gone', 'Spec Kept', 'Spec New'].filter(n => text.some(t => t.includes(n)));
        });
        const refresh = () => window.evaluate(async () => {
            const root = window.__mpi532refresh.el;
            const btn = root.querySelector('[data-info="Refresh Flows from disk"]');
            btn.click();
            const spun = btn.hasAttribute('loading');
            for (let i = 0; i < 100 && btn.hasAttribute('loading'); i++) await new Promise(res => setTimeout(res, 100));
            return { spun, stillLoading: btn.hasAttribute('loading'), drawerOpen: root.querySelector('#flow-detail-panel').classList.contains('is-open') };
        });

        const opened = await window.evaluate(async () => {
            const { MpiFlowLibrary } = await import('/js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js');
            const lib = MpiFlowLibrary.mount(document.createElement('div'));
            window.__mpi532refresh = lib;
            lib.el.open();
            // The drawer is open on the Flow about to vanish: Refresh must close it.
            [...lib.el.querySelectorAll('.mpi-tile')].find(t => t.textContent.includes('Spec Gone')).click();
            await new Promise(res => setTimeout(res, 300));
            return lib.el.querySelector('#flow-detail-panel').classList.contains('is-open');
        });
        expect(opened).toBe(true);
        expect(await titles()).toEqual(['Spec Gone', 'Spec Kept']);

        fs.rmSync(path.join(flowsDir, 'spec-gone'), { recursive: true });
        writePackage(path.join(flowsDir, 'spec-new'), 'spec-new', 'Spec New');
        const r = await refresh();
        expect(r.spun).toBe(true);
        expect(r.stillLoading).toBe(false);
        expect(r.drawerOpen).toBe(false);
        expect(await titles()).toEqual(['Spec Kept', 'Spec New']);

        const reg = await window.evaluate(async () => {
            const { getFlowById } = await import('/js/data/flowsRegistry.js');
            const { getCommand } = await import('/js/data/commandRegistry.js');
            return [!!getFlowById('user:spec-gone'), !!getCommand('user:spec-gone'), !!getFlowById('user:spec-new')];
        });
        expect(reg).toEqual([false, false, true]);
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    } finally {
        await window.evaluate(() => window.__mpi532refresh?.el?.destroy?.()).catch(() => {});
        await closeApp(app);
    }
});

// MPI-915 — the folder button beside Refresh opens the folder the scan reads. The route is
// intercepted: a real /open-folder would pop an Explorer window on the test machine.
test('the Library folder button opens the user_flows folder the scan reads', async ({}, testInfo) => {
    const flowsDir = path.join(testInfo.outputPath('user-data'), 'user_flows');
    writePackage(path.join(flowsDir, 'spec-flow'), 'spec-flow', 'Spec Package');
    const { app, window, pageErrors, consoleErrors } = await launchApp(testInfo);

    try {
        await window.waitForTimeout(6000);
        let posted = null;
        await window.route('**/open-folder', (route) => {
            posted = route.request().postDataJSON();
            route.fulfill({ status: 200, body: 'Folder opened' });
        });

        const clicked = await window.evaluate(async () => {
            const { MpiFlowLibrary } = await import('/js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js');
            const lib = MpiFlowLibrary.mount(document.createElement('div'));
            window.__mpi915lib = lib;
            lib.el.open();
            const btn = lib.el.querySelector('[data-info="Open the Third-party Flows folder"]');
            btn?.click();
            return !!btn;
        });
        expect(clicked).toBe(true);
        await expect.poll(() => posted).not.toBeNull();
        expect(path.resolve(posted.folderPath)).toBe(path.resolve(flowsDir));
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    } finally {
        await window.evaluate(() => window.__mpi915lib?.el?.destroy?.()).catch(() => {});
        await closeApp(app);
    }
});

// The drop, end to end through the real overlay, route and registry. A synthetic File has
// no disk path, so `webUtils.getPathForFile` is pointed at a real folder — everything after
// that is the shipped code path. The zip and failure branches are unit-tested
// (tests/user-flows.test.cjs); this proves the wiring.
test('dropping a Flow folder on the Library installs it with no restart; a second drop asks to replace', async ({}, testInfo) => {
    const src = testInfo.outputPath('downloads', 'Dropped Flow v1');
    writePackage(src, 'dropped-flow', 'Dropped Flow');
    const { app, window, pageErrors, consoleErrors } = await launchApp(testInfo);

    try {
        await window.waitForTimeout(6000);

        const r = await window.evaluate(async (srcPath) => {
            window.require('electron').webUtils.getPathForFile = () => srcPath;
            const { MpiFlowLibrary } = await import('/js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js');
            const { getFlowById } = await import('/js/data/flowsRegistry.js');
            const { Events } = await import('/js/events.js');
            const sleep = (ms) => new Promise(res => setTimeout(res, ms));
            // 15s, not 5: an install copies a folder through the server, and this box may be
            // running a real generation while the suite runs.
            const until = async (fn) => { for (let i = 0; i < 150 && !fn(); i++) await sleep(100); return fn(); };

            const toasts = [];
            const offs = ['ui:success', 'ui:warning'].map(t => Events.on(t, (p) => toasts.push([t, p.title])));

            const lib = MpiFlowLibrary.mount(document.createElement('div'));
            window.__mpi532drop = lib;
            const root = lib.el;
            lib.el.open();
            const out = { before: !!getFlowById('user:dropped-flow') };

            const overlay = root.querySelector('.mpi-project-drop-overlay');
            const drag = (type, target) => {
                const dt = new DataTransfer();
                dt.items.add(new File(['x'], 'Dropped Flow v1'));
                target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
            };
            const visible = () => overlay.classList.contains('mpi-project-drop-overlay--visible');

            drag('dragenter', root);
            out.shownOnDrag = visible();
            out.text = overlay.textContent.trim();
            drag('drop', overlay);
            out.hiddenOnDrop = !visible();

            const tile = () => [...root.querySelectorAll('.mpi-tile')].find(t => t.textContent.includes('Dropped Flow'));
            out.tile = !!(await until(tile));
            out.registered = !!getFlowById('user:dropped-flow');
            out.toastsAfterFirst = toasts.slice();

            // Second drop: the id exists → the Replace dialog, then a real replace.
            drag('dragenter', root);
            out.shownOnSecondDrag = visible();
            drag('drop', overlay);
            const dialog = () => [...document.querySelectorAll('.mpi-ok-cancel')]
                .find(d => d.querySelector('#title-slot')?.textContent === 'Replace Flow' && d.isConnected && d.offsetParent);
            const dlg = await until(dialog);
            out.dialogText = dlg?.querySelector('#text-slot')?.textContent || null;
            const replace = dlg && [...dlg.querySelectorAll('button')].find(b => b.textContent.trim() === 'Replace');
            replace?.click();
            await until(() => toasts.length > out.toastsAfterFirst.length);
            out.toastsAfterReplace = toasts.slice();
            out.tilesNamedDropped = [...root.querySelectorAll('.mpi-tile')].filter(t => t.textContent.includes('Dropped Flow')).length;
            offs.forEach(off => off());
            return out;
        }, src);

        expect(r.before).toBe(false);
        expect(r.shownOnDrag).toBe(true);
        expect(r.text).toBe('Drop a Flow folder or its .zip to add it');
        expect(r.hiddenOnDrop).toBe(true);
        expect(r.tile).toBe(true);
        expect(r.registered).toBe(true);
        expect(r.toastsAfterFirst).toEqual([['ui:success', 'Flow added']]);
        expect(r.shownOnSecondDrag).toBe(true);
        expect(r.dialogText).toContain('Dropped Flow is already installed.');
        expect(r.toastsAfterReplace).toEqual([['ui:success', 'Flow added'], ['ui:success', 'Flow added']]);
        expect(r.tilesNamedDropped).toBe(1);
        expect(fs.existsSync(path.join(testInfo.outputPath('user-data'), 'user_flows', 'dropped-flow', 'flow.json'))).toBe(true);
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    } finally {
        await window.evaluate(() => window.__mpi532drop?.el?.destroy?.()).catch(() => {});
        await closeApp(app);
    }
});
