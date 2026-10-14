#!/bin/sh
# 3x2 grid per seed: the 5 two-character layouts + the shared reference sheet. VP9 WebM (H.264 plays black in the panel).
# usage: compare_two.sh <suffix ''|_s2> <out name> <case1> ... <case5>
O=C:/AI/MPI-1096-out
cd C:/Windows/Fonts
F=arial.ttf
S=$1; NAME=$2; shift 2
lab() { echo "drawtext=fontfile='$F':text='$1':x=12:y=12:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.6"; }
IN=""; FC=""; i=0
for c in "$@"; do
  label=$(echo "$c" | cut -d: -f2); file=$(echo "$c" | cut -d: -f1)
  IN="$IN -i $O/$file$S.mp4"
  FC="$FC[$i:v]scale=960:-2,crop=960:512,$(lab "$label")[v$i];"
  i=$((i+1))
done
FC="$FC[$i:v]scale=-2:512,pad=960:512:(ow-iw)/2:0:gray,$(lab 'Shared sheet'),loop=-1:1:0[v$i];"
FC="$FC[v0][v1][v2][v3][v4][v5]xstack=inputs=6:layout=0_0|960_0|1920_0|0_512|960_512|1920_512,scale=1920:-2[out]"
ffmpeg -loglevel error -y $IN -i $O/sheets/two_shared.png -filter_complex "$FC" -map "[out]" -map 0:a? -shortest \
  -c:v libvpx-vp9 -b:v 5M -row-mt 1 -deadline good -cpu-used 4 -c:a libopus "$O/$NAME$S.webm"
ffmpeg -loglevel error -y -ss 3 -i "$O/$NAME$S.webm" -frames:v 1 "$O/$NAME${S}_3s.png"
ls -la "$O/$NAME$S.webm"
