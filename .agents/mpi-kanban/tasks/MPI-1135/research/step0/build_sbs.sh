#!/usr/bin/env bash
# Side-by-sides for Fabio, per shot+seed, full resolution, labelled with render seconds, all three
# clips playing at once. The clip plays three times, once per panel's audio; the panel being heard
# gets a yellow border and an AUDIO tag. A second "detail" file crops the middle 1920/N px of
# each of the N panels at true pixels (1920 wide), so a normal screen plays it 1:1.
#   step0: none | ours | benji (MMH3 + LMS, denoise 0.30), Shots A + C
#   b485:  none | benji 0.485 on our model | benji 0.485 on Singularity, Shot C
#   p1:    Singularity none | ours none | Singularity ours-upscale | ours ours-upscale, Shots A-D;
#          p1prompt_<model>: Shot C | looks stripped (Cb) | Cb + MiniMax sections (Cs), ours arm
#   p1b:   Singularity v1.3 | v2, no upscale, Shot B (only when asked by name)
#   p1c:   ours | v1.3 | v2 on Shot D (i2v, no upscale) and Shot Cs (ref2v, sections, ours route)
#   p1d:   v2 | v2 + realism-people LoRA 0.7 (+ trigger), Shot D seed 1 (local bench)
#   p2:    speed arms on v2, Shot B: turbo | sol | Veda; 25 steps | EC | sol | Veda; EC | sol+EC | Veda+EC
# Usage: build_sbs.sh [<clipdir>] [step0|b485|p1|p1b|p2]   -> <clipdir>/sbs/<set>_<shot>_<seed>{,_detail}.mp4
set -euo pipefail
dir="${1:-C:/AI/Mpi/_private/mpi1135-clips}"
mkdir -p "$dir/sbs"
font="C\\:/Windows/Fonts/arialbd.ttf"
results="$(dirname "$0")/../results.md"
label() { echo "drawtext=fontfile='$font':text='$1':x=24:y=20:fontsize=${fs:-44}:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=10"; }
heard() { echo "drawbox=x=0:y=0:w=iw:h=ih:color=yellow:t=10,drawtext=fontfile='$font':text='AUDIO':x=w-tw-24:y=20:fontsize=44:fontcolor=black:box=1:boxcolor=yellow:boxborderw=10"; }
# Render seconds of the clip's last ok row in results.md (earlier rows were superseded re-runs).
secs() { grep -E "^\| $1 \| ok \|" "$results" | tail -1 | awk -F'|' '{gsub(/ /,"",$4); print $4}'; }

