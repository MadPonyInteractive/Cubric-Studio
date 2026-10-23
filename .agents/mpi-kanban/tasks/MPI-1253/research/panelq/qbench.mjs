// MPI-1253: the Create boxes question with and without "a solid panel or band of color that
// text sits on", Gemma 4 26B (the app's DeepInfra describer), temperature 0, Fabio's 5 test
// pictures. usage: node qbench.mjs <head|new> [picture...]   |   node qbench.mjs --show
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const sharp = require('C:/AI/Mpi/Cubric-Vision/node_modules/sharp');
const SP = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/6b001ec6-c8d1-447d-a174-232589a7f17b/scratchpad/';
const MEDIA = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/d97e027a-503d-4722-be51-dca53a2c0014/scratchpad/BoxesTest3/Media/';
const PICS = { vogue: 'imported_30664391.jpg', bazaar: 'imported_84aa4697.jpg', tokyo: 'imported_23c5448e.jpg', mood: 'imported_30664392.jpg', story: 'imported_30664393.jpg' };
const MODEL = 'google/gemma-4-26B-A4B-it';
const NEW = await import('file:///C:/AI/Mpi/Cubric-Vision/js/data/layoutBoxes.js');
const pixels = async (file) => {
    const { data, info } = await sharp(file).resize({ width: 1024, height: 1024, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, channels: info.channels };
};

if (process.argv[2] === '--show') {
    for (const pic of Object.keys(PICS)) {
        const img = await pixels(MEDIA + PICS[pic]);
        for (const v of ['head', 'new']) {
            const f = `${SP}q_${v}_${pic}.txt`;
            if (!fs.existsSync(f)) continue;
            const found = NEW.fitAnalysis(fs.readFileSync(f, 'utf8'), img);
            console.log(`${pic} ${v}: ${found?.boxes.length} boxes, snapped ${found?.snapped}, order ${found?.order}`);
            console.log('   ' + (found?.boxes || []).map((b) => b.name + (b.kind === 'text' ? '*' : '')).join(' '));
        }
    }
} else {
    const v = process.argv[2];
    const lib = v === 'head' ? await import('file:///' + SP + 'head/layoutBoxes.js') : NEW;
    const key = fs.readFileSync('C:/Users/Fabio/.secrets/di.txt', 'utf8').trim();
    let spent = 0;
    await Promise.all((process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(PICS)).map(async (pic) => {
        const img = await sharp(MEDIA + PICS[pic]).jpeg({ quality: 90 }).toBuffer();
        const t0 = Date.now();
        const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({ model: MODEL, temperature: 0, messages: [{ role: 'user', content: [
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.toString('base64')}` } },
                { type: 'text', text: lib.analyseQuestion('gemma') }] }] }),
        });
        const body = await res.json();
        const text = body.choices?.[0]?.message?.content || JSON.stringify(body).slice(0, 600);
        fs.writeFileSync(`${SP}q_${v}_${pic}.txt`, text);
        spent += Number(body.usage?.estimated_cost || 0);
        console.log(`${pic} ${v}: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${body.usage?.completion_tokens} tok, $${Number(body.usage?.estimated_cost || 0).toFixed(5)}`);
    }));
    console.log(`spent $${spent.toFixed(5)}`);
}
