"""LangGraph 工作流测试。"""

from app.workflow.graph import build_workflow_graph, get_mermaid_diagram, run_workflow
from traybot_protocol.models import DEFAULT_WORK_ORDER, NODE_SEQUENCE, THINKING_NODES


def test_graph_has_all_nodes():
    app = build_workflow_graph()
    node_names = set(app.get_graph().nodes.keys()) - {"__start__", "__end__"}
    assert node_names == set(NODE_SEQUENCE)


def test_graph_is_linear_start():
    mermaid = get_mermaid_diagram()
    for name in NODE_SEQUENCE:
        assert name in mermaid


def test_workflow_multi_batch_default_order():
    """35 盘 / 容量 20 → 2 批次，共 22 个事件。"""
    result = run_workflow()
    assert len(result["events"]) == 22
    assert result["work_order"].delivered_trays == 35


def test_workflow_partial_batch_order():
    """25 盘 / 容量 20 → 2 批次（20 + 5）。"""
    from traybot_protocol.models import WorkOrder, WorkOrderStatus

    wo = WorkOrder(
        id="WO-test-25",
        total_trays=25,
        delivered_trays=0,
        pickup="取料货架 A-01",
        delivery="送料货架 B-09",
        backpack_capacity=20,
        status=WorkOrderStatus.IN_PROGRESS,
    )
    result = run_workflow(wo)
    assert len(result["events"]) == 22
    assert result["work_order"].delivered_trays == 25


def test_workflow_continues_when_trays_remain():
    result = run_workflow()
    types = [e.type.value for e in result["events"]]
    first_batch_end = types.index("batch_decision")
    assert types[first_batch_end] == "batch_decision"
    assert result["events"][first_batch_end].title == "决策：继续取料"
    assert types[first_batch_end + 1] == "nav_to_pickup"
    assert result["events"][first_batch_end + 1].title == "继续前往取料货架"


def test_workflow_returns_home_when_complete():
    result = run_workflow()
    types = [e.type.value for e in result["events"]]
    assert types[-2] == "batch_decision"
    assert result["events"][-2].title == "决策：返回 HOME"
    assert types[-1] == "return_home"


def test_thinking_only_on_expected_nodes():
    result = run_workflow()
    thinking_nodes = {e.type.value for e in result["events"] if e.thinking}
    assert thinking_nodes == THINKING_NODES
