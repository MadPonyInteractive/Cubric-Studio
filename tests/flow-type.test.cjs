/**
 * flow-type.test.cjs — MPI-754.
 *
 * Every FlowDef declares `type: 'create' | 'edit' | 'enhance'` beside `mediaType` —
 * what the flow DOES to its media (create = makes new stuff, edit = changes existing
 * stuff, enhance = improves existing stuff), independent of what it produces. Nothing
 * else validates this key, so a typo or an omission on a new flow would sail straight
 * into the Flow Library filter another worker is building on top of it.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const esm = p => import('file://' + repo(p).replace(/\\/g, '/'));

const VALID_TYPES = ['create', 'edit', 'enhance'];

test('every flow declares a valid type', async () => {
    const mod = await esm('js/data/flowsRegistry.js');
    const flows = mod.FLOWS || mod.flows || mod.default;
    assert.ok(Array.isArray(flows), 'flowsRegistry must export an array of FlowDefs');
    assert.ok(flows.length > 0, 'flowsRegistry must export at least one flow');

    for (const flow of flows) {
        assert.ok(VALID_TYPES.includes(flow.type),
            `flow "${flow.id}" has type ${JSON.stringify(flow.type)} — must be one of `
            + `${VALID_TYPES.join(', ')}`);
    }
});
