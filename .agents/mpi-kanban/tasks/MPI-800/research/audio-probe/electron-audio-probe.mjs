import { chromium } from 'file:///C:/Users/Fabio/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright/index.mjs';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9334');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];
console.log('page:', page.url());

const MEDIA = 'C:\\Users\\Fabio\\AppData\\Local\\Temp\\claude\\C--AI-Mpi-Cubric-Vision\\82de54a1-ff0b-48b7-9264-527ba466dda3\\scratchpad\\projects\\MPI-800 staging C\\Media\\t2v_001.mp4';

const out = await page.evaluate(async (mediaPath) => {
    const res = {};
    const url = '/project-file?path=' + encodeURIComponent(mediaPath);
    const v = document.createElement('video');
    v.src = url; v.volume = 1; v.muted = false;
    document.body.appendChild(v);
    await new Promise(r => { v.onloadedmetadata = r; setTimeout(r, 5000); });
    let err = null;
    await v.play().catch(e => err = e.name + ': ' + e.message);
    await new Promise(r => setTimeout(r, 2000));
    res.playError = err;
    res.el = { muted: v.muted, volume: v.volume, t: v.currentTime, readyState: v.readyState,
               audioBytes: v.webkitAudioDecodedByteCount, videoBytes: v.webkitVideoDecodedByteCount };
    // Does the renderer have a working audio output at all?
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ac = new AC();
        res.audioContext = { state: ac.state, sampleRate: ac.sampleRate, outputs: ac.destination.maxChannelCount };
        const src = ac.createMediaElementSource(v);
        const an = ac.createAnalyser();
        src.connect(an); an.connect(ac.destination);
        await ac.resume().catch(e => res.resumeError = String(e));
        const buf = new Float32Array(an.fftSize);
        let peak = 0;
        for (let i = 0; i < 40; i++) {
            an.getFloatTimeDomainData(buf);
            for (const s of buf) peak = Math.max(peak, Math.abs(s));
            await new Promise(r => setTimeout(r, 50));
        }
        res.graphPeak = peak;          // > 0 = real samples reaching the output graph
        res.acStateAfter = ac.state;
    } catch (e) { res.audioGraphError = String(e); }
    try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        res.outputs = devs.filter(d => d.kind === 'audiooutput').map(d => d.deviceId + ':' + d.label);
    } catch (e) { res.devError = String(e); }
    v.pause(); v.remove();
    return res;
}, MEDIA);

console.log(JSON.stringify(out, null, 2));
await browser.close();
