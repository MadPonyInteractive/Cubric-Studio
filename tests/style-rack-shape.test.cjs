/**
 * style-rack-shape.test.cjs — MPI-936.
 *
 * Style N = trigger line N = the Nth lora slot walking the bank chain = styleLoraLabels[N].
 * Nothing at run time checks the three agree: a missing trigger line is a style that loads
 * its LoRA and appends no words, a LoRA past the last line never gets its trigger, and a
 * label with no line behind it is a picker entry that does nothing. Krea2 and Klein assert
 * this in their generators; Qwen-Image 2.1's runtime is converted from a hand-edited raw,
 * so this is the one guard that covers every rack the same way.
 *
 * Lines are counted as Python's str.splitlines() does (MpiStyleSelector.build), so an EMPTY
 * interior line is a real, trigger-less style (Qwen's Detail Fix) and a trailing newline is not.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WF_DIR = path.join(__dirname, '..', 'comfy_workflows');

function splitlines(s) {
    const lines = s.split(/\r\n|\n|\r/);
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines;
}

/** { lines, slots } for the workflow's rack, or null. slots = lora names walking the chain. */
function rackOf(file) {
    const wf = JSON.parse(fs.readFileSync(path.join(WF_DIR, file), 'utf8'));
    const entries = Object.entries(wf).filter(([, n]) => n && typeof n === 'object');
    const sel = entries.find(([, n]) => n.class_type === 'MpiStyleSelector');
    if (!sel) return null;
    const slots = [];
    let upstream = sel[0];
    for (;;) {
        const next = entries.find(([, n]) => n.class_type === 'MpiStyleLoras'
            && Array.isArray(n.inputs.style) && String(n.inputs.style[0]) === String(upstream));
        if (!next) break;
        for (let i = 1; i <= 5; i++) slots.push(next[1].inputs[`lora_${i}`]);
        upstream = next[0];
    }
    return { lines: splitlines(sel[1].inputs.triggers || ''), slots };
}

test('style racks: trigger lines, chained lora slots and model labels agree', async () => {
    const { MODELS } = await import('../js/data/modelConstants/models.js');
    let checked = 0;
    for (const m of MODELS.filter(x => x.capabilities?.styleLoras === true)) {
        for (const file of new Set(Object.values(m.workflows || {}))) {
            if (!fs.existsSync(path.join(WF_DIR, file))) continue;
            const rack = rackOf(file);
            if (!rack) continue;
            const lastLora = rack.slots.reduce((acc, v, i) => (v && v !== 'None' ? i + 1 : acc), 0);
            assert.ok(lastLora <= rack.lines.length,
                `${file}: a LoRA sits in slot ${lastLora} but triggers has ${rack.lines.length} line(s) - it never gets its trigger`);
            assert.strictEqual(m.styleLoraLabels.length - 1, rack.lines.length,
                `${m.id} (${file}): ${m.styleLoraLabels.length - 1} style labels vs ${rack.lines.length} trigger lines`);
            checked++;
        }
    }
    assert.ok(checked > 0, 'no style rack checked - this test would pass trivially');
});

test('Qwen-Image 2.1: eight styles, Detail Fix is the trigger-less one', async () => {
    const { MODELS } = await import('../js/data/modelConstants/models.js');
    const q = MODELS.find(m => m.id === 'qwen-image-2-1');
    const rack = rackOf(q.workflows.t2i);
    assert.strictEqual(rack.lines.length, 8);
    const i = q.styleLoraLabels.indexOf('Detail Fix');
    assert.strictEqual(rack.lines[i - 1], '', 'Detail Fix has no trigger words');
    assert.match(rack.slots[i - 1], /detail-fix/);
});

test('style card images: one per label, every file on disk', async () => {
    const { MODELS } = await import('../js/data/modelConstants/models.js');
    const withArt = MODELS.filter(m => Array.isArray(m.styleLoraImages));
    for (const m of withArt) {
        assert.strictEqual(m.styleLoraImages.length, m.styleLoraLabels.length,
            `${m.id}: ${m.styleLoraImages.length} card images vs ${m.styleLoraLabels.length} labels - the picker shows the wrong picture`);
        for (const f of m.styleLoraImages) {
            assert.ok(fs.existsSync(path.join(WF_DIR, 'display', f)), `${m.id}: missing comfy_workflows/display/${f}`);
        }
    }
    assert.ok(withArt.some(m => m.id === 'qwen-image-2-1'), 'Qwen-Image 2.1 ships card art');
});
