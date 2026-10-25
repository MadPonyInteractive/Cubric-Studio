// Rent the MPI-1135 bench Pod on the cubric-h3-bench volume. Prints the Pod id only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const KEY = /^RUNPOD_API_KEY=(.+)$/m.exec(fs.readFileSync(process.env.RUNPOD_ENV_FILE, 'utf8'))[1].trim();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const boot = fs.readFileSync(path.join(here, 'boot.sh'));
const body = {
    name: 'cubric-h3-bench',
    cloud: 'SECURE',
    image: 'runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2204',
    disk: 150, // boot.sh copies every weight (~118 GB) here: the volume is ~4x slower to load from
    ports: ['8188/http', '22/tcp'],
    entrypoint: ['bash', '-c', 'echo "$BOOT_B64" | base64 -d > /tmp/boot.sh && bash /tmp/boot.sh'],
    env: {
        BOOT_B64: boot.toString('base64'),
        PUBLIC_KEY: fs.readFileSync(path.join(os.homedir(), '.ssh', 'id_ed25519.pub'), 'utf8').trim(),
        HARD_MIN: '240',
    },
    gpu: { id: 'NVIDIA RTX PRO 4500 Blackwell', count: 1, minCudaVersion: '13.0', minRamPerGpu: 62 },
    dataCenterIds: ['EU-RO-1'],
    mounts: { network: [{ volumeId: 'l545j38pyx', path: '/workspace' }] },
};
const res = await fetch('https://api.runpod.io/v2/pods', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(body),
});
const j = await res.json().catch(() => ({}));
console.log(res.status, j.id || JSON.stringify(j).replaceAll(KEY, '<key>').slice(0, 600));
if (j.id) console.log('rate', j.costPerHr ?? j.adjustedCostPerHr ?? '?', 'machine', j.machine?.dataCenterId ?? '');
