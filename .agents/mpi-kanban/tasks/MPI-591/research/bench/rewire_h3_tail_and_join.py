"""Encode the source's GRID-ALIGNED TAIL, and join with a real hard cut.

Phase 8 delta 3, 2026-09-27 - found on Fabio's first speech run (a 97-frame tiger clip,
context 90): the join SNAPPED BACK and frame 96 showed a double exposure.

  THE SNAP. The H3 video VAE packs only 17k+5 frames and drops the remainder at the END
  (MpiH3EncodeAV says so). #971 encoded the WHOLE source, so a 97-frame clip became its
  first 90 frames; the context then ended at source frame 89 while #904 appended the new
  footage after all 97. Measured on the output: the first clean new frame matches SOURCE
  FRAME 91 (9.56), not a continuation past 96 (27.16 from it). A clip on the grid (062,
  124 frames) never shows it, which is why no bench arm did.
  FIX: NEW #976 = (frame_count - 5) % 17, the first frame of the longest on-grid TAIL.
  NEW #977 cuts the picture there and NEW #978 the audio at the same frame, and those feed
  #971 - so the encode is exact and the context ends on the source's real last frame.

  THE GHOST. #904 ImageBatchExtendWithOverlap(overlap 1, linear_blend) is NOT a hard join:
  alpha = linspace(0, 1, 3)[1:-1] = 0.5, so the last source frame became a 50/50 blend with
  the first new frame, and the picture came out one frame SHORTER than the audio. On the
  guide route that blend hid the flash frame; there is no flash on the prefix route.
  FIX: #904 replaced by NEW #979 ImageBatchMulti - a plain concatenation (KJNodes, already
  a dependency; core ImageBatch is deprecated on engine 0.34, and overlap 0 on the KJ node
  slices source[:-0] = nothing).

Run:  python rewire_h3_tail_and_join.py
Then: convert raw -> runtime with scripts/sync-raw-workflows.mjs against 48188.
"""
import copy
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rewire_h3_extend import RAW, Graph, sig  # noqa: E402


def clone(g, src_id, nid, title, pos):
    """A fresh copy of an existing node's LiteGraph shape, every link cleared."""
    node = copy.deepcopy(g.n(src_id))
    node.update(id=nid, title=title, pos=pos, order=nid)
    for s in node.get('inputs', []):
        s['link'] = None
    for o in node.get('outputs', []):
        o['links'] = []
    g.d['nodes'].append(node)
    g.by[nid] = node
    g.d['last_node_id'] = max(g.d['last_node_id'], nid)
    return node


def main():
    g = Graph(RAW)
    assert 976 not in g.by and 904 in g.by, 'already rewired'

    # 1. The grid-aligned tail, cut from BOTH streams at the same frame.
    clone(g, 975, 976, 'Grid Tail Start ((frames - 5) % 17)', [900, 1250])
    g.widget(976, 'math_expression', '(a - 5) % 17')
    g.link(331, 'frame_count', 976, 'a', 'INT')

    clone(g, 941, 977, 'Source Tail on the H3 Grid', [1260, 1250])
    g.widget(977, 'start_index', 0)
    g.link(916, 'IMAGE', 977, 'images', 'IMAGE')
    g.link(976, 'result', 977, 'start_index', '*')

    clone(g, 950, 978, 'Source Audio Tail (same frame)', [1260, 1450])
    g.n(978)['inputs'] = [s for s in g.n(978)['inputs'] if s['name'] != 'end']
    g.widget(978, 'end', -1)
    g.widget_input(978, 'start', 'INT')
    # From #950, already trimmed to the picture's frame count: the untrimmed track's AAC
    # padding would otherwise end the audio context after the last frame.
    g.link(950, 'audio', 978, 'audio', 'AUDIO')
    g.link(331, 'fps', 978, 'fps', 'FLOAT')
    g.link(976, 'result', 978, 'start', '*')

    g.link(977, 'IMAGE', 971, 'images', 'IMAGE')
    g.link(978, 'audio', 971, 'audio', 'AUDIO')

    # 2. A real hard join: every source frame, then every new frame.
    g.add(979, 'ImageBatchMulti', 'Stitch (hard join)', g.n(904)['pos'],
          [sig('IMAGE', 'image_1'), dict(sig('IMAGE', 'image_2'), shape=7),
           sig('INT', 'inputcount', widget=True)],
          [{'label': 'images', 'name': 'images', 'type': 'IMAGE'}],
          {'inputcount': 2}, {'cnr_id': 'comfyui-kjnodes'})
    g.link(916, 'IMAGE', 979, 'image_1', 'IMAGE')
    g.link(941, 'IMAGE', 979, 'image_2', 'IMAGE')
    g.link(979, 'images', 442, 'images', 'IMAGE')
    g.delete(904)
    g.n(941)['title'] = 'New Frames (after the context)'

    g.save()
    print('rewired: #976/#977/#978 -> #971 (grid tail); #979 replaces #904 (hard join)')


if __name__ == '__main__':
    main()
