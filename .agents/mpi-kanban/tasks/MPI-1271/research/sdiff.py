"""Semantic raw diff: inputs compared by (src node, slot), not link id. Usage: sdiff.py <path> <oldref> [newref]"""
import json, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')
P, R = sys.argv[1], sys.argv[2]
ld = lambda ref: json.loads(subprocess.check_output(['git','show',f'{ref}:{P}'])) if ref else json.load(open(P,encoding='utf8'))
old, new = ld(R), ld(sys.argv[3] if len(sys.argv)>3 else None)
def idx(w):
    N={n['id']:n for n in w['nodes']}; L={l[0]:l for l in w['links']}
    ins={i:{x['name']:((L[x['link']][1],L[x['link']][2]) if x.get('link') is not None else None) for x in n.get('inputs',[])} for i,n in N.items()}
    return N,ins
On,Oi=idx(old); Nn,Ni=idx(new)
nm=lambda N,i:f"{i} {N[i]['type']} '{N[i].get('title') or ''}'" if i in N else str(i)
f=lambda s,N:(nm(N,s[0])+f"[{s[1]}]") if s else None
print('ADDED', [nm(Nn,i) for i in sorted(set(Nn)-set(On))]); print('REMOVED',[nm(On,i) for i in sorted(set(On)-set(Nn))])
for i in sorted(set(On)&set(Nn)):
    a,b=On[i],Nn[i]
    d=[]
    if a.get('widgets_values')!=b.get('widgets_values'): d.append(f"w {a.get('widgets_values')} -> {b.get('widgets_values')}")
    if a.get('mode')!=b.get('mode'): d.append(f"mode {a.get('mode')}->{b.get('mode')}")
    for k in set(Oi[i])|set(Ni[i]):
        if Oi[i].get(k)!=Ni[i].get(k):
            d.append(f"in {k}: {f(Oi[i].get(k),On)} -> {f(Ni[i].get(k),Nn)}")
    if d: print('CHANGED',nm(Nn,i),'|','; '.join(d))
print('WIRING of added:')
for i in sorted(set(Nn)-set(On)):
    outs=[(j,k) for j in Ni for k,s in Ni[j].items() if s and s[0]==i]
    print(' ',nm(Nn,i),'w=',Nn[i].get('widgets_values'),'IN',{k:f(s,Nn) for k,s in Ni[i].items()},'OUT',[nm(Nn,j)+'.'+k for j,k in outs])
print('Input_custom_size count:', sum(1 for n in new['nodes'] if n.get('title')=='Input_custom_size'))
