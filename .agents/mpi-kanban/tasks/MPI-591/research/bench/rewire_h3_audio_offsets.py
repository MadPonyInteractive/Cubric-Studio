"""Rewire the audio offsets of comfy_workflows/raw/flow_h3_extend.json off the real counts.

Phase 8 delta, 2026-09-27. Three literals left behind by the fl2va rewire:

  #951 start 16 / #953 "16 - a"   the OLD context of 40 minus a 24-frame re-take. With
       the masked prefix the head is #972's context_frames (39 / 90 / 141), so a literal
       16 re-took 23 frames at 39 and 74 frames - three seconds of the source's real
       audio - at 90. Now both read NEW #974 = context_frames - 24, so the re-take is 24
       frames at every context length.

  #950 end -1 ("Trim AAC Padding")   only ever trimmed because MpiAudioRange rounded the
       track length to whole frames, which trimmed when the padding was under half a
       frame and not otherwise (AAC's 1024-sample priming alone is 0.56 of a frame).
       MpiNodes bc92a1b makes -1 the real last sample, so the trim needs a real bound:
       NEW #975 = the source's frame_count - 1.

Run:  python rewire_h3_audio_offsets.py
Then: convert raw -> runtime with scripts/sync-raw-workflows.mjs against 48188.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rewire_h3_extend import RAW, Graph, sig  # noqa: E402

RETAKE = 24
MATH_OUT = [{'label': 'result', 'name': 'result', 'type': '*'}]
MATH_IN = [sig('*', 'a'), dict(sig('*', 'b'), shape=7), dict(sig('*', 'c'), shape=7)]
MATH_PROPS = {'cnr_id': 'ComfyUi-MpiNodes'}


def main():
    g = Graph(RAW)
    assert 974 not in g.by and 975 not in g.by, 'already rewired'

    g.add(974, 'MpiMath', 'Re-take Start (context - %d)' % RETAKE, [3000, 1800],
          MATH_IN, MATH_OUT, {'math_expression': 'a - %d' % RETAKE}, MATH_PROPS)
    g.link(972, 'context_frames', 974, 'a', 'INT')

    g.widget_input(951, 'start', 'INT')
    g.link(974, 'result', 951, 'start', '*')

    g.widget(953, 'math_expression', 'b - a')
    g.n(953)['title'] = 'Splice Start (re-take start - frames)'
    g.link(974, 'result', 953, 'b', '*')

    g.add(975, 'MpiMath', 'Last Source Frame (frame_count - 1)', [900, 1100],
          MATH_IN, MATH_OUT, {'math_expression': 'a - 1'}, MATH_PROPS)
    g.link(331, 'frame_count', 975, 'a', 'INT')
    g.widget_input(950, 'end', 'INT')
    g.link(975, 'result', 950, 'end', '*')

    g.save()
    print('rewired: #974 -> #951.start, #953.b; #975 -> #950.end')


if __name__ == '__main__':
    main()
