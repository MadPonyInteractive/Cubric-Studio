// MPI-1039 round 52 prompts: the Flow's own turn pass (multiAnglePlan) on a picture that is ALREADY turned (A), and
// the same words with the "camera has moved round" step taken out, so they name only the end view (B).
// stdin: {"<input cell>": "<describe text>"}; stdout: {"<input>|<target>|<A|B>": prompt}
import { multiAnglePlan, parseMultiAngleFacts } from '../../../../../js/data/flowPrompts/multiAngle.js';

const TARGETS = ['front', 'tq_fl', 'pr_r', 'tq_br'];
const texts = JSON.parse(await new Promise(r => { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => r(s)); }));
const out = {};
for (const [cell, text] of Object.entries(texts)) {
    const facts = parseMultiAngleFacts(text);
    for (const t of TARGETS) {
        const turnStep = multiAnglePlan({ turn: t }, facts).steps.find(s => s.kind === 'turn');
        if (turnStep) {
            out[`${cell}|${t}|A`] = turnStep.prompt;
            out[`${cell}|${t}|B`] = turnStep.prompt.replace(/the camera has moved [^,]+, so (\S+) (is|are) now seen /,
                '$1 $2 seen ');
        } else { // the Flow sends nothing for 'front'; B writes the front as an end view, with the profile's tail
            const tail = multiAnglePlan({ turn: 'pr_l' }, facts).steps[0].prompt.split(' Take only the viewing angle')[1];
            const p = facts.pronoun === 'he' ? ['he', 'his', 'him'] : facts.pronoun === 'they' ? ['they', 'their', 'them'] : ['she', 'her', 'her'];
            out[`${cell}|${t}|B`] = 'Shift the viewpoint of the first image around the subject to match the mannequin '
                + `reference in the second image: ${p[0]} ${p[0] === 'they' ? 'are' : 'is'} seen straight from the front `
                + `at eye level, facing the camera: ${p[1]} whole face with both eyes, ${p[1]} chest and both shoulders `
                + `face the view, and ${p[1]} feet point toward the camera. The place around ${p[2]} is seen from that `
                + `angle. Take only the viewing angle${tail}`;
        }
    }
}
process.stdout.write(JSON.stringify(out, null, 1));
