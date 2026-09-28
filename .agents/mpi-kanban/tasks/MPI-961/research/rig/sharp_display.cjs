// D2 experiment, server half: sharp -> 4096 webp display copy from each original.
const sharp = require('C:/AI/Mpi/Cubric-Vision/node_modules/sharp');
const path = require('path');
const os = require('os');
const M = path.join(__dirname, 'docs', 'Cubric Vision', 'Projects', 'Big Photos Test', 'Media');
(async () => {
    console.log('sharp', sharp.versions.sharp, 'vips', sharp.versions.vips, 'concurrency', sharp.concurrency());
    for (const f of ['imageUpscale_001.png', 'imageUpscale_002.png', 'imported_002.jpg']) {
        const out = path.join(os.tmpdir(), `mpi961-${f}.display.webp`);
        const t = Date.now();
        const rss0 = process.memoryUsage().rss;
        const info = await sharp(path.join(M, f), { limitInputPixels: false })
            .rotate()
            .resize(4096, 4096, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 90 })
            .toFile(out);
        console.log(f, `${Date.now() - t} ms`, `${info.width}x${info.height}`, `${(info.size / 1e6).toFixed(1)} MB`, `rss +${((process.memoryUsage().rss - rss0) / 1e6).toFixed(0)} MB`);
    }
})();
