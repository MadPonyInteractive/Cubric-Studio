// MPI-1232 Phase 3 bench helper: the APP's own tile rects (cut order) + outlined pictures for a picture.
//   node outlines.mjs <input.png> <tile> <factor>  ->  JSON { rects, images } on stdout
import { createRequire } from 'node:module';
import { tileRects } from '../../../../../js/utils/tileCount.js';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { outlineTiles } = require('../../../../../services/tileOutlines.js');

const [src, tile, factor] = process.argv.slice(2);
const { width, height } = await sharp(src).metadata();
const rects = tileRects(width, height, Number(factor), { bbox: Number(tile) });
const iw = Math.max(...rects.map((r) => r.x2)), ih = Math.max(...rects.map((r) => r.y2));
const images = await outlineTiles(src, rects.map((r) => ({ x1: r.x1 / iw, y1: r.y1 / ih, x2: r.x2 / iw, y2: r.y2 / ih })));
process.stdout.write(JSON.stringify({ rects, images }));
