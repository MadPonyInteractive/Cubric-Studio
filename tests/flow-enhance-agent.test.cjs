'use strict';
/**
 * tests/flow-enhance-agent.test.cjs — an agent's (and a routine's) Flow run enhances like a hand
 * run does (MPI-1002, Fabio's option A).
 *
 * Run: node --test tests/flow-enhance-agent.test.cjs
 *
 * `buildFlow` (js/shell/agentDispatch.js) is the one door the agent and routine Flow steps reach a
 * Flow through, and it imports half the app, so this pins its SOURCE: the enhance call sits after
 * the fields are resolved and before anything is returned, a failed enhancer refuses (submits
 * nothing), and the patch reaches both the graph params and the saved snapshot. What the enhance
 * itself does is tests/flow-enhance.test.cjs's job.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'shell', 'agentDispatch.js'), 'utf8');
const body = src.slice(src.indexOf('export async function buildFlow('), src.indexOf('/** What `followBlocker` found'));

test('buildFlow imports the shared enhance entry point, not a copy', () => {
    assert.match(src, /import \{ enhanceFlowRun \} from '\.\.\/services\/flowEnhance\.js';/);
    assert.doesNotMatch(src, /enhanceFlow\(/, 'the agent path never calls llmService.enhanceFlow directly');
});

test('the enhance runs after the fields resolve and before the run is returned', () => {
    const resolve = body.indexOf('resolveFlowFieldValues(flow, fields)');
    const enhance = body.indexOf('await enhanceFlowRun(flow, { inputs, injectionParams: fieldInjection })');
    const ret = body.indexOf('ok: true,');
    assert.ok(resolve > -1 && enhance > -1 && ret > -1, 'all three landmarks present');
    assert.ok(resolve < enhance && enhance < ret, 'resolve -> enhance -> return');
});

test('a failed enhancer refuses, so nothing is submitted', () => {
    assert.match(body, /if \(!enhanced\.ok\) return _refuse\(enhanced\.code, enhanced\.message\);/);
});

test('the patch reaches the graph params (box params still win) and the saved snapshot', () => {
    assert.match(body, /\{ \.\.\.fieldInjection, \.\.\.enhanced\.injectionParams, \.\.\.boxInjection \}/);
    assert.match(body, /\.\.\.inputs,\s*\n\s*\.\.\.enhanced\.inputs,/, 'enhanceWrote rides flowInputs for Reuse');
});

test('a wrong field id is answered with the fields the agent was shown, never the hidden ones', () => {
    assert.doesNotMatch(src, /flowDeclaredFields\(flow\)\.map/,
        'listing flowDeclaredFields would name Song\'s hidden caption blocks back to the agent');
    assert.equal((src.match(/agentFieldSpecs\(flow\)\.map\(f => f\.id\)/g) || []).length, 2, 'buildFlow and openFlow');
});
