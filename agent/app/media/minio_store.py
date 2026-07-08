"""MinIO（S3 兼容）上传。"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

logger = logging.getLogger(__name__)


def is_minio_enabled() -> bool:
    return os.getenv("MINIO_ENABLED", "0").strip().lower() in {"1", "true", "yes", "on"}


@lru_cache(maxsize=1)
def _client():
    import boto3
    from botocore.client import Config

    endpoint = os.getenv("MINIO_ENDPOINT", "http://127.0.0.1:9000")
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
        aws_secret_access_key=os.getenv("MINIO_SECRET_KEY", "ChangeMe_MinIO_2026!"),
        config=Config(signature_version="s3v4"),
        region_name=os.getenv("MINIO_REGION", "us-east-1"),
    )


def _bucket() -> str:
    return os.getenv("MINIO_BUCKET", "traybot-live")


def _public_base() -> str:
    """前端直链前缀。空或 proxy 时使用相对路径，走 Vite `/traybot-live` 代理。"""
    raw = os.getenv("MINIO_PUBLIC_URL")
    if raw is None:
        return os.getenv("MINIO_ENDPOINT", "http://127.0.0.1:9000").rstrip("/")
    raw = raw.strip()
    if raw.lower() in {"", "proxy", "/"}:
        return ""
    return raw.rstrip("/")


def _object_url(object_key: str) -> str:
    bucket = _bucket()
    base = _public_base()
    if not base:
        return f"/{bucket}/{object_key}"
    return f"{base}/{bucket}/{object_key}"


def _ensure_public_read_policy() -> None:
    import json

    bucket = _bucket()
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"AWS": ["*"]},
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{bucket}/*"],
            }
        ],
    }
    try:
        _client().put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))
        logger.info("MinIO bucket %s 已配置匿名读", bucket)
    except Exception as exc:
        logger.warning("MinIO 匿名读策略设置失败（需手动 mc anonymous set download）: %s", exc)


def _ensure_bucket() -> None:
    client = _client()
    bucket = _bucket()
    try:
        client.head_bucket(Bucket=bucket)
    except Exception:
        try:
            client.create_bucket(Bucket=bucket)
            logger.info("已创建 MinIO bucket: %s", bucket)
        except Exception as exc:
            logger.warning("创建 bucket 失败（可能已存在）: %s", exc)
    _ensure_public_read_policy()


def upload_jpeg(object_key: str, data: bytes) -> str | None:
    if not is_minio_enabled():
        return None
    try:
        _ensure_bucket()
        client = _client()
        bucket = _bucket()
        client.put_object(
            Bucket=bucket,
            Key=object_key,
            Body=data,
            ContentType="image/jpeg",
        )
        url = _object_url(object_key)
        logger.info("MinIO 上传成功: %s", url)
        return url
    except Exception as exc:
        logger.warning("MinIO 上传失败 key=%s: %s", object_key, exc)
        return None
