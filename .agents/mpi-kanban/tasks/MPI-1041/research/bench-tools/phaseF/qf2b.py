"""MPI-1041 F2 round 2: the reference picture with the F1 WINNING wordings (c1 / a4 / h1 shapes) - the strings the builder
will ship. Same bench graph as qf2.py (app graph + a second ReferenceLatent). usage: qf2b.py <out>. Under gpu_lease only.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qf2

KEEP = 'Keep everything else exactly as it is.'
L1 = ' Make the same change in the close-up portrait on the right. ' + KEEP


def tail(w):
    return f': {w}' if w else ''


def clothes(w=''):
    return (f'Dress the character in the outfit from the reference picture{tail(w)}. The front view, the back view and the '
            'close-up portrait on the right all show the same outfit, with the same neckline, sleeves and straps. ' + KEEP)


def acc(w=''):
    return (f'Give the character the accessory from the reference picture{tail(w)}. Make the same change on the character '
            'seen from behind and in the close-up portrait on the right. ' + KEEP)


def hair(w=''):
    return (f'Give the character the hairstyle and hair color from the reference picture{tail(w)}, with the head uncovered '
            'and no hat, so the new hair shows.' + L1)


def cases():
    return [
        ('w2_dress_photo_s42', 'photo', 1, clothes(), 'dress', 42),
        ('w2_dress_photo_s7', 'photo', 1, clothes(), 'dress', 7),
        ('w2_dress_fabio_s7', 'fabio', 1, clothes(), 'dress', 7),
        ('w2_jacket_photo_s42', 'photo', 1, clothes(), 'jacket', 42),
        ('w2_jacketw_photo_s7', 'photo', 1, clothes('the green quilted jacket and the striped scarf'), 'jacket', 7),
        ('w2_hat_photo_s42', 'photo', 0, acc(), 'hat', 42),
        ('w2_hat_fisher_s42', 'fisher', 0, acc(), 'hat', 42),
        ('w2_pixie_photo_s42', 'photo', 2, hair(), 'pixie', 42),
        ('w2_pixie_fisher_s42', 'fisher', 2, hair(), 'pixie', 42),
    ]


if __name__ == '__main__':
    qf2.cases = cases
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    qf2.phase_edit(out, [])
