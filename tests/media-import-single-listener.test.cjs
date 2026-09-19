/**
 * tests/media-import-single-listener.test.cjs — MPI-723.
 *
 * `media:imported` is emitted by four ingest surfaces, and exactly one listener
 * turns it into an ItemGroup. That listener must be app-lifetime: until MPI-723
 * it lived inside MpiGalleryBlock, and since navigation destroys the outgoing
 * Block before mounting the next, only one Block is ever mounted — so an import
 * from the history workspace wrote the file and its sidecar to disk and never
 * became a card. A silent orphan, with nothing on screen to say so.
 *
 * The regression is invisible from inside the gallery (where it still works),
 * which is why it is asserted statically instead.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** Every `.js` under js/, recursively, repo-relative with forward slashes. */
function jsFiles(dir = 'js') {
    const abs = path.join(ROOT, dir);
    return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) return jsFiles(rel);
        return e.name.endsWith('.js') ? [rel] : [];
    });
}

/** Files holding an `Events.on('media:imported'` subscription. */
function listenerFiles() {
    return jsFiles().filter((rel) =>
        /Events\.on\(\s*['"]media:imported['"]/.test(
            fs.readFileSync(path.join(ROOT, rel), 'utf8'),
        ),
    );
}

test('the media:imported -> ItemGroup build has exactly one listener, and it is a service', () => {
    const files = listenerFiles();

    // projectStatsService only refreshes a byte count off the same event — it
    // builds nothing, so it is a legitimate second subscriber.
    assert.deepStrictEqual(
        files.sort(),
        ['js/services/mediaImportService.js', 'js/services/projectStatsService.js'],
        `unexpected media:imported listeners: ${files.join(', ')}`,
    );
});

test('no Block or component listens for media:imported', () => {
    const offenders = listenerFiles().filter((rel) => rel.startsWith('js/components/'));
    assert.deepStrictEqual(
        offenders,
        [],
        `a component subscribes to media:imported and will miss every import made from another workspace: ${offenders.join(', ')}`,
    );
});

test('the service is started from the shell, not from a Block', () => {
    const shell = fs.readFileSync(path.join(ROOT, 'js/shell.js'), 'utf8');
    assert.match(shell, /from\s+'\.\/services\/mediaImportService\.js'/);
    assert.match(shell, /startMediaImport\(\)/);
});

/**
 * MPI-736 — every media kind the build handles carries its derivative through.
 *
 * The audio branch dropped `thumbPath`, and the failure looked like anything but
 * a missing key: the server had baked the waveform and stamped the sidecar, so
 * the card was blank only until the project was next opened, when the sidecar was
 * read back and the wave appeared. A bug that fixes itself on reload is one
 * nobody reports.
 *
 * Asserted against the source for the same reason the rest of this file is: the
 * build is one un-exported function inside an ES module whose imports reach the
 * DOM, and the shape of the bug — an omitted property — is exactly what reading
 * the call sites catches.
 */
test('every branch of the ItemGroup build passes thumbPath to its item', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/services/mediaImportService.js'), 'utf8');

    for (const factory of ['createImageItem', 'createVideoItem', 'createAudioItem']) {
        const call = src.slice(src.indexOf(`${factory}({`));
        const args = call.slice(0, call.indexOf('})') + 1);
        assert.ok(
            /(^|[\s,{])thumbPath\s*[,:]/m.test(args),
            `${factory}() in _buildGroup must be passed thumbPath, or a freshly imported `
            + 'card paints no thumb until the project is reopened',
        );
    }
});
