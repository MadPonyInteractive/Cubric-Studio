// MPI-1048: committed recipe (OLD) vs working tree (NEW) on DeepInfra google/gemma-3-12b-it, the
// engine Fabio's app enhances with. Same call as the app's endpoint branch: complete(prompt, {model, system}).
// Usage: node ab.mjs <runs> [--dry] [--new-only]   Writes ab-out*.json (full outputs) beside this file.
// old.recipe.mjs = `git show ea0b707ef:js/data/recipes/qwen-image-2.1.recipe.js`. Needs DEEPINFRA_API_KEY.
import { writeFileSync } from 'node:fs';
import { DeepInfraEngine } from 'file:///C:/AI/Mpi/Cubric-Vision/services/llmEngines.mjs';
import { composeSystemPrompt } from 'file:///C:/AI/Mpi/Cubric-Vision/js/data/recipes/styles.js';
import { qwenImage21 as NEW } from 'file:///C:/AI/Mpi/Cubric-Vision/js/data/recipes/qwen-image-2.1.recipe.js';
import { qwenImage21 as OLD } from './old.recipe.mjs';

const MODEL = 'google/gemma-3-12b-it';
const RUNS = Number(process.argv[2] || 5);
const CASES = [
  // Fabio's exact input (t2i_011/012), trailing space included.
  { id: 'knees', input: 'A woman in a monokini on a beach with water up to her knees ', keep: [/knee/i, /water|sea|surf|waves/i] },
  // Held out: the rule's own example is different, so this tests the rule, not a memorised answer.
  { id: 'roof', input: 'a man sitting on the roof of a car in the rain holding a red umbrella', keep: [/roof/i, /rain/i, /umbrella/i] },
  // The one case that MUST carry the alpha lines: the fix may not break it.
  { id: 'sticker', input: 'a cartoon cactus sticker with a transparent background', keep: [/cactus/i] },
];
const NEW_ONLY = process.argv.includes('--new-only');
const firstSentence = (t) => t.split(/(?<=[.!?])\s+/)[0];

if (process.argv.includes('--dry')) {
  for (const [tag, r] of [['OLD', OLD], ['NEW', NEW]]) console.log(tag, 'system chars', composeSystemPrompt(r.modes.t2v).length);
  process.exit(0);
}

const engine = new DeepInfraEngine(process.env.DEEPINFRA_API_KEY);
const out = [];
let spent = 0;
for (const c of CASES) {
  for (const [tag, r] of (NEW_ONLY ? [['NEW', NEW]] : [['OLD', OLD], ['NEW', NEW]])) {
    let inOpening = 0, anywhere = 0;
    for (let i = 1; i <= RUNS; i++) {
      const { text, usage } = await engine.complete(c.input, { model: MODEL, system: composeSystemPrompt(r.modes.t2v) });
      spent += usage?.estimated_cost ?? 0;
      const t = text.trim();
      const open = firstSentence(t);
      const all = c.keep.every((re) => re.test(t));
      const first = c.keep.every((re) => re.test(open));
      const sentences = t.split(/(?<=[.!?])\s+/);
      const closeIdx = sentences.findIndex((s) => /^The overall (composition|mood)/i.test(s));
      const row = {
        case: c.id, tag, run: i, allStated: all, inOpening: first,
        paragraphs: t.split(/\n\s*\n/).length, closings: (t.match(/The overall (composition|mood)/gi) || []).length,
        closeIsLast: closeIdx === sentences.length - 1,
        alphaLine: /alpha channel/i.test(t), rgbaOpen: /^This is an RGBA image/.test(t),
        brand: /Ford|Mustang|Chevrolet|Volkswagen|Toyota|Cadillac|Porsche/.test(t), words: t.split(/\s+/).length, text: t,
      };
      out.push(row);
      if (all) anywhere++;
      if (first) inOpening++;
      console.log(`${c.id} ${tag} ${i}: stated=${all} opening=${first} paras=${row.paragraphs} closings=${row.closings} closeLast=${row.closeIsLast} alpha=${row.alphaLine} rgba=${row.rgbaOpen} brand=${row.brand} words=${row.words}`);
    }
    console.log(`== ${c.id} ${tag}: all stated ${anywhere}/${RUNS}, in opening ${inOpening}/${RUNS}`);
  }
}
console.log(`spent (DeepInfra estimated_cost): $${spent.toFixed(5)}`);
writeFileSync(new URL(NEW_ONLY ? './ab-out3.json' : './ab-out.json', import.meta.url), JSON.stringify(out, null, 2));
