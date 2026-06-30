"""FastAPI 云端服务入口。"""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.hub import hub
from traybot_protocol.messages import DashboardAction
from traybot_protocol.models import WorkOrderStatus

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="TrayBot Cloud Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "agent_connected": hub.agent_ws is not None,
        "dashboard_clients": len(hub.dashboard_clients),
    }


class CreateWorkOrderRequest(BaseModel):
    id: str = Field(..., examples=["WO-20260629-004"])
    total_trays: int = Field(..., ge=1, alias="totalTrays")
    pickup: str = Field(..., examples=["取料货架 A-01"])
    delivery: str = Field(..., examples=["送料货架 B-09"])
    backpack_capacity: int = Field(20, ge=1, alias="backpackCapacity")

    model_config = {"populate_by_name": True}


@app.get("/api/workorders")
async def list_workorders():
    return {"workOrders": hub.work_orders.to_feed_list()}


@app.post("/api/workorders", status_code=201)
async def create_workorder(body: CreateWorkOrderRequest):
    try:
        order = hub.work_orders.create(
            order_id=body.id,
            total_trays=body.total_trays,
            pickup=body.pickup,
            delivery=body.delivery,
            backpack_capacity=body.backpack_capacity,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    payload = order.to_feed_dict()
    if order.status == WorkOrderStatus.IN_PROGRESS:
        await hub.broadcast_dashboard(DashboardAction.WORKORDER_STARTED, payload)
        await hub._assign_to_agent(order)
    else:
        await hub.broadcast_dashboard(DashboardAction.WORKORDER_CREATED, payload)
    return {"workOrder": payload}


@app.websocket("/ws/dashboard")
async def ws_dashboard(ws: WebSocket):
    await hub.register_dashboard(ws)
    try:
        while True:
            msg = await ws.receive_json()
            if msg.get("action") == "ping":
                await ws.send_json({"action": "pong", "payload": {}})
    except WebSocketDisconnect:
        hub.unregister_dashboard(ws)


@app.websocket("/ws/agent")
async def ws_agent(ws: WebSocket):
    await hub.register_agent(ws)
    try:
        while True:
            msg = await ws.receive_json()
            await hub.handle_agent_message(msg)
    except WebSocketDisconnect:
        hub.unregister_agent(ws)
