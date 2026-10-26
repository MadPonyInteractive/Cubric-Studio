// MPI-1039 round 64 check: the Flow's two-person turn words rebuild round 64's prompts word for word.
// stdin: {"<source>|<stop>": prompt} (r64.py's words); exit 1 on any difference.
import { multiAnglePlan } from '../../../../../js/data/flowPrompts/multiAngle.js';

const bench = JSON.parse(await new Promise(r => { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => r(s)); }));
const FACTS = {
    'photo two': { people: 2 },
    'anime two': { people: 2, drawing: { noun: 'anime', style: 'flat 2D anime drawing style', marks: 'clean outlines, flat colours' } },
};
let bad = 0;
for (const [key, prompt] of Object.entries(bench)) {
    const [name, stop] = key.split('|');
    const mine = multiAnglePlan({ turn: stop }, FACTS[name]).steps[0].prompt;
    if (mine !== prompt) { bad++; console.log(`DIFF ${key}\n bench: ${prompt}\n flow:  ${mine}`); }
}
console.log(`${Object.keys(bench).length - bad} same, ${bad} different`);
process.exit(bad ? 1 : 0);
