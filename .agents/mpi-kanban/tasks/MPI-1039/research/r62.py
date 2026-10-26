# MPI-1039 round 62, after round 60 (two people, the one-person turn words: profile turns them to face each other, the
# 3/4 back and anime 3/4 front drop the second person). P2 = two-person words: the view named for the GROUP, each
# person's facing named, both kept in their places. Round 60's two sources, FLUX.3 Turbo seed 111, the same room dolls.
#   python r62.py <port>   (under gpu_lease.py run)  |  python r62.py sheet
import json, os, sys
import angles as a
import r53

DONE = os.path.join(a.OUT, 'mq_blender62.json')
R60 = json.load(open(os.path.join(a.OUT, 'mq_blender60.json')))
HEAD = ('Shift the viewpoint of the first image around the two people to match the mannequin reference in the second '
        'image: ')
VIEW = {
    'pr_l': 'the camera has moved a quarter of the way round to their left, so both people are now seen exactly side-on '
            'from their left, each in full profile facing frame-left, one behind the other in depth or side by side as '
            'they stood: neither turns toward the other, both look the same way, toward frame-left.',
    'tq_fl': 'the camera has moved a long way round to their left, so both people are now seen from their left side, '
             'almost side-on, both facing frame-left: each one\'s left shoulder and left leg are nearest the view and each '
             'face is seen in three-quarter profile. Neither turns toward the other; both look the same way.',
    'tq_br': 'a three-quarter rear view from behind both people and 45 degrees to their right. Both face away at an '
             'angle toward frame-right, their backs and right shoulders nearer the view, the backs of their heads and '
             'only the edge of each cheek showing. Both people stay in the picture.',
}
KEEP = {
    'photo two': ' The place around them is seen from that angle. Take only the viewing angle from the mannequin '
                 'reference; it shows one figure, the picture keeps BOTH people. They are still the same two real people '
                 'from the first image, each with their own head and hair, hands, clothes and shoes; keep both '
                 'identities, their poses, the place, the light and the image style of the first image unchanged.',
    'anime two': ' The place around them is seen from that angle. Take only the viewing angle from the mannequin '
                 'reference; it shows one figure, the picture keeps BOTH people. They are still the same two drawn anime '
                 'characters from the first image, each with their own head and hair, hands, clothes and shoes; keep '
                 'both identities, their poses, the place and the flat 2D anime drawing style of the first image - clean '
                 'outlines, flat colours - unchanged. It stays a drawing, not a photo.',
}


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    for name in KEEP:
        for stop, words in VIEW.items():
            key = f'{name}|{stop}'
            if key not in res:
                img = R60[name]
                res[key] = a.gen(port, {**r53.FLUX3, 'seed': 111, 'cardName': f'angles mq62 {key}',
                                        'positive': HEAD + words + KEEP[name], 'media': [
                                            {'role': 'inputImage', 'url': img},
                                            {'role': 'inputImage2', 'url': r53.ref(port, f'room/{stop}', img)}]})
                json.dump(res, open(DONE, 'w'), indent=1)
    sheet()


def sheet():
    res = json.load(open(DONE))
    rows = [[(None, 'source')] + [(None, f'{s} r60 / P2') for s in VIEW for _ in (0, 1)]]
    for name in KEEP:
        row = [(R60[name], name)]
        for s in VIEW:
            row += [(R60.get(f'{name}|{s}|turn'), f'{s} r60'), (res.get(f'{name}|{s}'), f'{s} P2')]
        rows.append(row)
    a._sheet(rows, 'r62_two_people_words', cell=220, h=300)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
