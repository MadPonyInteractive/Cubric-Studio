// Rent a CPU Pod on the cubric-h3-bench volume to fill the weights only (boot.sh WEIGHTS_ONLY=1).
// A throttled Hugging Face download then waits at CPU price, not GPU price. Prints the Pod id only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const KEY = /^RUNPOD_API_KEY=(.+)$/m.exec(fs.readFileSync(process.env.RUNPOD_ENV_FILE, 'utf8'))[1].trim();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const boot = fs.readFileSync(path.join(here, 'boot.sh'));
const body = {
    name: 'cubric-h3-bench-fill',
    cloudType: 'SECURE',
    computeType: 'CPU',
    cpuFlavorIds: ['cpu3c', 'cpu5c', 'cpu3g', 'cpu5g'],
    vcpuCount: 4,
    imageName: 'ubuntu:22.04',
    containerDiskInGb: 10,
    ports: ['22/tcp'],
    dockerEntrypoint: ['bash', '-c', 'echo "$BOOT_B64" | base64 -d > /tmp/boot.sh && bash /tmp/boot.sh'],
    env: {
        BOOT_B64: boot.toString('base64'),
        PUBLIC_KEY: fs.readFileSync(path.join(os.homedir(), '.ssh', 'id_ed25519.pub'), 'utf8').trim(),
        HARD_MIN: '360',
        WEIGHTS_ONLY: '1',
    },
    dataCenterIds: ['EU-RO-1'],
    networkVolumeId: 'l545j38pyx',
    volumeMountPath: '/workspace',
};
const res = await fetch('https://rest.runpod.io/v1/pods', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(body),
});
const j = await res.json().catch(() => ({}));
console.log(res.status, j.id || JSON.stringify(j).replaceAll(KEY, '<key>').slice(0, 600));
if (j.id) console.log('rate', j.costPerHr ?? j.adjustedCostPerHr ?? '?');
