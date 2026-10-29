#!/usr/bin/env bash
# MPI-1347 side-by-sides, per seed, two pairs: shipped (10 steps) | v0.1, and shipped at 8 steps | v0.1. The clip plays twice, once per
# panel's audio, never both at once; the panel being heard gets a yellow border and an AUDIO tag.
#   <pair>_<seed>.mp4       full frames, 1344x768 each   (pair = ship or steps8)
#   <pair>_<seed>_close.mp4 the centre 672x384 of each panel at 2x (the faces as the camera pulls away)
# Usage: build_sbs.sh [<clipdir>]   -> <clipdir>/sbs/
set -euo pipefail
dir="${1:-C:/AI/Mpi/_private/mpi1347-clips}"
mkdir -p "$dir/sbs"
font="C\\:/Windows/Fonts/arialbd.ttf"
results="$(dirname "$0")/results.md"
label() { echo "drawtext=fontfile='$font':text='$1':x=24:y=20:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=10"; }
heard() { echo "drawbox=x=0:y=0:w=iw:h=ih:color=yellow:t=10,drawtext=fontfile='$font':text='AUDIO':x=w-tw-24:y=20:fontsize=40:fontcolor=black:box=1:boxcolor=yellow:boxborderw=10"; }
secs() { { grep -E "^\| $1 \| ok \|" "$results" || true; } | tail -1 | awk -F'|' '{gsub(/ /,"",$4); print $4}'; }

sbs() {  # sbs <pair> <seed> <clip a> <label a> <clip b> <label b>
  local pair=$1 seed=$2 a=$3 b=$5 la lb view crop graph out
  [[ -f "$dir/$a.mp4" && -f "$dir/$b.mp4" ]] || { echo "skip ${pair}_$seed (clip missing)"; return 0; }
  la="$4  $(secs "$a") s" lb="$6  $(secs "$b") s"
  for view in full close; do
    crop=""; [[ $view == close ]] && crop="crop=iw/2:ih/2:iw/4:ih/4,scale=iw*2:ih*2:flags=lanczos,"
    graph="[0:v]${crop}split=2[a0][a1];[1:v]${crop}split=2[b0][b1];"
    graph+="[a0]$(label "$la"),$(heard)[x0];[b0]$(label "$lb")[y0];[x0][y0]hstack,format=yuv420p[s0];"
    graph+="[a1]$(label "$la")[x1];[b1]$(label "$lb"),$(heard)[y1];[x1][y1]hstack,format=yuv420p[s1];"
    graph+="[s0][0:a][s1][1:a]concat=n=2:v=1:a=1[v][o]"
    out="$dir/sbs/${pair}_$seed.mp4"; [[ $view == close ]] && out="$dir/sbs/${pair}_${seed}_close.mp4"
    ffmpeg -v error -y -i "$dir/$a.mp4" -i "$dir/$b.mp4" -filter_complex "$graph" -map "[v]" -map "[o]"       -c:v libx264 -crf 14 -preset slow -c:a aac -b:a 192k "$out"
    echo "wrote $out"
  done
}

for seed in 1347001 1347002; do
  sbs ship "$seed" "ship_$seed" "Shipped 8-step v1.0 at 10 steps" "v01_$seed" "4-step v0.1 at 8 steps"
  sbs steps8 "$seed" "ship8_$seed" "Shipped 8-step v1.0 at 8 steps" "v01_$seed" "4-step v0.1 at 8 steps"
done
