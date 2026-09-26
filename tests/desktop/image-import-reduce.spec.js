const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-943 — a drop of very large photos asks ONCE whether to shrink them.
 *
 * A tester dragged 16K photos in; every tool after that was slow or failed, and he
 * had to shrink them in another program. Now a drop holding images past 4K opens one
 * dialog for the whole drop; the chosen size applies to the large images only, and
 * Cancel imports nothing.
 *
 * The files must be DISK-BACKED: the size probe and the resize read the file's own
 * path (webUtils.getPathForFile), and a `new File([...])` built in-page has none. So
 * they go through a real <input type=file> via setInputFiles, then into the drop.
 */
test.setTimeout(120000);

async function boot(window, testInfo) {
    await window.evaluate(async () => {
        const { Events } = await import('/js/events.js');
        Events.emit('engine:install-skipped');
        await new Promise(r => setTimeout(r, 300));
    });
    const folderPath = testInfo.outputPath('project');
    fs.mkdirSync(folderPath, { recursive: true });
    const project = { id: 'e2e-reduce', name: 'E2E Reduce', modelSettings: {}, itemGroups: [] };
    fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));
    await window.evaluate(async (p) => {
        const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([
            import('/js/state.js'), import('/js/router.js'),
        ]);
        state.currentProject = p;
        navigate(PAGE_GALLERY);
        await new Promise(r => setTimeout(r, 1000));
    }, { ...project, folderPath: folderPath.replace(/\\/g, '/') });
    return folderPath;
}

async function fixtures(testInfo) {
    const dir = testInfo.outputPath('src');
    fs.mkdirSync(dir, { recursive: true });
    const make = async (name, width, height, fmt) => {
        const file = path.join(dir, name);
        await sharp({ create: { width, height, channels: 3, background: '#6a8' } }).toFormat(fmt).toFile(file);
        return file;
    };
    return [
        await make('camera.jpg', 6000, 4000, 'jpeg'),   // 24 MP: past 4K
        await make('scan.png', 5000, 5000, 'png'),      // 25 MP: past 4K
        await make('small.jpg', 800, 600, 'jpeg'),      // left alone
    ];
}

async function drop(window, files) {
    await window.evaluate(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.id = 'e2e-files';
        input.style.display = 'none';
        document.body.appendChild(input);
    });
    await window.setInputFiles('#e2e-files', files);
    await window.evaluate(() => {
        const input = document.getElementById('e2e-files');
        const dt = new DataTransfer();
        for (const f of input.files) dt.items.add(f);
        input.remove();
        window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }));
        document.querySelector('.mpi-media-drop-overlay')
            .dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
}

const mediaImages = (folderPath) => {
    const dir = path.join(folderPath, 'Media');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(n => /\.(jpe?g|png|webp)$/i.test(n)).map(n => path.join(dir, n));
};

test('one dialog per drop; only the large images shrink, to the size picked', async ({}, testInfo) => {
    const { app, window, pageErrors } = await launchApp(testInfo);
    try {
        const folderPath = await boot(window, testInfo);
        await drop(window, await fixtures(testInfo));

        const dialog = window.locator('.mpi-ok-cancel');
        await expect(dialog).toHaveCount(1, { timeout: 15000 });
        await expect(dialog.locator('.mpi-ok-cancel__title')).toHaveText('2 images are very large');

        await dialog.locator('.mpi-dropdown__trigger').click();
        await window.locator('.mpi-dropdown__option[data-value="1"]').click();
        await dialog.getByRole('button', { name: 'Import' }).click();

        await expect.poll(() => mediaImages(folderPath).length, { timeout: 60000 }).toBe(3);
        // Asked once: no second dialog for the second large file.
        await expect(window.locator('.mpi-ok-cancel')).toHaveCount(0);

        const sizes = await Promise.all(mediaImages(folderPath).map(async f => {
            const m = await sharp(f).metadata();
            return m.width * m.height;
        }));
        sizes.sort((a, b) => a - b);
        expect(sizes[0]).toBe(800 * 600);
        for (const px of sizes.slice(1)) {
            expect(px).toBeLessThanOrEqual(1024 * 1024 * 1.001);
            expect(px).toBeGreaterThan(1024 * 1024 * 0.99);
        }
        expect(pageErrors).toEqual([]);
    } finally {
        await closeApp(app);
    }
});

test('Cancel imports nothing', async ({}, testInfo) => {
    const { app, window, pageErrors } = await launchApp(testInfo);
    try {
        const folderPath = await boot(window, testInfo);
        await drop(window, await fixtures(testInfo));

        const dialog = window.locator('.mpi-ok-cancel');
        await expect(dialog).toHaveCount(1, { timeout: 15000 });
        await dialog.getByRole('button', { name: 'Cancel' }).click();

        await window.waitForTimeout(2000);
        await expect(window.locator('.mpi-ok-cancel')).toHaveCount(0);
        expect(mediaImages(folderPath)).toEqual([]);
        expect(pageErrors).toEqual([]);
    } finally {
        await closeApp(app);
    }
});
