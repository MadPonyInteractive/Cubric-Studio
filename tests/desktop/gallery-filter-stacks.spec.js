// MPI-1282 — the FILTER panel's Stacks row: it lists only once the project has a stack,
// and switched on, the gallery shows nothing but stacks. A real project on disk, stacked
// through the selection bar, so the row reads the same cards the grid paints.
const crypto = require('crypto');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(180000);

async function clearBootModals(window) {
    const backdrops = () => window.evaluate(() => document.querySelectorAll('.mpi-modal-backdrop').length);
    const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
    if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 8 && await backdrops() > 0; i++) {
        await window.keyboard.press('Escape');
        await window.waitForTimeout(400);
    }
    expect(await backdrops(), 'the boot modals must be gone').toBe(0);
}

/** Uploads a solid PNG through the real route and waits for its card (gallery-stack.spec.js). */
async function importStill(window, project, { r, g, b, prefix }) {
    const buf = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r, g, b } } }).png().toBuffer();
    const itemId = crypto.randomUUID();
    return window.evaluate(async ({ project, itemId, base64, prefix }) => {
        const { Events } = await import('/js/events.js');
        const res = await fetch(`/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: `${prefix}_001.png`, base64Data: base64, autoSequence: true, itemId, mediaType: 'image', width: 64, height: 48 }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(`upload failed for ${prefix}: ${data.error}`);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`no card for ${prefix}`)), 15000);
            const unsub = Events.on('project:group-added', ({ group }) => {
                if (group?.history?.[0]?.id !== itemId) return;
                clearTimeout(timer);
                unsub();
                resolve(group.id);
            });
            Events.emit('media:imported', {
                url: `/project-file?path=${encodeURIComponent(data.filePath)}`,
                filename: data.filename, itemId,
                thumbPath: data.thumbPath || null, thumbPathLg: data.thumbPathLg || null,
                proxyPath: null, pixelDimensions: { w: 64, h: 48 }, mediaType: 'image',
            });
        });
    }, { project, itemId, base64: buf.toString('base64'), prefix });
}

const gridIds = (window) => window.evaluate(() =>
    [...document.querySelectorAll('.mpi-gallery-grid__row-wrap')].map(w => w.dataset.groupId).sort());

test('Stacks row: listed with a stack, and on it shows only stacks', async ({}, testInfo) => {
    const { app, window, pageErrors } = await launchApp(testInfo);

    try {
        await window.waitForTimeout(6000);
        await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            Events.emit('engine:install-skipped');
            await new Promise(r => setTimeout(r, 300));
        });
        await clearBootModals(window);

        const project = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            return p;
        }, { name: `mpi1282-${Date.now()}`, folderPath: testInfo.outputPath('projects') });

        const a = await importStill(window, project, { r: 226, g: 32, b: 32, prefix: 'e2e-a' });
        const b = await importStill(window, project, { r: 32, g: 210, b: 32, prefix: 'e2e-b' });
        const c = await importStill(window, project, { r: 32, g: 32, b: 226, prefix: 'e2e-c' });
        await window.evaluate(async () => {
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
            await new Promise(r => setTimeout(r, 1200));
        });
        await expect.poll(() => gridIds(window), { timeout: 15000 }).toEqual([a, b, c].sort());

        const filter = window.locator('.mpi-gallery-toolbar .mpi-gallery-filter__button');
        const stacksRow = window.locator('.mpi-gallery-filter__toggle', { hasText: 'Stacks' });

        // No stack yet: no Stacks row.
        await filter.click();
        await expect(window.locator('.mpi-popup--gallery-filter')).toBeVisible();
        await expect(window.locator('.mpi-gallery-filter__toggle', { hasText: 'Previews' })).toHaveCount(1);
        await expect(stacksRow).toHaveCount(0);
        await filter.click();

        // Stack a + b through the selection bar.
        await window.evaluate(async (ids) => {
            for (const id of ids) {
                document.querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${id}"] .mpi-group-card`)
                    .dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
            }
            await new Promise(r => setTimeout(r, 200));
            document.querySelector('.mpi-gallery-grid__selection-bar [data-action="stack"]').click();
            await new Promise(r => setTimeout(r, 500));
        }, [a, b]);
        await expect.poll(async () => (await gridIds(window)).length).toBe(2);
        const stackId = await window.evaluate(async () => {
            const { state } = await import('/js/state.js');
            return state.currentProject.itemGroups.find(g => g.type === 'stack').id;
        });

        // Stacks on: only the stack shows, and FILTER reads as filtered.
        await filter.click();
        await expect(stacksRow).toHaveCount(1);
        await stacksRow.click();
        await expect.poll(() => gridIds(window)).toEqual([stackId]);
        await expect(filter).toHaveClass(/mpi-gallery-filter__button--filtered/);
        expect(await filter.getAttribute('data-info')).toBe('Filtered: Stacks');

        // Off again: the loose card is back.
        await stacksRow.click();
        await expect.poll(() => gridIds(window)).toEqual([stackId, c].sort());
        await expect(filter).not.toHaveClass(/mpi-gallery-filter__button--filtered/);

        expect(pageErrors).toEqual([]);
    } finally {
        await closeApp(app);
    }
});
