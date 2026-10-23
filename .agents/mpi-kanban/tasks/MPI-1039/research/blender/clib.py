# ponytail: cli-anything-blender keeps state in one process (its REPL needs a real Windows console and one-shot
# commands never save), so run a file of REPL lines through its click group in ONE process.
# Usage: python -X utf8 clib.py <commands.txt>     (one CLI command per line, '#' comments allowed)
import shlex
import sys

from cli_anything.blender.blender_cli import cli

for line in open(sys.argv[1], encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    print('>', line)
    try:
        cli.main(shlex.split(line, posix=True), standalone_mode=False)
    except SystemExit as e:
        if e.code:
            sys.exit(f'failed: {line}')
