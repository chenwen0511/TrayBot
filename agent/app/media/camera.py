"""从相机采集一帧 JPEG；无相机时从左手腕 Demo 视频随机取帧。"""

from __future__ import annotations

import io
import logging
import os
import random
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_AGENT_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_LEFT_WRIST_VIDEO = _AGENT_ROOT.parent / "front" / "public" / "videos" / "camera-left.mp4"


def _left_wrist_video_path() -> Path | None:
    env = os.getenv("CAMERA_LEFT_VIDEO")
    if env:
        path = Path(env)
        return path if path.is_file() else None
    if _DEFAULT_LEFT_WRIST_VIDEO.is_file():
        return _DEFAULT_LEFT_WRIST_VIDEO
    return None


def _encode_jpeg(frame) -> bytes | None:
    try:
        import cv2  # type: ignore[import-untyped]
    except ImportError:
        return None

    ok, encoded = cv2.imencode(
        ".jpg",
        frame,
        [int(cv2.IMWRITE_JPEG_QUALITY), int(os.getenv("CAMERA_JPEG_QUALITY", "85"))],
    )
    if not ok:
        return None
    return encoded.tobytes()


def _capture_from_device() -> bytes | None:
    device = os.getenv("CAMERA_DEVICE", "0")
    try:
        import cv2  # type: ignore[import-untyped]
    except ImportError:
        return None

    cap = cv2.VideoCapture(int(device) if device.isdigit() else device)
    try:
        if not cap.isOpened():
            return None
        ok, frame = cap.read()
        if not ok or frame is None:
            return None
        return _encode_jpeg(frame)
    finally:
        cap.release()


def _capture_from_left_wrist_video() -> bytes | None:
    """从左手腕相机 Demo MP4 随机取一帧。"""
    video_path = _left_wrist_video_path()
    if not video_path:
        return None

    try:
        import cv2  # type: ignore[import-untyped]
    except ImportError:
        return None

    cap = cv2.VideoCapture(str(video_path))
    try:
        if not cap.isOpened():
            return None
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if frame_count <= 0:
            ok, frame = cap.read()
            if not ok or frame is None:
                return None
            return _encode_jpeg(frame)

        target = random.randint(0, frame_count - 1)
        cap.set(cv2.CAP_PROP_POS_FRAMES, target)
        ok, frame = cap.read()
        if not ok or frame is None:
            return None
        raw = _encode_jpeg(frame)
        if raw:
            logger.debug("左手腕视频随机采帧成功 path=%s frame=%d bytes=%d", video_path, target, len(raw))
        return raw
    finally:
        cap.release()


def _synthetic_frame(*, event_type: str, title: str, event_id: str) -> bytes:
    from PIL import Image, ImageDraw, ImageFont

    width = int(os.getenv("FRAME_WIDTH", "640"))
    height = int(os.getenv("FRAME_HEIGHT", "480"))
    img = Image.new("RGB", (width, height), color=(26, 35, 50))
    draw = ImageDraw.Draw(img)

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    lines = [
        "TrayBot Camera",
        event_type,
        title,
        event_id,
        ts,
    ]
    y = 36
    for i, line in enumerate(lines):
        size = 28 if i == 0 else 22 if i == 1 else 18
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", size)
        except OSError:
            font = ImageFont.load_default()
        draw.text((24, y), line, fill=(0, 212, 170) if i == 1 else (200, 210, 220), font=font)
        y += size + 14

    draw.rectangle([(16, 16), (width - 16, height - 16)], outline=(0, 212, 170), width=2)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def capture_frame(*, event_type: str, title: str, event_id: str) -> bytes:
    prefer_device = os.getenv("CAMERA_PREFER_DEVICE", "1") == "1"
    if prefer_device:
        raw = _capture_from_device()
        if raw:
            logger.debug("相机采帧成功 event=%s bytes=%d", event_id, len(raw))
            return raw
        logger.debug("相机不可用，尝试左手腕 Demo 视频 event=%s", event_id)

    raw = _capture_from_left_wrist_video()
    if raw:
        return raw

    logger.debug("左手腕视频不可用，使用合成帧 event=%s", event_id)
    return _synthetic_frame(event_type=event_type, title=title, event_id=event_id)
