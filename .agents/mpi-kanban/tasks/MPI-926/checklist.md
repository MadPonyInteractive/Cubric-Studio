# MPI-926 Checklist

- [x] Reproduce: 16384x16384 JPEG, `extractImageThumb` returns null (`Picture size 16384x16384 is invalid`).
- [x] Images past ffmpeg's compiled-in limit thumbnail through sharp: upright (EXIF, as ffmpeg does), same widths, WebP q82, alpha kept.
- [x] Every image ffmpeg can decode keeps the ffmpeg path unchanged (BMP included - sharp cannot read it).
- [x] Test with a real past-limit, EXIF-rotated photo; save-generation writes a thumbPath for a 16K result.
- [x] docs/gallery.md names the split.
