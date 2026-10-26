// MPI-1039 round 57: the Flow's own plan (multiAnglePlan, FRONT FIRST) for every turn stop, from the describer's answer.
// stdin: {"<input>": "<describe text>"}; stdout: {"<input>": {"people": n, "framing": rung, "<stop>": [{kind, model, ref, prompt}]}}
import { multiAnglePlan, parseMultiAngleFacts, MULTI_ANGLE_TURNS } from '../../../../../js/data/flowPrompts/multiAngle.js';

const texts = JSON.parse(await new Promise(r => { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => r(s)); }));
const out = {};
for (const [name, text] of Object.entries(texts)) {
    const { facts, framing } = parseMultiAngleFacts(text);
    out[name] = { people: facts.people, framing };
    for (const t of MULTI_ANGLE_TURNS) out[name][t] = multiAnglePlan({ turn: t }, facts).steps;
}
process.stdout.write(JSON.stringify(out, null, 1));
