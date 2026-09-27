"""Did MpiH3MaskedPrefix actually preserve the head, and is the seam clean?

Two questions the picture cannot answer by eye, both cheap:

  1. IS THE HEAD THE SOURCE? The preserved frames should be the source's own tail,
     differing only by a VAE round trip. Compared against the source's last N frames.
     If this is wrong the mechanism did not do its job, whatever the clip looks like.
  2. IS THERE A SEAM? Per-frame mean absolute difference across the whole clip. The
     boundary frame (index N) should not stand out against the clip's own motion.
     The guide/keyframe route left a FLASH here - that is what #946-#949 exist to
     patch - and the prefix route claims not to need them.

Usage:  python check_prefix.py out/prefix/MPI591_prefix39_native_00001.mp4 39
"""
import json
import os
import subprocess
import sys

SOURCE = r'G:\ComfyUi\ComfyUI\input\MPI591_062_native.mp4'
W, H = 240, 100          # compare at a small size: this is about structure, not detail


def frames(path, w=W, h=H):
    """Decode to raw grayscale at w x h. Returns a list of bytes, one per frame."""
    out = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-vf', 'scale=%d:%d' % (w, h),
         '-pix_fmt', 'gray', '-f', 'rawvideo', '-'],
        stdout=subprocess.PIPE, check=True).stdout
    n = w * h
    return [out[i:i + n] for i in range(0, len(out), n)]


def mad(a, b):
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def main(clip, context):
    src = frames(SOURCE)
    gen = frames(clip)
    print('source %d frames, generated %d frames, context %d' % (len(src), len(gen), context))

    # 1. the preserved head against the source's own tail
    tail = src[len(src) - context:]
    head = gen[:context]
    head_d = [mad(a, b) for a, b in zip(tail, head)]
    print('\nPRESERVED HEAD vs SOURCE TAIL (0 = identical, VAE round trip is a few units)')
    print('  mean %.2f   max %.2f   first %.2f   last %.2f'
          % (sum(head_d) / len(head_d), max(head_d), head_d[0], head_d[-1]))

    # a control: the same head against a WRONG part of the source, so the number above
    # has something to be small against
    wrong = [mad(src[i], head[i]) for i in range(min(context, len(src)))]
    print('  control, head vs source FROM FRAME 0: mean %.2f' % (sum(wrong) / len(wrong)))

    # 2. the seam
    diffs = [mad(gen[i - 1], gen[i]) for i in range(1, len(gen))]
    body = sorted(diffs)
    median = body[len(body) // 2]
    seam = diffs[context - 1]          # the step from the last preserved frame into new
    print('\nSEAM AT FRAME %d (step from preserved into generated)' % context)
    print('  seam step %.2f   clip median step %.2f   clip max step %.2f'
          % (seam, median, max(diffs)))
    print('  seam is %.2fx the median' % (seam / median if median else 0))
    top = sorted(range(len(diffs)), key=lambda i: -diffs[i])[:5]
    print('  five biggest steps in the clip, frame: step  -> %s'
          % ', '.join('%d: %.1f' % (i + 1, diffs[i]) for i in top))
    print('\n  (a FLASH at the boundary shows up as the seam being the clip maximum;'
          '\n   a clean continuation leaves it in the body of the distribution)')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], int(sys.argv[2]))
