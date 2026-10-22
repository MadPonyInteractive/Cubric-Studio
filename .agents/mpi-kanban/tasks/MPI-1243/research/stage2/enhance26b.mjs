// The app's endpoint enhance (routes/llm.js -> DeepInfraEngine.complete) on the DeepInfra
// recommended enhancer, with the moss-image recipe's system prompt. Three calls, no retries.
import fs from 'node:fs';
import { DeepInfraEngine } from 'file:///C:/AI/Mpi/Cubric-Vision/services/llmEngines.mjs';
import { getRecipe } from 'file:///C:/AI/Mpi/Cubric-Vision/js/data/recipes/registry.js';
import { composeSystemPrompt } from 'file:///C:/AI/Mpi/Cubric-Vision/js/data/recipes/styles.js';

const SP = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/1394a049-1a69-4801-af72-4444bf14162b/scratchpad/';
const ideas = ["a vintage travel poster for Lisbon that says 'VISIT LISBOA'", 'a fox reading a book under a tree at dusk', 'an old fisherman mending nets on a pier at sunrise'];
const system = composeSystemPrompt(getRecipe('moss-image').modes.t2v);
const engine = new DeepInfraEngine();
const out = [];
for (const idea of ideas) {
  const t0 = Date.now();
  const r = await engine.complete(idea, { model: 'google/gemma-4-26B-A4B-it', system });
  const text = String(r.text || '').trim();
  out.push({ idea, ms: Date.now() - t0, words: text.split(/\s+/).length, model: r.model, usage: r.usage, text });
  console.log(JSON.stringify(out.at(-1)));
}
fs.writeFileSync(SP + 'enhanced26b.json', JSON.stringify(out, null, 2));
