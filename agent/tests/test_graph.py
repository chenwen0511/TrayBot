"""LangGraph 工作流测试。"""

from app.workflow.graph import build_workflow_graph, run_workflow
from traybot_protocol.models import (
    DEFAULT_WORK_ORDER,
    ORCHESTRATOR_NODES,
    THINKING_NODES,
    WorkOrder,
    WorkOrderStatus,
)


def test_graph_has_orchestrator_nodes():
    app = build_workflow_graph()
    node_names = set(app.get_graph().nodes.keys()) - {"__start__", "__end__"}
    for name in ORCHESTRATOR_NODES:
        assert name in node_names


def test_mermaid_includes_subgraph_steps():
    from app.workflow.subgraphs.pick import build_pick_subgraph
    from app.workflow.subgraphs.place import build_place_subgraph

    pick_mermaid = build_pick_subgraph().get_graph().draw_mermaid()
    place_mermaid = build_place_subgraph().get_graph().draw_mermaid()
    assert "pick_perceive" in pick_mermaid
    assert "place_perceive" in place_mermaid


def test_workflow_delivers_all_trays_default():
    result = run_workflow()
    assert result["work_order"].delivered_trays == DEFAULT_WORK_ORDER.total_trays
    assert result["backpack_count"] == 0
    assert len(result["events"]) < 500


def test_workflow_partial_order():
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
    assert result["work_order"].delivered_trays == 25


def test_workflow_continues_when_trays_remain():
    result = run_workflow()
    types = [e.type.value for e in result["events"]]
    first_batch_end = types.index("batch_decision")
    assert result["events"][first_batch_end].title == "决策：继续取料"
    assert types[first_batch_end + 1] == "nav_to_pickup"


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


def test_pick_and_place_substeps_emitted():
    wo = WorkOrder(
        id="WO-test-2",
        total_trays=2,
        delivered_trays=0,
        pickup="取料货架 A-01",
        delivery="送料货架 B-09",
        backpack_capacity=20,
        status=WorkOrderStatus.IN_PROGRESS,
    )
    result = run_workflow(wo)
    types = [e.type.value for e in result["events"]]
    assert "pick_perceive" in types
    assert "pick_validate" in types
    assert "grab_success" in types
    assert "place_perceive" in types
    assert "place_verify" in types
    assert "put_shelf_success" in types


def test_backpack_count_tracked_in_events():
    wo = WorkOrder(
        id="WO-test-2",
        total_trays=2,
        delivered_trays=0,
        pickup="取料货架 A-01",
        delivery="送料货架 B-09",
        backpack_capacity=20,
        status=WorkOrderStatus.IN_PROGRESS,
    )
    result = run_workflow(wo)
    put_events = [e for e in result["events"] if e.type.value == "put_backpack"]
    take_events = [e for e in result["events"] if e.type.value == "taking_out"]
    assert len(put_events) == 2
    assert "背包现有 1/" in put_events[0].description
    assert "背包现有 2/" in put_events[1].description
    assert "背包剩余 1/" in take_events[0].description
