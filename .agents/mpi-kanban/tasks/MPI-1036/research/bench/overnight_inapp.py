# Video edit 14: Fabio's in-app eye test, run unattended. UNDER the GPU lease (the whole chain holds it):
#   python gpu_lease.py run --timeout 43200 --poll 5 -- G:/ComfyUi/python_embeded/python.exe -u overnight_inapp.py
# Starts OUR OWN app (`scripts/launch-instance.mjs`: own profile + own port, never :3000), runs run_in_app.py's E1/E2
# through /connector/generate, then kills the app's process TREE the way launch-instance.mjs documents (the port's
# owner is the server fork; its PARENT is the app root - never select by command line, the user's app looks the same).
import os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, *['..'] * 6))
APP_LOG = os.path.join(HERE, 'overnight_app.log')
RUN_LOG = os.path.join(HERE, 'overnight_inapp.log')


def log(msg):
    with open(RUN_LOG, 'a', encoding='utf-8') as f:
        f.write(f'[{time.strftime("%Y-%m-%d %H:%M:%S")}] {msg}\n')


def kill_tree(port):
    ps = (f'$l = (Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue).OwningProcess | '
          f'Select-Object -First 1; if ($l) {{ $root = (Get-CimInstance Win32_Process -Filter "ProcessId=$l").ParentProcessId; '
          f'taskkill /PID $root /T /F }} else {{ "nothing on {port}" }}')
    out = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True)
    log(f'teardown :{port}: {(out.stdout + out.stderr).strip()[:600]}')


log('lease held; starting the isolated app')
with open(APP_LOG, 'w', encoding='utf-8') as app_out:
    app = subprocess.Popen(['node', 'scripts/launch-instance.mjs'], cwd=REPO, stdout=app_out, stderr=subprocess.STDOUT)
url, port = None, None
for _ in range(240):  # 2 min
    time.sleep(0.5)
    m = re.search(r'READY (http://127\.0\.0\.1:(\d+))', open(APP_LOG, encoding='utf-8', errors='replace').read())
    if m:
        url, port = m.group(1), m.group(2)
        break
    if app.poll() is not None:
        break
if not url:
    log(f'app never printed READY (exit {app.poll()}); see overnight_app.log')
    sys.exit(1)
log(f'app READY at {url}; running E1 + E2')
try:
    r = subprocess.run([sys.executable, '-u', os.path.join(HERE, 'run_in_app.py'), url,
                        'E1_dancer_head_whole', 'E2_dancer_head_masked'], capture_output=True, text=True, timeout=4 * 3600)
    log('run_in_app exit %s\n%s\n%s' % (r.returncode, r.stdout[-6000:], r.stderr[-3000:]))
except subprocess.TimeoutExpired:
    log('run_in_app TIMED OUT after 4 h')
finally:
    kill_tree(port)
    log('ALL DONE')
