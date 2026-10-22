// MPI-1243 heal: the field request, enhanced N times through the moss-image recipe.
// node docs/recipes/research/moss-image/skydiver_check.mjs [ollamaModel] [runs] [--deepinfra]
import { getRecipe } from '../../../../js/data/recipes/registry.js';
import { composeSystemPrompt } from '../../../../js/data/recipes/styles.js';
import { OllamaEngine, DeepInfraEngine } from '../../../../scripts/recipe-engines.mjs';

const REQUEST = 'A woman skydiving. Photograph taken from the plane as she jumps out of it. ';
const [model = 'gemma3:12b', runs = '3'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const engine = process.argv.includes('--deepinfra') ? new DeepInfraEngine() : new OllamaEngine();
const mode = getRecipe('moss-image').modes.t2v;
const banned = mode.forbiddenPatterns.map(p => [new RegExp(p.pattern, 'im'), p.why]);
for (let i = 1; i <= Number(runs); i++) {
    const { text } = await engine.complete(REQUEST, { model, system: composeSystemPrompt(mode, 'general') });
    const out = text.trim();
    const hits = banned.filter(([re]) => re.test(out)).map(([, why]) => why);
    console.log(`--- run ${i} (${out.split(/\s+/).length} words)${hits.length ? ' FORBIDDEN: ' + hits.join(', ') : ''}\n${out}\n`);
}
