// MPI-1048 round 4: HEAD recipe (OLD, old.recipe.mjs = `git show 3ab767f07:js/data/recipes/qwen-image-2.1.recipe.js`)
// vs working tree (NEW: covered-part rule + no "drop shadow" anywhere), on DeepInfra google/gemma-3-12b-it, Fabio's
// exact knees input. Round 1-3 checked keywords + the opening only, which passed while his renders failed: the
// picture follows the most SPECIFIC sentence, and t2i_015/016 each had one putting her feet on sand. So this counts:
//   feetOnSand  - any sentence with feet/ankles/toes AND sand/shore/ground (the failure; t2i_015, t2i_016)
//   legsCovered - any sentence with legs/knees/shins/calves AND cover/hide/submerge/beneath/obscure (what worked:
//                 t2i_017 and Cosmo's t2i_018 both said the water COVERS her legs)
// Usage: DEEPINFRA_API_KEY=... node deepinfra-ab2.mjs <runs>   Fabio's yes: 20 calls, cap 1 cent.
import { writeFileSync } from 'node:fs';
import { DeepInfraEngine } from 'file:///C:/AI/Mpi/Cubric-Vision/services/llmEngines.mjs';
import { composeSystemPrompt } from 'file:///C:/AI/Mpi/Cubric-Vision/js/data/recipes/styles.js';
import { qwenImage21 as NEW } from 'file:///C:/AI/Mpi/Cubric-Vision/js/data/recipes/qwen-image-2.1.recipe.js';
import { qwenImage21 as OLD } from './old.recipe.mjs';

const MODEL = 'google/gemma-3-12b-it';
const RUNS = Number(process.argv[2] || 10);
const CAP = 0.01;
const INPUT = 'A woman in a monokini on a beach with water up to her knees ';
const sentences = (t) => t.split(/(?<=[.!?])\s+/);
const feetOnSand = (s) => /\b(feet|foot|ankles?|toes)\b/i.test(s) && /\b(sand|shore|ground)\b/i.test(s);
const legsCovered = (s) => /\b(legs?|knees?|shins?|calves)\b/i.test(s) && /(cover|hid|submerg|beneath|obscur)/i.test(s);

const engine = new DeepInfraEngine(process.env.DEEPINFRA_API_KEY);
const out = [];
let spent = 0;
// '--new-only' skips the OLD baseline once it is measured.
for (const [tag, r] of (process.argv.includes('--new-only') ? [['NEW', NEW]] : [['OLD', OLD], ['NEW', NEW]])) {
    let bad = 0, covered = 0, shadow = 0, opening = 0;
    for (let i = 1; i <= RUNS; i++) {
        if (spent >= CAP) { console.log('CAP reached, stopping'); break; }
        const { text, usage } = await engine.complete(INPUT, { model: MODEL, system: composeSystemPrompt(r.modes.t2v) });
        spent += usage?.estimated_cost ?? 0;
        const t = text.trim();
        const ss = sentences(t);
        const row = {
            tag, run: i, feetOnSand: ss.filter(feetOnSand), legsCovered: ss.some(legsCovered),
            dropShadow: /drop shadow/i.test(t), kneeInOpening: /knee/i.test(ss[0]),
            paragraphs: t.split(/\n\s*\n/).length, words: t.split(/\s+/).length, text: t,
        };
        out.push(row);
        if (row.feetOnSand.length) bad++;
        if (row.legsCovered) covered++;
        if (row.dropShadow) shadow++;
        if (row.kneeInOpening) opening++;
        console.log(`${tag} ${i}: feetOnSand=${row.feetOnSand.length} legsCovered=${row.legsCovered} dropShadow=${row.dropShadow} kneeOpening=${row.kneeInOpening} paras=${row.paragraphs} words=${row.words}`);
    }
    console.log(`== ${tag}: feet on sand ${bad}/${RUNS}, legs covered ${covered}/${RUNS}, drop shadow ${shadow}/${RUNS}, knee in opening ${opening}/${RUNS}`);
}
console.log(`spent (DeepInfra estimated_cost): $${spent.toFixed(5)}`);
writeFileSync(new URL(`./ab-out4${process.argv.includes('--new-only') ? '-new' : ''}.json`, import.meta.url), JSON.stringify(out, null, 2));
