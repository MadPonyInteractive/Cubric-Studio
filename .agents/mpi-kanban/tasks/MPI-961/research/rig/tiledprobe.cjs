// MPI-961 S2 probe (run from a scratch copy of this rig folder, after copy_fixture.py): pyramidal tiled TIFF per big photo -> on-screen region reads.
const path = require('path');
const fs = require('C:/AI/Mpi/Cubric-Vision/node_modules/fs-extra');
const sharp = require('C:/AI/Mpi/Cubric-Vision/node_modules/sharp');
sharp.cache({ files: 0 });
const MEDIA = path.join(__dirname, 'docs', 'Cubric Vision', 'Projects', 'Big Photos Test', 'Media');
const OUT = path.join(__dirname, 'tiled');
const ms = (t) => Math.round(performance.now() - t);
(async () => {
  await fs.ensureDir(OUT);
  for (const f of ['imageUpscale_002.png', 'imported_002.jpg']) {
    const src = path.join(MEDIA, f);
    const meta = await sharp(src, { limitInputPixels: false }).metadata();
    const tif = path.join(OUT, f + '.tif');
    let t = performance.now();
    await sharp(src, { limitInputPixels: false }).rotate()
      .tiff({ tile: true, tileWidth: 512, tileHeight: 512, pyramid: true, compression: 'jpeg', quality: 90 })
      .toFile(tif);
    const build = ms(t);
    const size = (await fs.stat(tif)).size;
    const pages = (await sharp(tif, { limitInputPixels: false }).metadata()).pages;
    // Full-res on-screen region (1600x900 image px at 1:1), three spots.
    const reads = [];
    for (const [x, y] of [[1000, 1000], [meta.width / 2, meta.height / 2], [meta.width - 2000, meta.height - 1200]]) {
      t = performance.now();
      await sharp(tif, { limitInputPixels: false }).extract({ left: Math.round(x), top: Math.round(y), width: 1600, height: 900 }).raw().toBuffer();
      reads.push(ms(t));
    }
    // A region at 1/4 scale: read from pyramid page 2 (each page halves).
    t = performance.now();
    await sharp(tif, { limitInputPixels: false, page: 2 }).extract({ left: 500, top: 500, width: 1600, height: 900 }).raw().toBuffer();
    const pageRead = ms(t);
    console.log(JSON.stringify({ f, w: meta.width, h: meta.height, srcMB: +((await fs.stat(src)).size / 1e6).toFixed(1), buildMs: build, tifMB: +(size / 1e6).toFixed(1), pages, fullResRegionMs: reads, page2RegionMs: pageRead }));
  }
})().catch((e) => { console.error(e); process.exit(1); });
