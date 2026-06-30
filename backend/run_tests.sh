#!/usr/bin/env bash
# 在 ROS 环境中运行 pytest，避免 launch_testing 插件冲突
set -euo pipefail
cd "$(dirname "$0")"
export PYTEST_DISABLE_PLUGIN_AUTOLOAD=1
exec .venv/bin/python -m pytest -p pytest "$@"
