#!/bin/bash
# MPI-1135 H3 bench Pod boot. Idempotent: everything lives on the network volume at /workspace,
# so the first boot installs (~15 min) and every later boot only starts ComfyUI.
set -u
B=/workspace/bench
LOG=$B/boot.log
mkdir -p $B && exec > >(tee -a $LOG) 2>&1
echo "BENCH boot $(date -u +%FT%TZ)"

# --- ssh, so the agent gets a shell (the custom entrypoint skips the image's own start.sh)
mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo "$PUBLIC_KEY" > ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
(apt-get update -qq && apt-get install -y -qq openssh-server aria2 ffmpeg python3-venv) > /tmp/apt.log 2>&1
mkdir -p /run/sshd && /usr/sbin/sshd && echo "BENCH sshd up"

# --- safety: the Pod removes itself after HARD_MIN even if the agent's side dies
(sleep $((HARD_MIN * 60)); echo "BENCH hard limit - removing pod"; runpodctl remove pod "$RUNPOD_POD_ID") &

C=$B/ComfyUI
# WEIGHTS_ONLY=1 (a CPU Pod): skip the installs, fill the weights, then remove the Pod.
if [ -z "${WEIGHTS_ONLY:-}" ]; then
# --- python env on the volume, torch matching the shipped engine
if [ ! -f $B/.venv_ok ]; then
  echo "BENCH venv"
  rm -rf $B/venv   # a boot cut off mid-install leaves a half venv: start it clean
  python3 -m venv $B/venv
  $B/venv/bin/pip install -q --upgrade pip
  $B/venv/bin/pip install -q torch==2.12.0 torchvision==0.27.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cu130 && touch $B/.venv_ok
fi
PY=$B/venv/bin/python

# --- ComfyUI at the shipped pin, plus the nodes the H3 graphs and the bench arms need

if [ ! -f $B/.comfy_ok ]; then
  echo "BENCH comfy"
  rm -rf $C   # same for a half clone
  git clone -q https://github.com/comfyanonymous/ComfyUI $C && git -C $C checkout -q 63be2f9b82ad0dac88a7ceaa28a9cf3154125a18
  grep -vE '^(torch|torchvision|torchaudio)([<>=].*)?$' $C/requirements.txt > /tmp/req.txt
  $PY -m pip install -q -r /tmp/req.txt && touch $B/.comfy_ok
fi
addnode() {  # addnode <dir> <repo> <commit>
  local d=$C/custom_nodes/$1
  [ -d $d ] || git clone -q https://github.com/$2 $d
  git -C $d fetch -q origin $3 2>/dev/null; git -C $d checkout -q $3
  [ -f $d/requirements.txt ] && [ ! -f $d/.req_ok ] && $PY -m pip install -q -r $d/requirements.txt && touch $d/.req_ok
}
addnode ComfyUi-MpiNodes MadPonyInteractive/ComfyUi-MpiNodes 291bf3decce14021e371352f97717ceab801ec57
addnode Comfyui_Minimax_h3_latent_Upscaler LBH-123-AI/Comfyui_Minimax_h3_latent_Upscaler d7c01b9011f2e8439493f6c02c29995a27df276f
addnode Comfyui-MMH3-UltimateUpscale bbaudio-2025/Comfyui-MMH3-UltimateUpscale 0a8d5ee
addnode Veda-on-ComfyUI veda-sparse/Veda-on-ComfyUI 67e4eb5
# MpiNodes imports cv2 but has no requirements.txt; the app gets it from dev_configs/python_deps.txt
# (pinned for py3.12, this image is py3.10), so install just the shipped opencv.
$PY -c "import cv2" 2>/dev/null || $PY -m pip install -q opencv-contrib-python-headless==5.0.0.93
echo "BENCH nodes done"

fi

