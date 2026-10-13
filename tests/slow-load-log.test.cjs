// MPI-1137: a slow picture/video load reaches app.log with its queue / server / download split.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const esm = (p) => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));

const entry = (over) => ({
    name: 'http://127.0.0.1:3000/media/My%20Project/a.mp4',
    initiatorType: 'video', duration: 16700, startTime: 100,
    requestStart: 16600, responseStart: 16650, responseEnd: 16800, responseStatus: 206,
    ...over,
});

test('slow media load names where the time went', async () => {
    const { describeSlowLoad } = await esm('js/services/clientLogger.js');
    assert.strictEqual(describeSlowLoad(entry()),
        'video 16700ms status=206: queued 16500ms, server 50ms, download 150ms | /media/My Project/a.mp4');
    assert.match(describeSlowLoad(entry({ requestStart: 0 })), /no request sent/);
});

test('fast loads and fetch/streams are not logged', async () => {
    const { describeSlowLoad } = await esm('js/services/clientLogger.js');
    assert.strictEqual(describeSlowLoad(entry({ duration: 2999 })), null);
    assert.strictEqual(describeSlowLoad(entry({ initiatorType: 'fetch' })), null);
    assert.strictEqual(describeSlowLoad(entry({ initiatorType: 'other' })), null);
});
