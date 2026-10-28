const crypto = require('crypto');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-822 — Q opens the Cue slide-over from INSIDE an open Flow (the gallery under it docks the
 * Cue instead, MPI-1320; a Flow stashes the dock, so over one it is the slide-over again).
 *
 * The flow frame can stack runs now, so the queue panel is the only place a
 * pending flow run can be seen or stopped. Fabio, first app pass: "pressing Q
 * once does nothing".
 *
 * Driven through the REAL path, not a flow mounted into a host div (which is
 * what every other flow spec does): the suspects are all overlay-shaped —
 * `MpiOverlay` stashes `.main-area`'s children, publishes `--main-overlay-z`,
 * and `MpiGalleryBlock` (which owns the `queue.toggle` bind) has to survive all
 * of it. So: real project, real gallery, real `flow:open` (js/shell.js:519).
 */
test.setTimeout(180000);

async function clearBootModals(window) {
    const backdrops = () => window.evaluate(
        () => document.querySelectorAll('.mpi-modal-backdrop').length);

    const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
    if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});

    for (let i = 0; i < 8 && await backdrops() > 0; i++) {
        await window.keyboard.press('Escape');
        await window.waitForTimeout(400);
    }
    expect(await backdrops(), 'the boot modals must be gone').toBe(0);
}

/**
 * Let the slide-in/out finish before probing. `onTop` is a hit test, and a panel
 * caught mid-transform fails it for a reason that has nothing to do with z-order —
 * which is exactly what this spec is measuring.
 */
async function settle(window) {
    await window.waitForTimeout(300);
    await window.waitForFunction(() => {
        const p = document.querySelector('.mpi-slide-over--queue');
        if (!p) return true;
        const t = getComputedStyle(p).transform;
        return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
    }, null, { timeout: 5000 }).catch(() => {});
}

/** What the queue panel looks like from outside the module: DOM, not internals. */
function probeQueuePanel(window) {
    return window.evaluate(() => {
        const panel = document.querySelector('.mpi-slide-over--queue');
        const flow = document.querySelector('.mpi-base-flow');
        const active = document.activeElement;
        if (!panel) {
            return {
                present: false,
                flowPresent: !!flow,
                activeElement: active ? `${active.tagName}.${active.className}` : null,
            };
        }
        const r = panel.getBoundingClientRect();
        const cs = getComputedStyle(panel);
        return {
            present: true,
            flowPresent: !!flow,
            expanded: panel.getAttribute('aria-expanded'),
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            zIndex: cs.zIndex,
            transform: cs.transform,
            mainOverlayZ: getComputedStyle(document.documentElement).getPropertyValue('--main-overlay-z'),
            // Is it actually on top where the user would click it?
            onTop: (() => {
                const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                return !!(hit && panel.contains(hit));
            })(),
            activeElement: active ? `${active.tagName}.${active.className}` : null,
        };
    });
}

