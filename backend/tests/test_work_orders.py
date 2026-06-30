"""工单与状态测试。"""

from app.work_orders import WorkOrderStore
from traybot_protocol.models import WorkOrderStatus


def test_initial_queue_is_empty():
    store = WorkOrderStore()
    assert store.orders == []


def test_first_create_becomes_in_progress():
    store = WorkOrderStore()
    order = store.create(
        order_id="WO-TEST-001",
        total_trays=10,
        pickup="取料货架 A-01",
        delivery="送料货架 B-01",
    )
    assert order.status == WorkOrderStatus.IN_PROGRESS


def test_second_create_stays_pending():
    store = WorkOrderStore()
    store.create(
        order_id="WO-TEST-001",
        total_trays=10,
        pickup="取料货架 A-01",
        delivery="送料货架 B-01",
    )
    second = store.create(
        order_id="WO-TEST-002",
        total_trays=20,
        pickup="取料货架 A-02",
        delivery="送料货架 B-02",
    )
    assert second.status == WorkOrderStatus.PENDING


def test_complete_starts_next_pending():
    store = WorkOrderStore()
    store.create(order_id="WO-1", total_trays=10, pickup="A", delivery="B")
    store.create(order_id="WO-2", total_trays=10, pickup="A", delivery="B")
    completed, started = store.complete("WO-1", 10)
    assert completed.status == WorkOrderStatus.COMPLETED
    assert started.id == "WO-2"
    assert started.status == WorkOrderStatus.IN_PROGRESS
