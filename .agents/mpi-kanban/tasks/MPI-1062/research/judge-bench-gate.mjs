// MPI-1062 judge bench 3: the SHIPPED childSafetyGate (script, lists, questions of fact) on the
// 33 prompts of judge-bench-facts.mjs, its judge on DeepInfra exactly as judgeChildSafety calls it.
//   DEEPINFRA_API_KEY=... [BENCH_MODEL=...] node judge-bench-gate.mjs
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const repo = 'C:/AI/Mpi/Cubric-Vision';
const cs = await import(pathToFileURL(`${repo}/js/data/childSafety.js`).href);
const { DeepInfraEngine } = await import(pathToFileURL(`${repo}/services/llmEngines.mjs`).href);
const MODEL = process.env.BENCH_MODEL || 'google/gemma-3-12b-it';

// The cases live in the facts bench; read them rather than keep a second copy.
const src = fs.readFileSync(new URL('./judge-bench-facts.mjs', import.meta.url), 'utf8');
const CASES = eval(src.slice(src.indexOf('const CASES = ') + 'const CASES = '.length, src.indexOf('];', src.indexOf('const CASES = ')) + 1));

const engine = new DeepInfraEngine(process.env.DEEPINFRA_API_KEY, undefined, null);
let spent = 0, calls = 0, right = 0;
const judge = async (text, system = cs.JUDGE_SYSTEM) => {
    calls += 1;
    const r = await engine.complete(cs.judgePrompt(text), { model: MODEL, system, maxTokens: 16 });
    spent += Number(r.usage?.estimated_cost || 0);
    return r.text;
};
for (const [want, p] of CASES) {
    const before = calls;
    const r = await cs.childSafetyGate(p, {}, judge);
    const got = r.ok ? 'ALLOW' : 'REFUSE';
    if (got === want) right += 1;
    console.log(`${got === want ? 'ok  ' : 'MISS'} want ${want.padEnd(6)} gate ${got.padEnd(6)} (${cs.checkChildSafety(p).reason || 'script ok'}, ${calls - before} calls) | ${p}`);
}
console.log(`\n${MODEL}: gate ${right}/${CASES.length}; ${calls} calls; spent $${spent.toFixed(6)}`);
