// Build flow-storyboard.mp4 from the _art plates: ground -> idea -> panels 1..6 -> ground.
import { execFileSync } from 'node:child_process';
const FF = 'C:/AI/Mpi/video-tool/node_modules/ffmpeg-static/ffmpeg.exe';
const ART = 'C:/AI/Mpi/Cubric-Vision/_art/';
const plates = ['h-1', 'h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h-1'];
const hold = [0.5, 1.4, 0.25, 0.25, 0.25, 0.25, 0.25, 1.8, 0.3];
const dur = [0.4, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.5]; // transition k: plate k -> k+1
const T = plates.map((_, i) => hold[i] + (dur[i - 1] ?? 0) + (dur[i] ?? 0));
const args = ['-y'];
plates.forEach((p, i) => args.push('-loop', '1', '-t', T[i].toFixed(3), '-r', '24', '-i', ART + p + '.png'));
let fc = plates.map((_, i) => `[${i}:v]format=yuv420p,setsar=1[v${i}]`).join(';');
let prev = 'v0', len = T[0];
for (let k = 0; k < dur.length; k++) {
    const off = len - dur[k];
    const out = k === dur.length - 1 ? 'out' : `x${k}`;
    fc += `;[${prev}][v${k + 1}]xfade=transition=fade:duration=${dur[k]}:offset=${off.toFixed(3)}[${out}]`;
    prev = out; len = len + T[k + 1] - dur[k];
}
args.push('-filter_complex', fc, '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/display/flow-storyboard.mp4');
console.log('length', len.toFixed(2));
execFileSync(FF, args, { stdio: ['ignore', 'ignore', 'inherit'] });
