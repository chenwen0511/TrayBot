#!/usr/bin/env bash
# Agent 云端模式（启用 MinIO 图文直播）
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi

# MinIO（与 doc/mino.md 一致；按实际主机修改 MINIO_PUBLIC_URL）
export MINIO_ENABLED=1
export MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://127.0.0.1:9000}"
# 相对路径 /traybot-live/...，由 Vite 代理到 MinIO（局域网访问前端时也能看图）
export MINIO_PUBLIC_URL="${MINIO_PUBLIC_URL:-proxy}"
export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-ChangeMe_MinIO_2026!}"
export MINIO_BUCKET="${MINIO_BUCKET:-traybot-live}"
export CAMERA_PREFER_DEVICE="${CAMERA_PREFER_DEVICE:-1}"

exec .venv/bin/python -m app.main run-cloud "$@"
