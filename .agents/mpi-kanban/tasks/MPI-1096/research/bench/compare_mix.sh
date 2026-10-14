#!/bin/sh
# 2x2 per seed: shared sheet vs three references, Medium and High (High scaled to the Medium tile). VP9 WebM.
# usage: compare_mix.sh <suffix ''|_s2>
O=C:/AI/MPI-1096-out
cd C:/Windows/Fonts
F=arial.ttf
S=$1
lab() { echo "drawtext=fontfile='$F':text='$1':x=12:y=12:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.6"; }
ffmpeg -loglevel error -y -i $O/two_mixshared$S.mp4 -i $O/two_mixsplitfix$S.mp4 -i $O/two_mixsharedhi$S.mp4 -i $O/two_mixsplitfixhi$S.mp4 -filter_complex "\
[0:v]scale=960:-2,crop=960:512,$(lab 'App today - one shared sheet (Medium)')[a];\
[1:v]scale=960:-2,crop=960:512,$(lab 'Three references (Medium)')[b];\
[2:v]scale=960:-2,crop=960:512,$(lab 'App today - one shared sheet (High)')[c];\
[3:v]scale=960:-2,crop=960:512,$(lab 'Three references (High)')[d];\
[a][b][c][d]xstack=inputs=4:layout=0_0|960_0|0_512|960_512[out]" -map "[out]" -map 1:a? -shortest \
  -c:v libvpx-vp9 -b:v 5M -row-mt 1 -deadline good -cpu-used 4 -c:a libopus "$O/two_mix$S.webm"
for t in 1 3 4.5; do ffmpeg -loglevel error -y -ss $t -i "$O/two_mix$S.webm" -frames:v 1 "$O/two_mix${S}_${t}s.png"; done
ls -la "$O/two_mix$S.webm"
