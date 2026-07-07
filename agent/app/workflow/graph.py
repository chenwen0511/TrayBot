"""LangGraph 工作流图构建与运行。"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.workflow.nodes import (
    arrived_delivery,
    arrived_pickup,
    batch_decision,
    enter_pick_tray,
    enter_place_tray,
    nav_to_delivery,
    nav_to_pickup,
    order_received,
    put_backpack,
    return_home,
    route_after_batch,
    route_after_place_tray,
    route_after_put_backpack,
    take_from_backpack,
)
from app.workflow.state import WorkflowState
from app.workflow.subgraphs.pick import build_pick_subgraph
from app.workflow.subgraphs.place import build_place_subgraph
from traybot_protocol.models import DEFAULT_WORK_ORDER, RobotLocation, WorkOrder


def build_workflow_graph():
    pick_tray = build_pick_subgraph()
    place_tray = build_place_subgraph()

    graph = StateGraph(WorkflowState)
    graph.add_node("order_received", order_received)
    graph.add_node("nav_to_pickup", nav_to_pickup)
    graph.add_node("arrived_pickup", arrived_pickup)
    graph.add_node("enter_pick", enter_pick_tray)
    graph.add_node("pick_tray", pick_tray)
    graph.add_node("put_backpack", put_backpack)
    graph.add_node("nav_to_delivery", nav_to_delivery)
    graph.add_node("arrived_delivery", arrived_delivery)
    graph.add_node("take_from_backpack", take_from_backpack)
    graph.add_node("enter_place", enter_place_tray)
    graph.add_node("place_tray", place_tray)
    graph.add_node("batch_decision", batch_decision)
    graph.add_node("return_home", return_home)

    graph.add_edge(START, "order_received")
    graph.add_edge("order_received", "nav_to_pickup")
    graph.add_edge("nav_to_pickup", "arrived_pickup")
    graph.add_edge("arrived_pickup", "enter_pick")
    graph.add_edge("enter_pick", "pick_tray")
    graph.add_edge("pick_tray", "put_backpack")
    graph.add_conditional_edges(
        "put_backpack",
        route_after_put_backpack,
        {"enter_pick": "enter_pick", "nav_to_delivery": "nav_to_delivery"},
    )
    graph.add_edge("nav_to_delivery", "arrived_delivery")
    graph.add_edge("arrived_delivery", "take_from_backpack")
    graph.add_edge("take_from_backpack", "enter_place")
    graph.add_edge("enter_place", "place_tray")
    graph.add_conditional_edges(
        "place_tray",
        route_after_place_tray,
        {"take_from_backpack": "take_from_backpack", "batch_decision": "batch_decision"},
    )
    graph.add_conditional_edges(
        "batch_decision",
        route_after_batch,
        {"nav_to_pickup": "nav_to_pickup", "return_home": "return_home"},
    )
    graph.add_edge("return_home", END)
    return graph.compile()


def make_initial_state(work_order: WorkOrder | None = None) -> WorkflowState:
    wo = work_order or DEFAULT_WORK_ORDER
    return WorkflowState(
        work_order=wo,
        location=RobotLocation.HOME,
        battery=78.0,
        batch_number=1,
        nav_from=None,
        backpack_count=0,
        pick_attempt=1,
        place_attempt=1,
        pick_in_hand_ok=False,
        place_verify_ok=False,
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
