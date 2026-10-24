// Tiny RunPod v2 client for the MPI-1135 bench. Key from RUNPOD_ENV_FILE, never printed.
// usage: node rp.mjs GET /path   |   node rp.mjs POST /path '<json>'   |   node rp.mjs DELETE /path
import fs from 'node:fs';
const m = /^RUNPOD_API_KEY=(.+)$/m.exec(fs.readFileSync(process.env.RUNPOD_ENV_FILE, 'utf8'));
if (!m) { console.error('no key'); process.exit(2); }
const KEY = m[1].trim();
const [method, p, body] = process.argv.slice(2);
const res = await fetch('https://api.runpod.io/v2' + p, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
    body: body || undefined,
});
const text = await res.text();
console.log(res.status);
console.log(text.replaceAll(KEY, '<key>'));
