import glob, subprocess, sys, time
# Exit 0 once no download markers remain and boogu_edit_balanced, qwen_edit and klein_t2i miss no
# UNET/CLIP/VAE on the bench. Prints the remaining gaps every 2 minutes.
M = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/1e4ef77f-40a2-481b-8ecc-5e1596b8a16f/scratchpad/missing.py'
want = tuple(sys.argv[1:]) or ('boogu_edit_balanced', 'qwen_edit', 'klein_t2i')
# download-marker filename fragments per graph (its UNET / text encoder / VAE)
DL = {'boogu_edit_balanced': ('boogu', 'ae.safetensors'), 'qwen_edit': ('qwen_image_edit', 'qwen_2.5_vl'),
      'klein_t2i': ('klein-4b', 'qwen_3_4b')}
t0 = time.time(); last = 0
while time.time() - t0 < 3 * 3600:
    markers = [m for m in glob.glob('G:/CubricModels/**/*.cubricdl', recursive=True)
               if any(f in m for w in want for f in DL[w])]
    out = subprocess.run([sys.executable, M], capture_output=True, text=True, encoding='utf-8').stdout
    gaps = [l.split(' ->')[0] for l in out.splitlines()
            if l.startswith(want) and any(k in l for k in ('UNETLoader', 'CLIPLoader', 'VAELoader'))]
    if not markers and not gaps:
        print('INSTALLS DONE', flush=True); sys.exit(0)
    if time.time() - last > 120:
        print('waiting:', len(markers), 'downloads,', 'gaps', gaps, flush=True); last = time.time()
    time.sleep(20)
print('GAVE UP after 3 h', flush=True); sys.exit(1)
