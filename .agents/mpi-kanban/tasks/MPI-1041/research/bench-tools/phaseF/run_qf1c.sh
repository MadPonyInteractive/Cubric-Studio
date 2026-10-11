#!/bin/bash
# MPI-1041 F1 round 2 (clothes): more seeds c0 vs c1 on fabio, c1 on the bench sheets. Under the GPU lease.
S=C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/a7b3935e-77c3-4f5b-9376-f3d1a5834f0d/scratchpad
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_f1
python C:/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.1/skills/mpi-lib/scripts/gpu_lease.py run --timeout 14400 --poll 2 -- python $S/qf1.py $OUT "c0_dress_fabio_s3,c1_dress_fabio_s3,c0_dress_fabio_s11,c1_dress_fabio_s11,c1_jacket" >> $S/qf1c.log 2>&1
echo "EXIT $?" >> $S/qf1c.log
