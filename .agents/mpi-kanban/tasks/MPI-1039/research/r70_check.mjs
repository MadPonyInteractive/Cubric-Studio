// MPI-1039 round 70 -> build: the shipped multiAnglePlan words for every round-70 cell equal the benched prompt.
//   node r70_check.mjs
import { readFileSync } from 'node:fs';
import { multiAnglePlan, parseMultiAngleFacts } from '../../../../../js/data/flowPrompts/multiAngle.js';

const plans = JSON.parse(readFileSync('out/mq_blender70_plans.json', 'utf8'));
const texts = JSON.parse(readFileSync('out/mq_blender70_describe.json', 'utf8'));
let same = 0;
let diff = 0;
for (const [k, plan] of Object.entries(plans)) {
    const { facts } = parseMultiAngleFacts(texts[k]);
    const from = { turn: plan.start, height: plan.height };
    for (const [cell, step] of Object.entries(plan)) {
        if (!step?.prompt) continue;
        const pick = cell === 'level' ? { turn: plan.start, height: 'level' }
            : cell === 'other' ? { turn: plan.start, height: plan.height === 'lo' ? 'hi' : 'lo' }
                : { turn: cell, height: plan.height };
        for (const pic of [false, true]) {
            const got = multiAnglePlan({ ...pick, from, outfit: { ref: pic } }, facts);
            // the eye-level pass from a turned start takes no picture (round 70): compare with the no-picture prompt
            const want = pic && !(cell === 'level' && plan.start !== 'front') ? step.prompt3 : step.prompt;
            const g = got.ok ? got.steps[0] : null;
            if (g && g.prompt === want && g.ref === step.ref && g.model === step.model) same++;
            else { diff++; console.log('DIFF', k, cell, pic, got.ok ? g.ref : got.reason); }
        }
    }
}
console.log(`same ${same}, diff ${diff}`);
