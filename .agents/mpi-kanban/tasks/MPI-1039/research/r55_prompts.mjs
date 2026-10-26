// MPI-1039 round 55 prompts: the Flow's own turn words (multiAnglePlan) for any turn stops, written from a front view.
// stdin: {"<input cell>": "<describe text>"}; argv: the stops; stdout: {"<input>|<stop>": prompt}
import { multiAnglePlan, parseMultiAngleFacts } from '../../../../../js/data/flowPrompts/multiAngle.js';

const stops = process.argv.slice(2);
const texts = JSON.parse(await new Promise(r => { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => r(s)); }));
const out = {};
for (const [cell, text] of Object.entries(texts)) {
    const facts = parseMultiAngleFacts(text);
    for (const t of stops) out[`${cell}|${t}`] = multiAnglePlan({ turn: t }, facts).steps.find(s => s.kind === 'turn').prompt;
}
process.stdout.write(JSON.stringify(out, null, 1));
