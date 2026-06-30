"""LangGraph 工作流图构建与运行。"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.workflow.nodes import NODE_REGISTRY, route_after_batch
from app.workflow.state import WorkflowState
from traybot_protocol.models import DEFAULT_WORK_ORDER, RobotLocation, WorkOrder

# 线性主干 + put_shelf_success 后条件分支（继续取料 / 返回 HOME）
_LINEAR_NODES = [
    "order_received",
    "nav_to_pickup",
    "arrived_pickup",
    "target_locked",
    "grab_success",
    "put_backpack",
    "nav_to_delivery",
    "arrived_delivery",
    "taking_out",
    "put_shelf_success",
]


def build_workflow_graph():
    graph = StateGraph(WorkflowState)
    for name in (*_LINEAR_NODES, "batch_decision", "return_home"):
        graph.add_node(name, NODE_REGISTRY[name])
    graph.add_edge(START, _LINEAR_NODES[0])
    for i in range(len(_LINEAR_NODES) - 1):
        graph.add_edge(_LINEAR_NODES[i], _LINEAR_NODES[i + 1])
    graph.add_edge("put_shelf_success", "batch_decision")
    graph.add_conditional_edges(
        "batch_decision",
        route_after_batch,
        {"nav_to_pickup": "nav_to_pickup", "return_home": "return_home"},
    )
    graph.add_edge("return_home", END)
    return graph.compile()


def make_initial_state(work_order: WorkOrder | None = None) -> WorkflowState:
    wo = work_order or DEFAULT_WORK_ORDER
    batch = min(wo.backpack_capacity, wo.total_trays - wo.delivered_trays)
    return WorkflowState(
        work_order=wo,
        location=RobotLocation.HOME,
        battery=78.0,
        batch_size=batch,
        batch_number=1,
        nav_from=None,
        events=[],
        step_index=0,
    )


def run_workflow(work_order: WorkOrder | None = None) -> WorkflowState:
    app = build_workflow_graph()
    return app.invoke(make_initial_state(work_order))


def get_mermaid_diagram() -> str:
    return build_workflow_graph().get_graph().draw_mermaid()


def get_ascii_diagram() -> str:
    return build_workflow_graph().get_graph().draw_ascii()
