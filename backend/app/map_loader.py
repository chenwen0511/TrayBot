"""加载 backend/maps 下的地图配置 JSON。"""

from __future__ import annotations

import json
from pathlib import Path

MAPS_DIR = Path(__file__).resolve().parent.parent / "maps"
DEFAULT_MAP_ID = "factory_01"


def load_map(map_id: str = DEFAULT_MAP_ID) -> dict:
    path = MAPS_DIR / f"{map_id}.json"
    if not path.is_file():
        raise FileNotFoundError(map_id)
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def list_maps() -> list[str]:
    return sorted(p.stem for p in MAPS_DIR.glob("*.json"))
