#!/bin/sh
# One VP9 WebM per person: reference sheet on top, then App today | Face-ID | Both, labelled. Plus stills for reading.
O=C:/AI/MPI-1096-out
cd C:/Windows/Fonts
F=arial.ttf
for who in ${WHO:-man woman}; do
  ffmpeg -loglevel error -y -i "$O/ing_$who.mp4" -i "$O/fid_$who.mp4" -i "$O/both_$who.mp4" -i "$O/sheets/${SHEET:-$who}_1536.png" -filter_complex "\
[0:v]drawtext=fontfile='$F':text='App today (Ingredients)':x=12:y=12:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6[a];\
[1:v]drawtext=fontfile='$F':text='Best-Face-ID':x=12:y=12:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6[b];\
[2:v]drawtext=fontfile='$F':text='Both':x=12:y=12:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6[c];\
[a][b][c]hstack=3[row];\
[3:v]scale=-2:512,pad=2880:512:(ow-iw)/2:0:gray,drawtext=fontfile='$F':text='Reference sheet':x=12:y=12:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6,loop=-1:1:0[ref];\
[ref][row]vstack=2,scale=1920:-2[v]" -map "[v]" -map 0:a? -shortest -c:v libvpx-vp9 -b:v 4M -row-mt 1 -deadline good -cpu-used 4 -c:a libopus "$O/compare_$who.webm"
  for s in 1 3 4.5; do
    ffmpeg -loglevel error -y -ss $s -i "$O/ing_$who.mp4" -ss $s -i "$O/fid_$who.mp4" -ss $s -i "$O/both_$who.mp4" -filter_complex "[0:v][1:v][2:v]hstack=3" -frames:v 1 "$O/still_${who}_$s.png"
  done
done
ls -la "$O"/compare_*.webm
