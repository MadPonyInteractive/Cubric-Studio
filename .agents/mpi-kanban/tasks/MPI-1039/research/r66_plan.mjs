// MPI-1039 round 66: step 2 "match your picture" (Fabio 2026-10-26) - the user tells the Flow the input's view, so a pick
// that moves only height or zoom runs NO turn pass. Built from multiAnglePlan with turn = the matched start view: the
// turn step is dropped and the zoom pass's model re-alternates from what is left (no prior pass = FLUX.3).
// stdin: {"<input>": {"text": "<describe text>", "start": "<turn stop>"}}
// stdout: {"<input>": {"people", "framing", "<pick>": [{kind, model, ref, prompt}] | {error}}}
import { multiAnglePlan, parseMultiAngleFacts, BENCHED_ZOOM, FLUX3, QWEN } from '../../../../../js/data/flowPrompts/multiAngle.js';

const ins = JSON.parse(await new Promise(r => { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => r(s)); }));
const out = {};
for (const [name, { text, start }] of Object.entries(ins)) {
    const { facts, framing } = parseMultiAngleFacts(text);
    out[name] = { people: facts.people, framing, start };
    const picks = { lo: { height: 'lo' }, hi: { height: 'hi' } };
    for (const to of BENCHED_ZOOM[start]) picks[to] = { zoom: { from: framing || 'full', to } };
    for (const [key, pick] of Object.entries(picks)) {
        const plan = multiAnglePlan({ turn: start, ...pick }, facts);
        if (!plan.ok) { out[name][key] = { error: plan.reason }; continue; }
        const steps = plan.steps.filter(s => s.kind !== 'turn');
        steps.forEach((s, i) => { if (s.kind === 'zoom') s.model = steps[i - 1]?.model === FLUX3 ? QWEN : FLUX3; });
        out[name][key] = steps;
    }
}
process.stdout.write(JSON.stringify(out, null, 1));
