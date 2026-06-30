"""LangGraph 工作流图构建与运行。"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.workflow.nodes import NODE_REGISTRY
from app.workflow.state import WorkflowState
from traybot_protocol.models import DEFAULT_WORK_ORDER, NODE_SEQUENCE, RobotLocation, WorkOrder


def build_workflow_graph():
    graph = StateGraph(WorkflowState)
    for name in NODE_SEQUENCE:
        graph.add_node(name, NODE_REGISTRY[name])
    graph.add_edge(START, NODE_SEQUENCE[0])
    for i in range(len(NODE_SEQUENCE) - 1):
        graph.add_edge(NODE_SEQUENCE[i], NODE_SEQUENCE[i + 1])
    graph.add_edge(NODE_SEQUENCE[-1], END)
    return graph.compile()


def make_initial_state(work_order: WorkOrder | None = None) -> WorkflowState:
    wo = work_order or DEFAULT_WORK_ORDER
    batch = min(wo.backpack_capacity, wo.total_trays - wo.delivered_trays)
    return WorkflowState(
        work_order=wo,
        location=RobotLocation.HOME,
        battery=78.0,
        batch_size=batch,
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
