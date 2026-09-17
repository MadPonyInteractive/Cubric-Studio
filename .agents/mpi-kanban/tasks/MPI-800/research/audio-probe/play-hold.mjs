import { chromium } from 'file:///C:/Users/Fabio/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright/index.mjs';

const port = process.argv[2] || '9334';
const seconds = Number(process.argv[3] || 25);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const page = browser.contexts()[0].pages()[0];
const MEDIA = 'C:\\Users\\Fabio\\AppData\\Local\\Temp\\claude\\C--AI-Mpi-Cubric-Vision\\82de54a1-ff0b-48b7-9264-527ba466dda3\\scratchpad\\projects\\MPI-800 staging C\\Media\\t2v_001.mp4';

await page.evaluate(async (mediaPath) => {
    document.querySelectorAll('video[data-probe]').forEach(v => v.remove());
    const v = document.createElement('video');
    v.dataset.probe = '1';
    v.src = '/project-file?path=' + encodeURIComponent(mediaPath);
    v.loop = true; v.volume = 1; v.muted = false;
    document.body.appendChild(v);
    await v.play();
    window.__probeVideo = v;
}, MEDIA);
console.log('playing (looping) for', seconds, 's');
await new Promise(r => setTimeout(r, seconds * 1000));
const state = await page.evaluate(() => {
    const v = window.__probeVideo;
    const s = { t: v.currentTime, paused: v.paused, audioBytes: v.webkitAudioDecodedByteCount };
    v.pause(); v.remove();
    return s;
});
console.log('stopped:', JSON.stringify(state));
await browser.close();
