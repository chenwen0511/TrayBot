#!/usr/bin/env python3
"""生成 SMT 电子料盘厂房 15m×30m 三维地图 JSON。

体素网格 10cm×10cm（voxelSize=0.1），建筑高度 ≤2m。
前端以「实体块」渲染（~55 个网格），不做百万级体素细分，保证流畅。
"""

from __future__ import annotations

import json
from pathlib import Path

W, D = 30.0, 15.0
MAX_H = 2.0  # 建筑最大高度 2m
DIVIDER_Z = 7.0
VOXEL = 0.1  # 10cm 网格

PALETTE = {
    "floor": "#00e5c0",
    "wall": "#ff6ec7",
    "shelf": "#ff4088",
    "cabinet": "#e879f9",
    "desk": "#00c9a7",
    "machine": "#ff6ec7",
    "door": "#334155",
}

blocks: list[dict] = []


def snap(v: float) -> float:
    return round(v / VOXEL) * VOXEL


def add(t: str, x: float, y: float, z: float, w: float, h: float, d: float, label: str | None = None):
    h = min(snap(h), MAX_H)
    blocks.append({
        "type": t,
        "x": round(snap(x), 2),
        "y": round(snap(y), 2),
        "z": round(snap(z), 2),
        "w": round(snap(w), 2),
        "h": round(h, 2),
        "d": round(snap(d), 2),
        **({"label": label} if label else {}),
    })


# 地面（不参与体素细分，前端用平面）
add("floor", 0, 0, 0, W, 0.1, D)

# 外墙 h=2m
add("wall", 0, 0, 0, W, MAX_H, 0.2)
add("wall", 0, 0, D - 0.2, W, MAX_H, 0.2)
add("wall", 0, 0, 0, 0.2, MAX_H, D)
add("wall", W - 0.2, 0, 0, 0.2, MAX_H, D)

for x0, x1 in [(0, 10.5), (13.5, 16.5), (19.5, W)]:
    seg_w = x1 - x0
    if seg_w > 0:
        add("wall", x0, 0, DIVIDER_Z - 0.1, seg_w, MAX_H, 0.2)

# 仓库：三排货架
SHELF_W, SHELF_D, SHELF_H = 2.4, 1.0, 1.8
rows_z = [1.2, 3.6, 5.8]
for ri, rz in enumerate(rows_z):
    for i in range(9):
        sx = 1.5 + i * 3.0
        label = "取料货架 A-03" if ri == 1 and i == 4 else None
        add("shelf", sx, 0, rz, SHELF_W, SHELF_H, SHELF_D, label)

for i in range(3):
    add("cabinet", 26.5, 0, 1.0 + i * 0.7, 0.6, 1.4, 0.5, "文件柜")
add("shelf", 24.0, 0, 0.8, 2.0, 1.8, 0.8, "文件货架 C-01")
add("shelf", 24.0, 0, 2.2, 2.0, 1.8, 0.8, "文件货架 C-02")

# 产线：两排 SMT 机台
MACHINE_W, MACHINE_D, MACHINE_H = 2.2, 2.2, 1.6
for ri, mz in enumerate([8.8, 11.8]):
    for i in range(7):
        mx = 2.0 + i * 3.8
        label = "送料货架 B-07" if ri == 0 and i == 3 else None
        add("machine", mx, 0, mz, MACHINE_W, MACHINE_H, MACHINE_D, label)

add("desk", 0.8, 0, 9.5, 1.8, 0.1, 1.8, "HOME")

landmarks = [
    {"id": "home", "type": "home", "label": "HOME", "x": 1.7, "z": 10.4},
    {"id": "pickup", "type": "pickup", "label": "取料货架 A-03", "x": 14.7, "z": 3.6},
    {"id": "delivery", "type": "delivery", "label": "送料货架 B-07", "x": 13.4, "z": 9.9},
]

routes = [
    {"id": "home-pickup", "from": "home", "to": "pickup"},
    {"id": "pickup-delivery", "from": "pickup", "to": "delivery"},
    {"id": "delivery-home", "from": "delivery", "to": "home"},
    {"id": "delivery-pickup", "from": "delivery", "to": "pickup"},
]

SCALE = 20
map_data = {
    "id": "factory_01",
    "name": "SMT电子料盘厂房",
    "floor": "1F",
    "unit": "m",
    "size": {"width": W, "depth": D, "height": MAX_H},
    "voxelSize": VOXEL,
    "maxHeight": MAX_H,
    "renderMode": "blocks",
    "scale2d": SCALE,
    "viewBox": {"width": int(W * SCALE), "height": int(D * SCALE)},
    "palette": PALETTE,
    "blocks": blocks,
    "regions": [{"type": "floor", "x": 0, "y": 0, "w": W * SCALE, "h": D * SCALE}],
    "landmarks": landmarks,
    "routes": routes,
    "zones": [
        {"id": "warehouse", "label": "SMT电子料仓库", "x": 0, "z": 0, "w": W, "d": DIVIDER_Z},
        {"id": "production", "label": "SMT产线", "x": 0, "z": DIVIDER_Z, "w": W, "d": D - DIVIDER_Z},
    ],
}

out = Path(__file__).resolve().parent / "factory_01.json"
out.write_text(json.dumps(map_data, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {out} ({len(blocks)} blocks, voxel={VOXEL}m, maxH={MAX_H}m)")
