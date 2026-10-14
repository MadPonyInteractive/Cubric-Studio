// Column step profile: mean |col x - col x-1| over rows [y0,y1), for x in [x0,x1); prints the top steps and the mask there.
const sharp = require('C:/AI/Mpi/Cubric-Vision/node_modules/sharp'); sharp.cache({ files: 0 });
const [dir] = process.argv.slice(2);
const load = async f => { const { data, info } = await sharp(f).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
(async () => {
  const mask = await load(dir + '/win_0_mask.png');
  for (const k of ['img', 'result']) {
    const { d, w } = await load(`${dir}/win_0_${k}.png`);
    const steps = [];
    for (let x = 1900; x < 2200; x++) { let s = 0; for (let y = 0; y < 2048; y++) s += Math.abs(d[y * w + x] - d[y * w + x - 1]); steps.push([x, s / 2048]); }
    const med = steps.map(s => s[1]).sort((a, b) => a - b)[150];
    console.log(k, 'median', med.toFixed(1), 'top', steps.sort((a, b) => b[1] - a[1]).slice(0, 5).map(([x, v]) => `${x}:${v.toFixed(1)}`).join(' '));
  }
  console.log('mask at row 1000, x 2040..2056:', Array.from({ length: 17 }, (_, i) => mask.d[1000 * mask.w + 2040 + i]).join(','));
  console.log('mask at row 1000, x 410,800,1200,1720,2048:', [410, 800, 1200, 1720, 2048].map(x => mask.d[1000 * mask.w + x]).join(','));
})();