# sbs <out name> <clip1> <label1> <clip2> <label2> ...   (clips without .mp4, any number of panels)
sbs() {
  local name=$1; shift
  local clips=() names=() ins=() c
  while (($#)); do clips+=("$1"); names+=("$2"); shift 2; done
  local n=${#clips[@]} last=$((${#clips[@]} - 1)) fs=44; ((n > 3)) && fs=34
  for c in "${clips[@]}"; do
    [[ -f "$dir/$c.mp4" ]] || { echo "skip $name (missing $c)"; return 0; }
    ins+=(-i "$dir/$c.mp4")
  done
  local view crop graph parts out i p f stack
  for view in full detail; do
    crop=""; [[ $view == detail ]] && crop="crop=$((1920 / n)):ih:(iw-$((1920 / n)))/2:0,"
    graph=""; parts=""
    for i in $(seq 0 $last); do
      graph+="[$i:v]${crop}split=$n"; for p in $(seq 0 $last); do graph+="[v${i}p${p}]"; done; graph+=";"
    done
    for p in $(seq 0 $last); do
      stack=""
      for i in $(seq 0 $last); do
        f="$(label "${names[$i]}  $(secs "${clips[$i]}") s")"; [[ $i == "$p" ]] && f+=",$(heard)"
        graph+="[v${i}p${p}]$f[l${i}p${p}];"; stack+="[l${i}p${p}]"
      done
      graph+="${stack}hstack=inputs=$n,format=yuv420p[s${p}];"
      parts+="[s${p}][${p}:a]"
    done
    graph+="${parts}concat=n=$n:v=1:a=1[v][a]"
    out="$dir/sbs/$name.mp4"; [[ $view == detail ]] && out="$dir/sbs/${name}_detail.mp4"
    ffmpeg -v error -y "${ins[@]}" -filter_complex "$graph" -map "[v]" -map "[a]" \
      -c:v libx264 -crf 14 -preset slow -c:a aac -b:a 192k "$out"
    echo "wrote $out"
  done
}

# set=step0 or set=b485 builds only that set; default builds both.
want="${2:-all}"
for seed in 1135001 1135002; do
  if [[ $want == all || $want == step0 ]]; then
    for shot in A C; do
      sbs "step0_${shot}_${seed}" "step0_none_${shot}_${seed}" "none" \
        "step0_ours_${shot}_${seed}" "ours" "step0_benji_${shot}_${seed}" "benji MMH3+LMS"
    done
  fi
  if [[ $want == all || $want == b485 ]]; then
    sbs "b485_C_${seed}" "step0_none_C_${seed}" "none" \
      "b485_ours_C_${seed}" "benji .485 ours" "b485_sing_C_${seed}" "benji .485 Singularity"
  fi
  if [[ $want == all || $want == p1 ]]; then
    for shot in A B C D; do
      on="p1_ours_none_${shot}_${seed}" oo="p1_ours_ours_${shot}_${seed}"
      [[ $shot == A || $shot == C ]] && on="step0_none_${shot}_${seed}" oo="step0_ours_${shot}_${seed}"
      sbs "p1_${shot}_${seed}" "p1_sing_none_${shot}_${seed}" "Sing none" "$on" "ours none" \
        "p1_sing_ours_${shot}_${seed}" "Sing +up" "$oo" "ours +up"
    done
    sbs "p1prompt_sing_${seed}" "p1_sing_ours_C_${seed}" "Sing C" \
      "p1_sing_ours_Cb_${seed}" "Sing stripped" "p1_sing_ours_Cs_${seed}" "Sing sections"
    sbs "p1prompt_ours_${seed}" "step0_ours_C_${seed}" "ours C" \
      "p1_ours_ours_Cb_${seed}" "ours stripped" "p1_ours_ours_Cs_${seed}" "ours sections"
  fi
  if [[ $want == p1b ]]; then
    sbs "p1b_B_${seed}" "p1b_s13_none_B_${seed}" "Sing v1.3" "p1b_s2_none_B_${seed}" "Sing v2"
  fi
  if [[ $want == p1c ]]; then
    sbs "p1c_D_${seed}" "p1_ours_none_D_${seed}" "ours H3 fl2va" "p1_sing_none_D_${seed}" "Sing v1.3" \
      "p1c_s2_none_D_${seed}" "Sing v2"
    sbs "p1c_Cs_${seed}" "p1_ours_ours_Cs_${seed}" "ours H3 ref2va" "p1_sing_ours_Cs_${seed}" "Sing v1.3" \
      "p1c_s2_ours_Cs_${seed}" "Sing v2"
  fi
  if [[ $want == p1d ]]; then
    sbs "p1d_D_${seed}" "p1c_s2_none_D_${seed}" "Sing v2" "p1d_s2_real07_D_${seed}" "v2 + realism LoRA 0.7"
  fi
  if [[ $want == p2 ]]; then
    sbs "p2turbo_B_${seed}" "p2_t_base_B_${seed}" "turbo" "p2_t_sol_B_${seed}" "turbo sol-attn" \
      "p2_t_veda_B_${seed}" "turbo Veda"
    sbs "p2full_B_${seed}" "p2_n_base_B_${seed}" "25 steps" "p2_n_ec_B_${seed}" "EasyCache" \
      "p2_n_sol_B_${seed}" "sol-attn" "p2_n_veda_B_${seed}" "Veda"
    sbs "p2fullec_B_${seed}" "p2_n_ec_B_${seed}" "EasyCache" "p2_n_sol_ec_B_${seed}" "sol-attn+EC" \
      "p2_n_veda_ec_B_${seed}" "Veda+EC"
  fi
done
