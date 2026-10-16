// MPI-1086 r47: the injectionParams + prompt the APP builds for each qh47 case, so the bench runs the shipped strings.
// usage: node qh47_params.mjs <cases.json> > <params.json>   cases: [{tag, values}]
import fs from 'node:fs';
import { characterSheetEditor } from '../../../../../../js/data/flowPrompts/characterSheetEditor.js';

const cases = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = cases.map(({ tag, values }) => {
    const { positive, injectionParams } = characterSheetEditor('change', values);
    return { tag, positive, injectionParams };
});
process.stdout.write(JSON.stringify(out, null, 1));
