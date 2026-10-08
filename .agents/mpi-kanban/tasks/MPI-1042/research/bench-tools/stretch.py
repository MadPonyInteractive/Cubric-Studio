import sys, cv2, numpy as np
# Is the sheet's portrait a uniformly scaled copy of the reference, or stretched?
# Grid-search separate x/y scales of the source face crop against the output portrait panel (NCC).
src = cv2.imread(sys.argv[1], cv2.IMREAD_GRAYSCALE)
out = cv2.imread(sys.argv[2], cv2.IMREAD_GRAYSCALE)
H, W = out.shape
panel = out[:, W // 2:]
fx0, fy0, fx1, fy1 = [int(v) for v in sys.argv[3].split(',')]
face = src[fy0:fy1, fx0:fx1]
res = []
lo, hi, step = (float(v) for v in (sys.argv[4] if len(sys.argv) > 4 else '0.5,0.95,0.01').split(','))
for sx in np.arange(lo, hi, step):
    for sy in np.arange(lo, hi, step):
        tpl = cv2.resize(face, (int(face.shape[1] * sx), int(face.shape[0] * sy)), interpolation=cv2.INTER_AREA)
        r = cv2.matchTemplate(panel, tpl, cv2.TM_CCOEFF_NORMED)
        _, v, _, loc = cv2.minMaxLoc(r)
        res.append((v, sx, sy, loc))
res.sort(key=lambda r: -r[0])
for v, sx, sy, loc in res[:5]:
    print('ncc %.3f  sx %.2f  sy %.2f  sx/sy %.3f  at %s' % (v, sx, sy, sx / sy, loc))
