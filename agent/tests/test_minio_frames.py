"""MinIO 帧上传测试。"""

from app.media.frames import maybe_attach_frame
from traybot_protocol.models import LiveEvent, LiveEventType


def test_maybe_attach_frame_skipped_when_disabled(monkeypatch):
    monkeypatch.setenv("MINIO_ENABLED", "0")
    event = LiveEvent(type=LiveEventType.PICK_PEM, title="抓取位姿估计")
    out = maybe_attach_frame(event, event_type=LiveEventType.PICK_PEM)
    assert out.image_url is None


def test_maybe_attach_frame_uploads_when_enabled(monkeypatch):
    monkeypatch.setenv("MINIO_ENABLED", "1")
    monkeypatch.setenv("MINIO_PUBLIC_URL", "proxy")

    uploaded: dict = {}

    def fake_upload(key: str, data: bytes) -> str:
        uploaded["key"] = key
        uploaded["size"] = len(data)
        return f"/traybot-live/{key}"

    monkeypatch.setattr("app.media.frames.upload_jpeg", fake_upload)
    monkeypatch.setattr(
        "app.media.frames.capture_frame",
        lambda **_: b"\xff\xd8\xff" + b"fakejpeg",
    )

    event = LiveEvent(type=LiveEventType.NAV_TO_PICKUP, title="导航前往取料货架")
    out = maybe_attach_frame(event, event_type=LiveEventType.NAV_TO_PICKUP)
    assert out.image_url == f"/traybot-live/events/{event.id}/nav_to_pickup.jpg"
    assert uploaded["size"] > 0