# --- weights (aria2c, 16 connections each); a finished file is skipped
M=$C/models
get() {  # get <folder/file> <url>
  [ -f "$M/$1" ] && [ ! -f "$M/$1.aria2" ] && return 0
  mkdir -p "$(dirname "$M/$1")"
  aria2c -q -x16 -s16 -k8M --file-allocation=none --max-tries=5 --retry-wait=3 -d "$(dirname "$M/$1")" -o "$(basename "$1")" "$2" && echo "BENCH got $1"
}
P=()
R2=https://models.cubric.studio/vision/models
HF=https://huggingface.co
# Fabio 2026-10-25: ours and FastH3 Trim are out of the bench; deleted to free the full volume
# (quota ~145 GB). Singularity v1.3 and v2 stay: one more v1.3 vs v2 test, then Phase 2 on the winner.
rm -f $M/diffusion_models/fastvideo_* $M/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors $M/diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors
get diffusion_models/Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors $HF/WarmBloodAban/Minimax-h3_Singularity/resolve/main/Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors & P+=($!)
get diffusion_models/Minimax-h3_Singularity_ref2va_Pruned_v1.3_int8.safetensors $HF/WarmBloodAban/Minimax-h3_Singularity/resolve/main/Minimax-h3_Singularity_ref2va_Pruned_v1.3_int8.safetensors & P+=($!)
get text_encoders/qwen3vl_32b_h3_ultra_uncensored_heretic_int8_convrot.safetensors $R2/text_encoders/qwen3vl_32b_h3_ultra_uncensored_heretic_int8_convrot.safetensors & P+=($!)
wait "${P[@]}"; P=()
get vae/minimax_h3_video_vae_int8_convrot.safetensors $R2/vae/minimax_h3_video_vae_int8_convrot.safetensors & P+=($!)
get vae/minimax_h3_audio_vae_fp32.safetensors $HF/Comfy-Org/MiniMax-H3/resolve/main/vae/minimax_h3_audio_vae_fp32.safetensors & P+=($!)
get vae/taeh3.safetensors $R2/vae/taeh3.safetensors & P+=($!)
get latent_upscale_models/minimax_h3_latent_upscaler_3d_bf16.safetensors $R2/latent_upscale_models/minimax_h3_latent_upscaler_3d_bf16.safetensors & P+=($!)
get loras/minimax-h3/minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors $R2/loras/minimax-h3/minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors & P+=($!)
get loras/minimax-h3/minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors $R2/loras/minimax-h3/minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors & P+=($!)
get loras/minimax_h3_lms_v1.0_r64.safetensors $HF/Alissonerdx/Minimax-H3-ComfyUI/resolve/main/loras/minimax_h3_lms_v1.0_r64.safetensors & P+=($!)
get veda/minimax_h3_r2va_veda_preview_fp8.safetensors $HF/Veda-Sparse/Minimax-H3-R2VA-Veda-Preview/resolve/main/minimax_h3_r2va_veda_preview_fp8.safetensors & P+=($!)
get veda/minimax_h3_t2va_veda_8nfe_600step_preview_fp8.safetensors $HF/Veda-Sparse/Minimax-H3-T2VA-Veda-8NFE-600Step-Preview/resolve/main/minimax_h3_t2va_veda_8nfe_600step_preview_fp8.safetensors & P+=($!)
wait "${P[@]}"; P=()
echo "BENCH weights done"; du -sh $M
[ -n "${WEIGHTS_ONLY:-}" ] && { echo "BENCH weights-only fill finished - removing pod"; runpodctl remove pod "$RUNPOD_POD_ID"; sleep infinity; }

# --- weights onto the container disk (create-pod.mjs asks for 150 GB). ComfyUI's dynamic VRAM
# loading streams a model out of its file on EVERY load, ~75 s per DiT load off the network
# volume (reads ~0.67 GB/s); the container disk reads ~2.6 GB/s. is_default puts these paths
# ahead of the volume's, which stays the fallback (Veda reads its own folder from there).
L=/root/models
echo "BENCH copying weights to $L"
P=()
for d in diffusion_models text_encoders vae latent_upscale_models loras; do
  mkdir -p $L/$d; (cd $M/$d && find . -type f -exec cp -n --parents {} $L/$d/ \;) & P+=($!)
done
wait "${P[@]}"; echo "BENCH weights local"  # a bare `wait` also waits on the HARD_MIN timer; du -sh $L; df -h /
cat > /root/extra_models.yaml <<EOF
local:
  base_path: $L
  is_default: true
  diffusion_models: diffusion_models
  text_encoders: text_encoders
  vae: vae
  latent_upscale_models: latent_upscale_models
  loras: loras
EOF

echo "BENCH comfy start"
cd $C && exec $PY main.py --listen 0.0.0.0 --port 8188 --output-directory $B/output --extra-model-paths-config /root/extra_models.yaml
