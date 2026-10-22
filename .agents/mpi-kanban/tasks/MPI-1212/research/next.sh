#!/usr/bin/env bash
# MPI-1212 round 2, after rest.sh: FLUX.3 with FLUX.3-shaped prompts (Fabio 2026-10-22: the Flow
# wording is Klein/Qwen's; FLUX.3 needs BFL-shaped prompts). Turbo only on Scribble (base: Fabio, horrible).
#   bash next.sh 53061      logs to research/next.log
cd "$(dirname "$0")"
PORT=$1
until grep -q "all done" rest.log; do sleep 20; done
echo "start $(date -u +%T)"
python bfl.py "$PORT" csfi1_2 csfi2_1 --seeds 111,222 --variants bfl_turbo,bfl_base || echo "FAIL bfl csfi"
python bfl.py "$PORT" scr1_0 scr2_0 --seeds 111,222 --variants bfl_turbo || echo "FAIL bfl scr"
python scribble3.py "$PORT" scr1_0 scr2_0 --seeds 111,222 --variants p_turbo,lo_turbo || echo "FAIL scribble3"
python qwenprompt.py "$PORT" csfi1_2 csfi2_1 --seeds 111,222 --variants f3a_turbo,f3b_turbo || echo "FAIL qwenprompt"
python sheet.py csfi1_2 csfi2_1 scr1_0 scr2_0 --bfl
python sheet.py scr1_0 scr2_0 --s3
python sheet.py csfi1_2 csfi2_1 --qp
echo "all done $(date -u +%T)"
