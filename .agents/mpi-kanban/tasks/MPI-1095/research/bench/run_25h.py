# Download the heretic encoder, then bench every case on 25h: one model, 4 cases per lease (rule: batch by model).
import os, subprocess, sys, time
REPO = 'C:/AI/Mpi/Cubric-Vision'
B = REPO + '/.agents/mpi-kanban/tasks/MPI-1095/research/bench/'
LEASE = 'C:/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.2/skills/mpi-lib/scripts/gpu_lease.py'
OUT = 'C:/AI/MPI-1095-out'
r = subprocess.run(['python', B + 'dl.py'], cwd=REPO, capture_output=True, text=True)  # not -I: needs user site-packages
print(r.stdout[-1500:], r.stderr[-1500:], flush=True)
if 'ALL DONE' not in r.stdout or 'FAIL' in r.stdout:
    sys.exit(1)
cases = ['t2v', 't2v_talk', 'i2v_start', 'i2v_end', 'i2v_both', 'ref2v', 'voice_ref', 'audio_in']
tags = [f'25h:{c}' for c in cases if not os.path.exists(f'{OUT}/{c}_25h.mp4')]
for i in range(0, len(tags), 4):
    print('lease', tags[i:i + 4], time.strftime('%H:%M:%S'), flush=True)
    r = subprocess.run([sys.executable, LEASE, 'run', '--timeout', '10800', '--poll', '2', '--',
                        'C:/Program Files/Python314/python.exe', '-I', B + 'ltx25_bench.py', *tags[i:i + 4]], cwd=REPO)
    print('lease exit', r.returncode, time.strftime('%H:%M:%S'), flush=True)
