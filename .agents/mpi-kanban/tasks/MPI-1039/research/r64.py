# MPI-1039 round 64, after round 62 (two-person words keep BOTH people 6/6 where the one-person words dropped one 3/6;
# tq_br 2/2, photo pr_l on view; photo tq_fl undershoots, anime pr_l lands 3/4). P2 widened to all seven turn stops,
# seeds 111 + 222, round 60's two sources; the 3/4 front words now name the move as the one-person 3/4 words do.
#   python r64.py <port>   (under gpu_lease.py run)  |  python r64.py sheet
import json, os, sys
import angles as a
import r53
import r62

DONE = os.path.join(a.OUT, 'mq_blender64.json')
SEEDS = [111, 222]


def _tq(side):
    other = {'left': 'right', 'right': 'left'}[side]
    return (f'the camera has moved a long way round to their {side}, so both people are now seen from their {side} '
            f'side, each body turned well away from the view, almost side-on, both facing frame-{side}: each one\'s '
            f'{side} shoulder, {side} arm and {side} leg are nearest the view, each {other} shoulder is hidden behind the '
            f'chest, their feet point toward frame-{side}, and each face is seen in three-quarter profile with the far '
            'eye barely showing. Neither turns toward the other; both look the same way.')


def _pr(side):
    return (f'the camera has moved a quarter of the way round to their {side}, so both people are now seen exactly '
            f'side-on from their {side}, each in full profile facing frame-{side}: each face is a clean profile, one eye, '
            'the nose and the lips seen in outline. Neither turns toward the other; both look the same way, toward '
            f'frame-{side}.')


def _tqb(side):
    return (f'a three-quarter rear view from behind both people and 45 degrees to their {side}. Both face away at an '
            f'angle toward frame-{side}, their backs and {side} shoulders nearer the view, the backs of their heads and '
            'only the edge of each cheek showing. Both people stay in the picture.')


VIEW = {'tq_fl': _tq('left'), 'tq_fr': _tq('right'), 'pr_l': _pr('left'), 'pr_r': _pr('right'), 'tq_bl': _tqb('left'),
        'tq_br': _tqb('right'),
        'back': 'a view from directly behind both people at the same height and distance. Both now face away; the '
                'backs of their heads, their backs and the backs of their legs are in the frame, side by side, and the '
                'place around them is seen from the opposite side. Both people stay in the picture.'}


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    for seed in SEEDS:
        for name in r62.KEEP:
            for stop, words in VIEW.items():
                key = f'{name}|{stop}|{seed}'
                if key not in res:
                    img = r62.R60[name]
                    keep = r62.KEEP[name] if stop != 'back' else r62.KEEP[name].replace(
                        ' The place around them is seen from that angle.', '')
                    res[key] = a.gen(port, {**r53.FLUX3, 'seed': seed, 'cardName': f'angles mq64 {key}',
                                            'positive': r62.HEAD + words + keep, 'media': [
                                                {'role': 'inputImage', 'url': img},
                                                {'role': 'inputImage2', 'url': r53.ref(port, f'room/{stop}', img)}]})
                    json.dump(res, open(DONE, 'w'), indent=1)
    sheet()


def sheet():
    res = json.load(open(DONE))
    rows = [[(None, 'source')] + [(None, s) for s in VIEW]]
    for seed in SEEDS:
        for name in r62.KEEP:
            rows.append([(r62.R60[name], f'{name} {seed}')] + [(res.get(f'{name}|{s}|{seed}'), s) for s in VIEW])
    a._sheet(rows, 'r64_two_people_all_stops', cell=200, h=260)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
