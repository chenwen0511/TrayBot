# MinIO 对象存储（TrayBot 图文直播）

> 文件名沿用 `mino.md`；产品正确拼写为 **MinIO**（Minimal Object Storage）。

TrayBot 实时图文直播目前使用 SVG 占位图（`EventSnapshot`）。后续可将 Agent / 相机采集的真实图片写入 MinIO，前端通过 **HTTP 直链** 加载，无需经 Backend 转发文件流。

---

## MinIO 是什么

[MinIO](https://min.io/) 是开源的**对象存储**服务，API 与 Amazon S3 兼容。你可以把它理解为一台专门存文件的「云盘服务器」：

- 按 **Bucket（桶）** 组织数据，桶内是 **Object（对象）**，路径形如 `bucket/key`
- 通过 **REST API** 上传、下载、列举、删除
- 支持浏览器直读、预签名 URL、生命周期、版本控制等 S3 能力
- 单节点可跑在 Docker 里，也支持分布式集群

TrayBot 典型路径示例：

```text
http://<minio-host>:9000/traybot-live/events/evt-abc123/wrist.jpg
                      └─ bucket ─┘ └────── object key ──────┘
```

---

## 用于文件存储的好处

| 维度 | 说明 |
|------|------|
| **与业务解耦** | 图片、视频、点云等大文件不进 PostgreSQL / Redis，Backend 只存元数据与 URL |
| **前端直读** | 桶策略或 CDN 开启只读后，`<img src="...">` 直接访问，减轻 Backend 带宽与延迟 |
| **S3 标准** | Agent（Python `boto3`）、Backend（Java AWS SDK）、运维脚本共用同一套 API |
| **容器化友好** | 官方镜像、数据卷持久化、与 MQTT/Backend 同机或同 Compose 网络部署 |
| **按事件组织** | 可按 `events/{eventId}/{camera}.jpg` 归档，便于回放与审计 |
| **扩展成本低** | 后期加 CDN、多副本、冷热分层，无需改前端协议 |

与「图片放 Backend 静态目录」相比：MinIO 更适合多服务并发上传、容量独立扩容、权限与 CORS 统一管理。

---

## 架构示意（TrayBot）

```text
Agent / 相机  ──PUT──►  MinIO (bucket: traybot-live)
                              │
                              │ GET（直链）
                              ▼
                         React Dashboard
                         LiveFeed 展示 imageUrl
```

Backend 可在 WebSocket `live.event` 里附带 `imageUrl`；前端优先渲染真实图片，无 URL 时仍回退 SVG 占位。

---

## 容器化部署

### 前置条件

- 已安装 Docker（建议 24+）与 Docker Compose v2
- 开放端口：`9000`（S3 API）、`9001`（Web 控制台，可选）

### 方式一：单条 `docker run`（最快试用）

```bash
# 数据持久化目录
mkdir -p /data/minio

docker run -d \
  --name traybot-minio \
  --restart unless-stopped \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD='ChangeMe_MinIO_2026!' \
  -v /data/minio:/data \
  minio/minio:latest \
  server /data --console-address ":9001"
```

- **S3 API**：`http://<主机IP>:9000`
- **控制台**：`http://<主机IP>:9001`（用户名/密码即 `MINIO_ROOT_*`）

### 方式二：`docker compose`（推荐生产）

在项目根目录或 `deploy/` 下创建 `docker-compose.minio.yml`：

```yaml
services:
  minio:
    image: minio/minio:latest
    container_name: traybot-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: ChangeMe_MinIO_2026!
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  minio_data:
```

启动：

```bash
docker compose -f docker-compose.minio.yml up -d
docker compose -f docker-compose.minio.yml ps
docker compose -f docker-compose.minio.yml logs -f minio
```

停止（保留数据卷）：

```bash
docker compose -f docker-compose.minio.yml down
```

---

## 初始化 Bucket 与前端直读

安装 MinIO 客户端 `mc`（宿主机或临时容器均可）：

```bash
# 使用临时容器配置 alias（将 HOST 换成实际 IP 或域名）
docker run --rm -it --network host minio/mc:latest alias set traybot \
  http://127.0.0.1:9000 minioadmin 'ChangeMe_MinIO_2026!'

# 创建桶
docker run --rm -it --network host minio/mc:latest mb traybot/traybot-live

# 允许匿名只读（仅公开读场景；生产可改为预签名 URL + 私有桶）
docker run --rm -it --network host minio/mc:latest anonymous set download traybot/traybot-live
```

**CORS**（浏览器跨域读图，前端 dev 在 `:5173` 时需配置）：

```bash
cat > /tmp/minio-cors.json <<'EOF'
[
  {
    "AllowedOrigin": ["http://localhost:5173", "http://127.0.0.1:5173"],
    "AllowedMethod": ["GET", "HEAD"],
    "AllowedHeader": ["*"],
    "ExposeHeader": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
EOF

docker run --rm -it --network host \
  -v /tmp/minio-cors.json:/tmp/cors.json \
  minio/mc:latest cors set traybot/traybot-live /tmp/cors.json
```

上传测试图：

```bash
docker run --rm -it --network host \
  -v /path/to/test.jpg:/tmp/test.jpg \
  minio/mc:latest cp /tmp/test.jpg traybot/traybot-live/events/demo/wrist.jpg
```

浏览器访问：

```text
http://127.0.0.1:9000/traybot-live/events/demo/wrist.jpg
```

---

## TrayBot 集成（已实现）

| 组件 | 实现 |
|------|------|
| **Agent** | `emit_event` 对每个**可见**事件采帧 → 上传 MinIO → 写入 `imageUrl` |
| **协议** | `LiveEvent.image_url` → JSON `imageUrl` |
| **Front** | `LiveFeed` 优先 `<img src={imageUrl}>`，失败回退 SVG |
| **启用** | `MINIO_ENABLED=1`，推荐 `./run_cloud.sh` |

环境变量：

| 变量 | 默认 | 说明 |
|------|------|------|
| `MINIO_ENABLED` | `0` | 测试默认关闭；云端 Agent 设为 `1` |
| `MINIO_ENDPOINT` | `http://127.0.0.1:9000` | S3 API 地址 |
| `MINIO_PUBLIC_URL` | 同 ENDPOINT | 返回给前端的直链前缀 |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | 见部署命令 | 凭据 |
| `MINIO_BUCKET` | `traybot-live` | 桶名 |
| `CAMERA_PREFER_DEVICE` | `1` | 优先真实相机；无相机时用合成 JPEG |
| `CAMERA_DEVICE` | `0` | OpenCV 设备索引 |

启动 Agent（MinIO 已运行且 bucket 可匿名读）：

```bash
cd agent
chmod +x run_cloud.sh
./run_cloud.sh
```

对象路径：`events/{eventId}/{eventType}.jpg`

---

## 安全与运维注意

1. **务必修改** `MINIO_ROOT_PASSWORD`，不要提交到 Git；生产用 Docker secrets 或 `.env`（已加入 `.gitignore`）。
2. **公网暴露**：仅开放 9000 且桶匿名读时，任何人可猜路径；生产建议私有桶 + 短时效预签名 URL，或 MinIO 前置 Nginx + 鉴权。
3. **备份**：定期备份卷 `minio_data`（或 `/data/minio`）。
4. **HTTPS**：对外服务时在 MinIO 前加反向代理（Traefik / Nginx）并配置 TLS。

---

## 常用运维命令

```bash
# 查看桶内对象
docker run --rm -it --network host minio/mc:latest ls traybot/traybot-live/events/

# 删除测试对象
docker run --rm -it --network host minio/mc:latest rm traybot/traybot-live/events/demo/wrist.jpg

# 查看容器健康
docker inspect traybot-minio --format='{{.State.Health.Status}}'
```

---

## 参考链接

- 官方文档：https://min.io/docs/minio/container/index.html
- S3 API 兼容说明：https://min.io/docs/minio/linux/developers/python/minio-py.html
- TrayBot 直播组件：`front/src/components/LiveFeed.tsx`、`EventSnapshot.tsx`
