// MPI-1039 round 58 prompts: two ways to the rear-left stop from a FLUX.3-made front (round 55 T: 0/4).
//   W = tq_bl words in the shape of the 3/4 front words: the camera's move named, every near/far part named.
//   M = the Flow's own tq_br words, from the describe text with LEFT/RIGHT and one-sided sides swapped - for the
//       front flipped left-right; the result is flipped back.
// stdin: {"<input>": "<describe text>"}; stdout: {"<input>|W": prompt, "<input>|M": prompt}
import { multiAnglePlan, parseMultiAngleFacts } from '../../../../../js/data/flowPrompts/multiAngle.js';

const FORMS = { she: ['she', 'her', 'her', 'is'], he: ['he', 'him', 'his', 'is'], they: ['they', 'them', 'their', 'are'] };
const cap = s => s[0].toUpperCase() + s.slice(1);

function mirrored(text) {
    return text.split(/\r?\n/).map((line) => {
        if (/^\s*LEFT\s*:/.test(line)) return line.replace(/^(\s*)LEFT/, '$1RIGHT');
        if (/^\s*RIGHT\s*:/.test(line)) return line.replace(/^(\s*)RIGHT/, '$1LEFT');
        if (/^\s*ONE_SIDED\s*:/.test(line)) {
            return line.replace(/\|\s*(left|right)\s*\|/gi, (_, s) => `| ${s.toLowerCase() === 'left' ? 'right' : 'left'} |`);
        }
        return line;
    }).join('\n');
}

const texts = JSON.parse(await new Promise(r => { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => r(s)); }));
const out = {};
for (const [name, text] of Object.entries(texts)) {
    const facts = parseMultiAngleFacts(text).facts;
    const turn = multiAnglePlan({ turn: 'tq_bl' }, facts).steps.find(s => s.kind === 'turn').prompt;
    const [subj, obj, poss, is] = FORMS[facts.pronoun] || FORMS.they;
    const head = 'Shift the viewpoint of the first image around the subject to match the mannequin reference in the '
        + 'second image: ';
    const tail = turn.slice(turn.indexOf(' Take only the viewing angle'));
    const reveal = facts.turnReveal?.tq_bl || `The place around ${obj} is seen from that angle.`;
    out[`${name}|W`] = `${head}the camera has moved three-quarters of the way round to ${poss} left, behind ${obj}, so `
        + `${subj} ${is} now seen from behind ${poss} left shoulder. ${cap(poss)} back is to the view and ${poss} whole `
        + 'body faces away at an angle toward frame-left: the back of '
        + `${poss} left shoulder, ${poss} left arm and ${poss} left leg are nearest the view, ${poss} right shoulder is `
        + `beyond ${poss} back, ${poss} feet point away toward the upper-left, and ${poss} face is turned away toward `
        + `frame-left with only the edge of ${poss} left cheek showing past the back of ${poss} head. ${reveal}` + tail;
    out[`${name}|M`] = multiAnglePlan({ turn: 'tq_br' }, parseMultiAngleFacts(mirrored(text)).facts)
        .steps.find(s => s.kind === 'turn').prompt;
}
process.stdout.write(JSON.stringify(out, null, 1));
