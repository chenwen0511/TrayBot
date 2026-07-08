"""LangGraph 主工作流图（单图扁平实现）。"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.workflow.nodes import (
    arrived_delivery,
    arrived_pickup,
    batch_decision,
    enter_pick,
    enter_place,
    grab_success,
    nav_to_delivery,
    nav_to_pickup,
    order_received,
    pick_execute,
    pick_in_hand,
    pick_pem,
    pick_retry,
    pick_validate,
    place_execute,
    check_in_hand,
    place_pem,
    place_retry,
    place_validate,
    place_verify,
    put_backpack,
    put_shelf_success,
    return_home,
    route_after_batch,
    route_after_pick_in_hand,
    route_after_check_in_hand,
    route_after_place_verify,
    route_after_put_backpack,
    route_after_put_shelf,
    take_from_backpack,
)
from app.workflow.state import WorkflowState
from traybot_protocol.models import DEFAULT_WORK_ORDER, RobotLocation, WorkOrder


def build_workflow_graph():
    graph = StateGraph(WorkflowState)

    for name, fn in (
        ("order_received", order_received),
        ("nav_to_pickup", nav_to_pickup),
        ("arrived_pickup", arrived_pickup),
        ("enter_pick", enter_pick),
        ("pick_pem", pick_pem),
        ("pick_validate", pick_validate),
        ("pick_execute", pick_execute),
        ("pick_in_hand", pick_in_hand),
        ("pick_retry", pick_retry),
        ("grab_success", grab_success),
        ("put_backpack", put_backpack),
        ("nav_to_delivery", nav_to_delivery),
        ("arrived_delivery", arrived_delivery),
        ("place_pem", place_pem),
        ("take_from_backpack", take_from_backpack),
        ("check_in_hand", check_in_hand),
        ("enter_place", enter_place),
        ("place_validate", place_validate),
        ("place_execute", place_execute),
        ("place_verify", place_verify),
        ("place_retry", place_retry),
        ("put_shelf_success", put_shelf_success),
        ("batch_decision", batch_decision),
        ("return_home", return_home),
    ):
        graph.add_node(name, fn)

    graph.add_edge(START, "order_received")
    graph.add_edge("order_received", "nav_to_pickup")
    graph.add_edge("nav_to_pickup", "arrived_pickup")
    graph.add_edge("arrived_pickup", "enter_pick")
    graph.add_edge("enter_pick", "pick_pem")
    graph.add_edge("pick_pem", "pick_validate")
    graph.add_edge("pick_validate", "pick_execute")
    graph.add_edge("pick_execute", "pick_in_hand")
    graph.add_conditional_edges(
        "pick_in_hand",
        route_after_pick_in_hand,
        {"grab_success": "grab_success", "pick_retry": "pick_retry"},
    )
    graph.add_edge("pick_retry", "pick_pem")
    graph.add_edge("grab_success", "put_backpack")
    graph.add_conditional_edges(
        "put_backpack",
        route_after_put_backpack,
        {"enter_pick": "enter_pick", "nav_to_delivery": "nav_to_delivery"},
    )
    graph.add_edge("nav_to_delivery", "arrived_delivery")
    graph.add_edge("arrived_delivery", "place_pem")
    graph.add_edge("place_pem", "place_validate")
    graph.add_edge("place_validate", "take_from_backpack")
    graph.add_edge("take_from_backpack", "check_in_hand")
    graph.add_conditional_edges(
        "check_in_hand",
        route_after_check_in_hand,
        {"enter_place": "enter_place", "take_from_backpack": "take_from_backpack"},
    )
    graph.add_edge("enter_place", "place_execute")
    graph.add_edge("place_execute", "place_verify")
    graph.add_conditional_edges(
        "place_verify",
        route_after_place_verify,
        {"put_shelf_success": "put_shelf_success", "place_retry": "place_retry"},
    )
    graph.add_edge("place_retry", "place_pem")
    graph.add_conditional_edges(
        "put_shelf_success",
        route_after_put_shelf,
        {"place_pem": "place_pem", "batch_decision": "batch_decision"},
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
        take_attempt=1,
        pick_in_hand_ok=False,
        check_in_hand_ok=False,
        place_verify_ok=False,
        target_slot=None,
        place_scan_index=0,
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