test('Q opens the Cue slide-over from inside an open flow', async ({}, testInfo) => {
    const { app, window, consoleErrors, pageErrors } = await launchApp(testInfo);

    try {
        await clearBootModals(window);

        // ── Real project on disk, so .main-area holds the real gallery block ────
        const projectName = `mpi822-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const project = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            navigate(PAGE_GALLERY);
            return p;
        }, { name: projectName, folderPath: testInfo.outputPath('projects') });
        expect(project?.folderPath, 'the project must land on real disk').toBeTruthy();
        await window.waitForSelector('.mpi-gallery-block', { timeout: 30000 });

        // ── Q in the GALLERY first: the baseline the flow case is measured against ──
        // MPI-1320: the gallery DOCKS the Cue (#queue-panel-mount), it never slides over.
        const probeDock = () => window.evaluate(() => {
            const dock = document.querySelector('#queue-panel-mount');
            const r = dock.getBoundingClientRect();
            const agent = document.querySelector('#agent-panel-mount').getBoundingClientRect();
            const content = document.querySelector('#workspace-content').getBoundingClientRect();
            const toggle = document.querySelector('.mpi-gallery-toolbar__queue-slot .mpi-btn');
            return {
                open: dock.classList.contains('queue-panel-mount--open'),
                hasPanel: !!dock.querySelector('.mpi-queue-panel'),
                slideOver: !!document.querySelector('.mpi-slide-over--queue'),
                top: Math.round(r.top), agentTop: Math.round(agent.top),
                left: Math.round(r.left), width: Math.round(r.width),
                contentRight: Math.round(content.right),
                toggleActive: toggle?.classList.contains('is-active') ?? null,
            };
        });
        await window.keyboard.press('q');
        await window.waitForTimeout(500);
        const docked = await probeDock();
        await window.keyboard.press('q');
        await window.waitForTimeout(500);
        const undocked = await probeDock();
        console.log('[MPI-1320] docked   :', JSON.stringify(docked));
        console.log('[MPI-1320] undocked :', JSON.stringify(undocked));
        expect(docked.open, 'Q must dock the Cue in the gallery').toBe(true);
        expect(docked.slideOver, 'the gallery never opens the slide-over').toBe(false);
        expect(docked.hasPanel).toBe(true);
        expect(docked.top, 'the dock starts where the agent panel does').toBe(docked.agentTop);
        expect(docked.width).toBeGreaterThan(200);
        expect(docked.contentRight, 'the gallery ends where the dock begins').toBe(docked.left);
        expect(docked.toggleActive, 'the toolbar toggle lights with the dock').toBe(true);
        expect(undocked.open).toBe(false);
        expect(undocked.toggleActive).toBe(false);

        // ── Open a flow through the real shell path ────────────────────────────
        const flowId = await window.evaluate(async () => {
            const { listFlows } = await import('/js/data/flowsRegistry.js');
            const { Events } = await import('/js/events.js');
            const flow = listFlows()[0];
            Events.emit('flow:open', { flowId: flow.id });
            return flow.id;
        });
        await window.waitForSelector('.mpi-base-flow', { timeout: 30000 });
        await window.waitForTimeout(600);

        // ── Q inside the flow, twice. The gap between the two IS the diagnosis ──
        await window.keyboard.press('q');
        await settle(window);
        const firstPress = await probeQueuePanel(window);

        await window.keyboard.press('q');
        await settle(window);
        const secondPress = await probeQueuePanel(window);

        // ── Act 2: a SECOND overlay opens and closes over the live flow ────────
        // The everyday version of this is `#flow-back` (reopens the Flow Library) or
        // the flow's own LoRA cogwheel (MpiModelSettings). Both are MpiOverlays, and
        // both leave the flow's own main-area overlay standing underneath.
        const libraryOpened = await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            Events.emit('flows:open');
            await new Promise(r => setTimeout(r, 1200));
            const open = !!document.querySelector('.mpi-flow-library');
            Events.emit('ui:close-flows');
            await new Promise(r => setTimeout(r, 800));
            return { open, stillOpen: !!document.querySelector('.mpi-flow-library') };
        });
        await window.waitForTimeout(400);

        await window.keyboard.press('q');
        await settle(window);
        const afterSecondOverlay = await probeQueuePanel(window);

        console.log('[MPI-822] flow:', flowId);
        console.log('[MPI-822] flow    Q#1  :', JSON.stringify(firstPress));
        console.log('[MPI-822] flow    Q#2  :', JSON.stringify(secondPress));
        console.log('[MPI-822] library      :', JSON.stringify(libraryOpened));
        console.log('[MPI-822] after 2nd ov :', JSON.stringify(afterSecondOverlay));
        console.log('[MPI-822] consoleErrors:', JSON.stringify(consoleErrors));
        console.log('[MPI-822] pageErrors   :', JSON.stringify(pageErrors));

        // The card's contract: one press, inside the flow, opens it — visible and on top.
        expect(firstPress.flowPresent, 'the flow must still be open').toBe(true);
        expect(firstPress.present, 'ONE Q inside a flow must open the Cue panel').toBe(true);
        expect(firstPress.expanded, 'the panel must be slid in, not parked off-screen').toBe('true');
        expect(firstPress.onTop, 'the panel must be hit-testable above the flow overlay').toBe(true);

        // And it must still be true after ANOTHER overlay has come and gone over the
        // flow — the flow's overlay is still up, so the queue still has to clear it.
        expect(libraryOpened.open, 'the Flow Library must have opened over the flow').toBe(true);
        expect(afterSecondOverlay.present, 'Q must still open the Cue panel').toBe(true);
        expect(afterSecondOverlay.onTop,
            'the Cue panel must still clear the flow overlay after a second overlay closed').toBe(true);
    } finally {
        await closeApp(app);
    }
});
