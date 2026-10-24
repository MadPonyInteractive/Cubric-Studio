"""MPI-1271: SDXL Control output size follows Custom size.

The final Resize Image/Mask (1551) takes W x H from Get Image Size 1677, which read image 1
scaled to 1 MP (1609): a 1344x768 Custom size latent was squeezed back to image 1's shape.
1677 now reads 'Custom Size (latent)' 1775 - 1609 when off (unchanged), the padded W x H when on.
"""
import json

P = 'comfy_workflows/raw/sdxl_t2i_template.json'
w = json.load(open(P, encoding='utf8'))
N = {n['id']: n for n in w['nodes']}
assert N[1677]['type'] == 'GetImageSize' and N[1775]['title'] == 'Custom Size (latent)'
inp = next(i for i in N[1677]['inputs'] if i['name'] == 'image')
link = next(l for l in w['links'] if l[0] == inp['link'])
assert link[1] == 1609, link
N[1609]['outputs'][link[2]]['links'].remove(link[0])
link[1], link[2] = 1775, 0   # same link id, new source
N[1775]['outputs'][0]['links'] = (N[1775]['outputs'][0].get('links') or []) + [link[0]]
open(P, 'w', encoding='utf8', newline='\n').write(json.dumps(w, indent=2, ensure_ascii=False))
print('patched', P, 'link', link)
