"""LangGraph 工作流测试。"""

from app.workflow.graph import build_workflow_graph, run_workflow
from traybot_protocol.models import (
    DEFAULT_WORK_ORDER,
    MAIN_GRAPH_NODES,
    THINKING_NODES,
    WorkOrder,
    WorkOrderStatus,
)


def test_graph_has_all_main_nodes():
    app = build_workflow_graph()
    node_names = set(app.get_graph().nodes.keys()) - {"__start__", "__end__"}
    assert node_names == set(MAIN_GRAPH_NODES)


def test_mermaid_is_flat_main_graph():
    mermaid = build_workflow_graph().get_graph().draw_mermaid()
    assert "place_pem" in mermaid
    assert "pick_pem" in mermaid
    assert "pick_tray" not in mermaid
    assert "place_tray" not in mermaid


def test_workflow_delivers_all_trays_default():
    result = run_workflow()
    assert result["work_order"].delivered_trays == DEFAULT_WORK_ORDER.total_trays
    assert result["backpack_count"] == 0
    assert len(result["events"]) < 600


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


def test_pick_and_place_steps_emitted():
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
    assert "pick_pem" in types
    assert "place_pem" in types
    assert "place_validate" in types
    assert "put_shelf_success" in types
    assert "place_find_slot" not in types


def test_place_pem_before_take():
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
    idx = types.index("arrived_delivery")
    assert types[idx + 1] == "place_pem"
    assert types[idx + 2] == "place_validate"
    assert types[idx + 3] == "taking_out"
    assert types[idx + 4] == "check_in_hand"
    second_pem = types.index("place_pem", idx + 1)
    assert types[second_pem + 1] == "place_validate"
    assert types[second_pem + 2] == "taking_out"
    assert types[second_pem + 3] == "check_in_hand"


def test_check_in_hand_retries_take_from_backpack():
    wo = WorkOrder(
        id="WO-test-take-retry",
        total_trays=1,
        delivered_trays=0,
        pickup="取料货架 A-01",
        delivery="送料货架 B-09",
        backpack_capacity=20,
        status=WorkOrderStatus.IN_PROGRESS,
    )
    result = run_workflow(wo)
    types = [e.type.value for e in result["events"]]
    delivery_idx = types.index("arrived_delivery")
    assert types[delivery_idx + 4] == "check_in_hand"
    assert types[delivery_idx + 5] == "taking_out"
    assert types[delivery_idx + 6] == "check_in_hand"
    assert "在手检测未通过" in result["events"][delivery_idx + 4].title


def test_check_in_hand_raises_after_max_retries(monkeypatch):
    import pytest

    import app.workflow.graph as graph_module
    from app.workflow import nodes
    from traybot_protocol.models import LiveEventType, MAX_TAKE_RETRIES, RobotLocation

    def always_fail_in_hand(state):
        next_attempt = state["take_attempt"] + 1
        if next_attempt > MAX_TAKE_RETRIES:
            raise RuntimeError("取料失败：超过最大重试次数")
        restored = state["backpack_count"] + 1
        return {
            **nodes.emit_event(
                state,
                event_type=LiveEventType.CHECK_IN_HAND,
                title="在手检测未通过",
                description="夹爪未检测到料盘",
                location=RobotLocation.DELIVERY,
            ),
            "check_in_hand_ok": False,
            "take_attempt": next_attempt,
            "backpack_count": restored,
        }

    monkeypatch.setattr(graph_module, "check_in_hand", always_fail_in_hand)

    wo = WorkOrder(
        id="WO-test-take-fail",
        total_trays=1,
        delivered_trays=0,
        pickup="取料货架 A-01",
        delivery="送料货架 B-09",
        backpack_capacity=20,
        status=WorkOrderStatus.IN_PROGRESS,
    )

    with pytest.raises(RuntimeError, match="取料失败"):
        graph_module.run_workflow(wo)


def test_place_retry_returns_to_place_pem():
    wo = WorkOrder(
        id="WO-test-retry",
        total_trays=1,
        delivered_trays=0,
        pickup="取料货架 A-01",
        delivery="送料货架 B-09",
        backpack_capacity=20,
        status=WorkOrderStatus.IN_PROGRESS,
    )
    result = run_workflow(wo)
    types = [e.type.value for e in result["events"]]
    retry_idx = types.index("place_retry")
    assert types[retry_idx + 1] == "place_pem"
    assert types[retry_idx + 2] == "place_validate"
    assert types[retry_idx + 3] == "taking_out"
    assert types[retry_idx + 4] == "check_in_hand"


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
    assert "背包剩余 1/" in take_events[0].description
