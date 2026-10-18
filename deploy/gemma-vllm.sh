#!/bin/sh
# Serves Gemma through vLLM's OpenAI-compatible API on a GPU Droplet (Cloud mode's model).
# Run on the GPU Droplet. Needs an HF token that has accepted the Gemma licence.
#   GEMMA_MODEL=google/<gemma instruct checkpoint> HF_TOKEN=... VLLM_API_KEY=... sh deploy/gemma-vllm.sh
# On an AMD (MI300X) Droplet set VLLM_IMAGE to a ROCm build of vLLM (e.g. rocm/vllm) and drop --gpus.
set -eu
: "${GEMMA_MODEL:?Set GEMMA_MODEL to the Hugging Face id of the Gemma instruct checkpoint}"
: "${HF_TOKEN:?Set HF_TOKEN}"
: "${VLLM_API_KEY:?Set VLLM_API_KEY; Cutroom sends it as OPENAI_COMPAT_API_KEY}"
VLLM_IMAGE="${VLLM_IMAGE:-vllm/vllm-openai:latest}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-32768}"

docker run -d --name gemma --restart unless-stopped \
  --gpus all --ipc=host -p 8000:8000 \
  -e HF_TOKEN="$HF_TOKEN" \
  -v "$HOME/.cache/huggingface:/root/.cache/huggingface" \
  "$VLLM_IMAGE" \
  --model "$GEMMA_MODEL" \
  --served-model-name "$GEMMA_MODEL" \
  --api-key "$VLLM_API_KEY" \
  --max-model-len "$MAX_MODEL_LEN"

echo "Gemma is loading. Point Cutroom at it with:"
echo "  OPENAI_COMPAT_BASE_URL=http://<this droplet's private IP>:8000/v1"
echo "  OPENAI_COMPAT_MODEL_ID=$GEMMA_MODEL"
