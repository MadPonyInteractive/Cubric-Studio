"""MPI-973 automated checks (plan § Verification). Exits 1 on any failure."""
import pathlib, re, sys, urllib.request

SITE = pathlib.Path('C:/AI/Mpi/Cubric Studio (Website)')
APP = pathlib.Path('C:/AI/Mpi/Cubric-Vision')
fails = []

# 1. Every local href/src resolves; every in-page anchor has a target.
pages = [SITE / 'index.html'] + [SITE / d / 'index.html' for d in ('vision', 'prompt', 'audio', 'video')]
for page in pages:
    html = page.read_text(encoding='utf-8')
    ids = set(re.findall(r'\sid="([^"]+)"', html))
    for ref in re.findall(r'(?:href|src|poster|data-src)="([^"]+)"', html):
        if re.match(r'(https?:|mailto:|data:)', ref):
            continue
        if ref.startswith('#'):
            if ref != '#' and ref[1:] not in ids:
                fails.append(f'{page.name}: anchor {ref} has no target')
            continue
        target = (page.parent / ref.split('#')[0]).resolve()
        if target.is_dir():
            target = target / 'index.html'
        if not target.exists():
            fails.append(f'{page.relative_to(SITE)}: {ref} does not exist')
# Crew clips are built at runtime: assets/crew/<key>/<clip>.webm
for key in ('prompt', 'vision', 'studio', 'video', 'audio'):
    for clip in ('idle-1', 'greet-1', 'happy-1', 'idle'):
        ext = 'webp' if clip == 'idle' else 'webm'
        if not (SITE / 'assets' / 'crew' / key / f'{clip}.{ext}').exists():
            fails.append(f'missing crew clip {key}/{clip}.{ext}')
for clip in ('agent-answer-ready', 'connected'):
    if not (SITE / 'assets' / 'crew' / 'studio' / f'{clip}.webm').exists():
        fails.append(f'missing solo clip {clip}')

# 2. No em or en dashes in copy that ships (privacy/ is another session's and unchanged).
for f in pages + [SITE / 'llms.txt']:
    for n, line in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
        if '\u2014' in line or '\u2013' in line:
            fails.append(f'{f.relative_to(SITE)}:{n} has a dash: {line.strip()[:60]}')

# 3. The cloud list is exactly models.js provider deepinfra, not devOnly.
src = (APP / 'js/data/modelConstants/models.js').read_text(encoding='utf-8')
blocks = re.split(r'\n    \{\n', src)
expected = []
for b in blocks:
    if "provider: 'deepinfra'" in b and 'devOnly: true' not in b:
        m = re.search(r"\n\s+name: '([^']+)'", b)
        if m:
            expected.append(m.group(1))
html = (SITE / 'index.html').read_text(encoding='utf-8')
shown = re.findall(r'<li>([^<]+)</li>', html.split('class="models"', 1)[1].split('</section>', 1)[0])
if sorted(expected) != sorted(shown):
    fails.append(f'cloud list drift: models.js {sorted(expected)} vs page {sorted(shown)}')
if re.search(r'[$£€]\s?\d', html.split('class="cloud"', 1)[1].split('</section>', 1)[0]):
    fails.append('a price appears in the cloud section')

# 4. No legacy asset names; public contact only.
if 'CubricVision-' in html:
    fails.append('index.html links a CubricVision- asset')
if 'gmail' in html.lower():
    fails.append('a personal address is on the page')

# 5. The .mcpb download resolves (follows GitHub's redirect to the asset).
url = 'https://github.com/MadPonyInteractive/cubric-studio-agents/releases/latest/download/cubric-studio.mcpb'
try:
    with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=30) as r:
        print('mcpb', r.status, r.headers.get('content-length'), 'bytes')
        if r.status != 200:
            fails.append(f'mcpb HEAD {r.status}')
except Exception as e:  # noqa: BLE001
    fails.append(f'mcpb unreachable: {e}')

print(f'{len(expected)} cloud models match' if not any('cloud list' in f for f in fails) else '')
print('\n'.join(fails) if fails else 'ALL CHECKS PASSED')
sys.exit(1 if fails else 0)
