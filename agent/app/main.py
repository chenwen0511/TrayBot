"""Agent CLI 入口。"""

from __future__ import annotations

import argparse
import asyncio
import fcntl
import json
import logging
import sys
from pathlib import Path

from app.runner import agent_loop
from app.workflow.graph import get_ascii_diagram, get_mermaid_diagram, run_workflow
from traybot_protocol.models import NODE_SEQUENCE, THINKING_NODES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

LOCK_FILE = Path("/tmp/traybot-agent.lock")


def acquire_agent_lock() -> None:
    """禁止多 Agent 并行，避免多条工单同时执行。"""
    fp = open(LOCK_FILE, "w", encoding="utf-8")
    try:
        fcntl.flock(fp, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("错误：已有 Agent 实例在运行，请先停止后再启动。", file=sys.stderr)
        sys.exit(1)
    fp.write(str(Path(__file__).resolve()))
    fp.flush()


def print_graph() -> None:
    print("=" * 60)
    print("LangGraph 工作流 — ASCII")
    print("=" * 60)
    try:
        print(get_ascii_diagram())
    except ImportError as exc:
        print(f"(跳过 ASCII: {exc})")
    print()
    print("=" * 60)
    print("LangGraph 工作流 — Mermaid")
    print("=" * 60)
    print(get_mermaid_diagram())
    print()


def print_run_result() -> None:
    result = run_workflow()
    events = result["events"]
    print("=" * 60)
    print(f"工作流执行完成 — 共 {len(events)} 个步骤")
    print("=" * 60)
    for i, event in enumerate(events, 1):
        tags = []
        if event.thinking:
            tags.append("Thinking")
        if not event.visible:
            tags.append("不可见")
        tag_str = f" [{', '.join(tags)}]" if tags else ""
        print(f"\n{i:02d}. [{event.type.value}]{tag_str}")
        print(f"    标题: {event.title}")
        if event.description:
            print(f"    描述: {event.description}")
    print("\n✓ 本地工作流执行完成")


def print_json() -> None:
    result = run_workflow()
    print(json.dumps({
        "nodes": NODE_SEQUENCE,
        "thinking_nodes": sorted(THINKING_NODES),
        "events": [e.to_feed_dict() for e in result["events"]],
    }, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="TrayBot 端侧 Agent")
    parser.add_argument(
        "command",
        nargs="?",
        default="run-cloud",
        choices=["graph", "run", "json", "all", "run-cloud"],
        help="graph/run/json/all=本地测试, run-cloud=连接云端执行",
    )
    parser.add_argument("--cloud-url", default="ws://127.0.0.1:8000/ws/agent")
    parser.add_argument("--robot-id", default="TrayBot-01")
    args = parser.parse_args()

    if args.command in ("graph", "all"):
        print_graph()
    if args.command in ("run", "all"):
        print_run_result()
    if args.command == "json":
        print_json()
    if args.command == "run-cloud":
        acquire_agent_lock()
        try:
            asyncio.run(agent_loop(args.cloud_url, args.robot_id))
        except KeyboardInterrupt:
            print("\nAgent 已停止")
            sys.exit(0)


if __name__ == "__main__":
    main()
