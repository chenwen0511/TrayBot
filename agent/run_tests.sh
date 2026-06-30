#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export PYTEST_DISABLE_PLUGIN_AUTOLOAD=1
exec .venv/bin/python -m pytest -p pytest "$@"
