"""The SHIPPABLE context mechanism: MpiH3MaskedPrefix instead of MiniMaxH3MotionContext.

WHY THIS ARM EXISTS. Every corpus-2 arm so far pinned its context with
`MiniMaxH3MotionContext`, from the third-party ComfyUI-H3-Motion-Context pack. That
node is safe-loaded on the bench and NEVER enters node_lock.json (D6), so nothing
proven on it can ship. `MpiH3MaskedPrefix` is our own, already in MpiNodes and already
pinned at 1.2.16, and it does the same job by a different route: it writes the prior
clip's encoded tail into the front of the target latent and masks that region out of
sampling. Nothing is regenerated, so no stitch, no flash frame and no colour match.

TWO THINGS MOVE AGAINST arm_speech_c2_10step.json, deliberately:

  1. THE MECHANISM.  #601 MotionContext  ->  #602 MpiH3EncodeAV + #603 MpiH3MaskedPrefix
     The conditioning now goes straight from #472 to the guider: the prefix owns the
     preserved head, and a first-frame guide inside it fights the prefix.
  2. THE RESOLUTION.  1152x480 -> the source's NATIVE 1920x800.
     The shipped flow never downscales (ImageResizeKJv2 crops to /32 from MpiLoadVideo's
     own size), so 1152x480 is a resolution no user ever sees, and it is where the
     "melted face" came from - at 1152x480 a face this size is 1.7 DiT tokens tall,
     at native 2.6. Native is the only honest picture judgement.

THE GRID IS DIFFERENT FROM MotionContext'S, and this kills the queued "default 56".
MpiH3MaskedPrefix snaps context DOWN to 39 / 90 / 141 ...: those lengths sit on H3's
17k+5 video grid AND divide by 3, so audio's 40 Hz clock lands on a whole step too.
56 is on the video grid but NOT divisible by 3, so it is unreachable here. The two
neighbours of Fabio's "about 2 seconds" are therefore 39 (1.625 s) and 90 (3.75 s),
and which one ships is what these two arms are for.

BOTH ARMS PRODUCE EXACTLY 102 NEW FRAMES, so they are directly comparable to each
other and to the approved arm:
    ctx 39: a=4 -> 4 + 39/24 = 5.625 s = 135 frames -> MpiH3Length rounds UP to 141
            141 - 39 = 102
    ctx 90: a=4 -> 4 + 90/24 = 7.75 s = 186 frames -> rounds UP to 192
            192 - 90 = 102
Everything else is held: 10 steps, shift_audio 1, fl2v turbo LoRA on, beta/euler,
seed 591000591, and the SAME approved prompt - so the only question either arm
answers is how much context the mechanism needs.

WHAT THE PRESERVED HEAD CONTAINS (062 cuts hard at 3.200 s = frame 76.8):
    ctx 39 -> frames 85-123, entirely AFTER the cut: the eyes ECU only.
    ctx 90 -> frames 34-123, so the head REPLAYS the cut: wide -> cut -> eyes.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'arm_speech_c2_10step.json')

# THE SOURCE MUST SIT INSIDE THE BENCH'S input/ FOLDER, and this is new since the
# corpus-2 arms ran. MPI-800 tightened MpiLoadVideo: `string` is now "relative to
# ComfyUI's input/ folder (an absolute path must be inside input/, output/ or
# temp/)". An outside path is treated as MISSING, and with block_if_empty ON that
# returns an ExecutionBlocker rather than raising - so the prompt comes back
# "success" in ~20 s having executed only the loaders, with `outputs: {}` and not
# one line of error anywhere. It cost a dispatch on 2026-09-27. Every arm written
# before MPI-800 carries an absolute out/corpus2/ path and will fail the same
# silent way if re-run.
NATIVE = 'MPI591_062_native.mp4'          # <bench>/input/MPI591_062_native.mp4
NATIVE_FROM = r'C:\Users\Fabio\Documents\Cubric Vision\Projects\cowboys\Media\ref2v_ms_062.mp4'
BENCH_INPUT = r'G:\ComfyUi\ComfyUI\input'
WIDTH, HEIGHT = 1920, 800


def build(context_frames, dst):
    g = json.load(open(SRC))

    # --- the source, at its native size
    g['600']['inputs']['string'] = NATIVE
    g['167']['inputs']['int'] = WIDTH
    g['168']['inputs']['int'] = HEIGHT

    # --- out with MotionContext, in with the two first-party nodes
    del g['601']
    g['602'] = {
        'class_type': 'MpiH3EncodeAV',
        '_meta': {'title': 'Encode the whole source in ONE call'},
        'inputs': {
            'vae': ['121', 0],
            'images': ['600', 0],
            'audio_vae': ['122', 0],
            'audio': ['600', 1],
        },
    }
    g['603'] = {
        'class_type': 'MpiH3MaskedPrefix',
        '_meta': {'title': 'THE MECHANISM - %d frames preserved, masked out of sampling'
                           % context_frames},
        'inputs': {
            'latent': ['472', 1],
            'context_latent': ['602', 0],
            'context_frames': context_frames,
        },
    }

    # --- rewire: conditioning straight from #472, latent from the prefix
    g['150']['inputs']['conditioning'] = ['472', 0]
    g['153']['inputs']['latent_image'] = ['603', 0]

    # --- the target has to hold the preserved head as well as the new footage
    g['605']['inputs']['math_expression'] = 'a + %d/24' % context_frames
    g['207']['inputs']['filename_prefix'] = 'MPI591_prefix%d_native' % context_frames

    json.dump(g, open(dst, 'w'), indent=1)

    cut = 3.200 * 24
    start = 124 - context_frames
    wide = max(0, int(cut) - start + 1)
    print('wrote %s' % os.path.basename(dst))
    print('  context_frames = %d  (%.3f s preserved)' % (context_frames, context_frames / 24))
    print('  #605 %s' % g['605']['inputs']['math_expression'])
    print('  source %dx%d, preserved window = frames %d-123 of 062'
          % (WIDTH, HEIGHT, start))
    print('  of those, %d are WIDE (pre-cut) and %d are the eyes ECU'
          % (wide, 124 - start - wide))
    print('  held: steps=%s shift_audio=%s seed=%s lora=%s'
          % (g['338']['inputs']['steps'], g['516']['inputs']['shift_audio'],
             g['195']['inputs']['int'],
             os.path.basename(g['455']['inputs']['lora_name'])))
    assert '601' not in g and g['153']['inputs']['latent_image'] == ['603', 0]
    assert g['150']['inputs']['conditioning'] == ['472', 0]
    return dst


def main():
    if not os.path.exists(SRC):
        sys.exit('missing %s' % SRC)
    staged = os.path.join(BENCH_INPUT, NATIVE)
    if not os.path.exists(staged):
        sys.exit('stage the source first:\n  copy "%s" "%s"' % (NATIVE_FROM, staged))
    for n in (39, 90):
        build(n, os.path.join(HERE, 'arm_prefix%d_native.json' % n))
        print()


if __name__ == '__main__':
    main()
