"""LangGraph 工作流测试。"""

from app.workflow.graph import build_workflow_graph, get_mermaid_diagram, run_workflow
from traybot_protocol.models import DEFAULT_WORK_ORDER, NODE_SEQUENCE, THINKING_NODES


def test_graph_has_all_nodes():
    app = build_workflow_graph()
    node_names = set(app.get_graph().nodes.keys()) - {"__start__", "__end__"}
    assert node_names == set(NODE_SEQUENCE)


def test_graph_is_linear():
    mermaid = get_mermaid_diagram()
    for name in NODE_SEQUENCE:
        assert name in mermaid


def test_workflow_produces_eleven_events():
    result = run_workflow()
    assert len(result["events"]) == 11


def test_workflow_node_order():
    result = run_workflow()
    types = [e.type.value for e in result["events"]]
    assert types == [
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
        "return_home",
    ]


def test_thinking_only_on_expected_nodes():
    result = run_workflow()
    thinking_nodes = {e.type.value for e in result["events"] if e.thinking}
    assert thinking_nodes == THINKING_NODES
