// Print each new BENCH line from the Pod's log; exit when ComfyUI answers or after 40 min.
import fs from 'node:fs';
const KEY = /^RUNPOD_API_KEY=(.+)$/m.exec(fs.readFileSync(process.env.RUNPOD_ENV_FILE, 'utf8'))[1].trim();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const id = process.argv[2];
const seen = new Set();
const t0 = Date.now();
while (Date.now() - t0 < 40 * 60e3) {
    try {
        const r = await fetch(`https://api.runpod.io/v2/pods/${id}/logs?tail=200`, { headers: { Authorization: `Bearer ${KEY}`, 'User-Agent': UA }, signal: AbortSignal.timeout(10e3) });
        const t = await r.text();
        for (const l of t.split(/\\n|\n/)) if (/BENCH|Error|error:|Traceback/.test(l) && !seen.has(l)) { seen.add(l); console.log(Math.round((Date.now() - t0) / 1000) + 's', l.slice(0, 220)); }
    } catch {}
    try {
        const c = await fetch(`https://${id}-8188.proxy.runpod.net/system_stats`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8e3) });
        if (c.ok) { console.log('COMFY_READY', Math.round((Date.now() - t0) / 1000) + 's'); process.exit(0); }
    } catch {}
    await new Promise((r) => setTimeout(r, 20e3));
}
console.log('TIMEOUT');
