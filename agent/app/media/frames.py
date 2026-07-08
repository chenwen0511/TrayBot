"""为工作流事件附加相机帧 URL。"""

from __future__ import annotations

from app.media.camera import capture_frame
from app.media.minio_store import is_minio_enabled, upload_jpeg
from traybot_protocol.models import LiveEvent, LiveEventType


def maybe_attach_frame(event: LiveEvent, *, event_type: LiveEventType) -> LiveEvent:
    """可见事件：采帧并上传 MinIO，写入 image_url。"""
    if not is_minio_enabled() or not event.visible:
        return event

    jpeg = capture_frame(
        event_type=event_type.value,
        title=event.title,
        event_id=event.id,
    )
    key = f"events/{event.id}/{event_type.value}.jpg"
    url = upload_jpeg(key, jpeg)
    if not url:
        return event
    return event.model_copy(update={"image_url": url})
