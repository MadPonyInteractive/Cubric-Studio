// MPI-1142: a slow-load line names the requests that held the renderer's sockets during the wait.
const test = require('node:test');
const assert = require('node:assert');
const { describeHeld } = require('../routes/heldRequests');

test('names requests held 3 s or more inside the load window, open or ended', () => {
    const now = 100_000;
    const src = {
        open: [
            { url: '/comfy/downloads/stream', start: 10_000 },          // open for 90 s: holder
            { url: '/project-file?p=a', start: now - 500 },              // open, but only 0.5 s
        ],
        ended: [
            { url: '/media/My%20Project/ref2v_002.mp4', start: 70_000, end: 85_000 }, // overlaps the window
            { url: '/media/old.mp4', start: 1_000, end: 60_000 },        // ended before the window
        ],
    };
    assert.strictEqual(
        describeHeld('img 16400ms status=200: queued 16300ms | /x.png', now, src),
        ' | held: /comfy/downloads/stream 90s open, /media/My Project/ref2v_002.mp4 15s',
    );
    assert.strictEqual(describeHeld('img 3200ms', now, { open: [], ended: [] }), ' | held: none');
});
