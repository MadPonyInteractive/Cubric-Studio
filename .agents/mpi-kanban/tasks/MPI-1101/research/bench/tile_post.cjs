// MPI-1101 tile bench post: seamScore (services/seamlessOps) of each output on window 0's seam, plus 1:1 crops
// across the seam (x = 2048 of the 4096 window) at 1/4, 1/2, 3/4 height, side by side with the inputs.
// usage (repo root): node .agents/mpi-kanban/tasks/MPI-1101/research/bench/tile_post.cjs <runDir> <outDir>
const fs = require('fs'), path = require('path');
const sharp = require('../../../../../../node_modules/sharp'); sharp.cache({ files: 0 });
const { seamScore } = require('../../../../../../services/seamlessOps');
const [runDir, outDir] = process.argv.slice(2);
const win = JSON.parse(fs.readFileSync(path.join(runDir, 'state.json'), 'utf8')).windows[0];
const grey = async (f) => {
    const { data, info } = await sharp(f, { limitInputPixels: false }).resize(win.rect.width, win.rect.height, { fit: 'fill' })
        .removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data };
};
(async () => {
    const files = [['raw (cut shown)', path.join(runDir, 'win_0_img.png')], ['LanPaint', path.join(runDir, 'win_0_result.png')],
        ...fs.readdirSync(outDir).filter(f => f.endsWith('.png')).sort().map(f => [f.replace(/_\d+_\.png$/, ''), path.join(outDir, f)])];
    for (const [name, f] of files) {
        const s = seamScore(win, await grey(f));
        console.log(name.padEnd(16), s ? `edge ${s.edge.toFixed(1)}  divider ${s.divider.toFixed(0)}` : 'n/a');
        for (const fy of [0.25, 0.5, 0.75]) {
            await sharp(f, { limitInputPixels: false }).extract({ left: 2048 - 512, top: Math.round(4096 * fy) - 384, width: 1024, height: 768 })
                .jpeg({ quality: 90 }).toFile(path.join(outDir, `crop_${name.split(' ')[0]}_y${fy * 100}.jpg`));
        }
    }
})();
