import sys
import numpy as np
from PIL import Image
# seam.py <sheet.png>... -> background tone (top 120 rows, 16 px) either side of x = width/2
for p in sys.argv[1:]:
    a = np.asarray(Image.open(p).convert('RGB')).astype(float)
    w = a.shape[1] // 2
    left, right = a[:120, w - 16:w].reshape(-1, 3).mean(0), a[:120, w:w + 16].reshape(-1, 3).mean(0)
    print(p.replace('\\', '/').split('/')[-1], 'L', left.round(1), 'R', right.round(1), 'diff', (right - left).round(1))
