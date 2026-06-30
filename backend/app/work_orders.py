"""工单池管理（云端权威源）。"""

from __future__ import annotations

from traybot_protocol.models import WorkOrder, WorkOrderStatus


def normalize_queue(orders: list[WorkOrder]) -> list[WorkOrder]:
    active_assigned = False
    normalized: list[WorkOrder] = []
    for order in orders:
        if order.status != WorkOrderStatus.IN_PROGRESS:
            normalized.append(order)
            continue
        if active_assigned:
            normalized.append(order.model_copy(update={"status": WorkOrderStatus.PENDING}))
        else:
            active_assigned = True
            normalized.append(order)
    return normalized


class WorkOrderStore:
    def __init__(self) -> None:
        # 初始为空，工单仅通过 POST /api/workorders 手动下发
        self._orders: list[WorkOrder] = []

    @property
    def orders(self) -> list[WorkOrder]:
        return list(self._orders)

    def to_feed_list(self) -> list[dict]:
        return [o.to_feed_dict() for o in self._orders]

    def get_in_progress(self) -> WorkOrder | None:
        return next((o for o in self._orders if o.status == WorkOrderStatus.IN_PROGRESS), None)

    def get_by_id(self, order_id: str) -> WorkOrder | None:
        return next((o for o in self._orders if o.id == order_id), None)

    def update_progress(self, order_id: str, delivered_trays: int) -> WorkOrder | None:
        for i, o in enumerate(self._orders):
            if o.id == order_id:
                updated = o.model_copy(update={"delivered_trays": delivered_trays})
                self._orders[i] = updated
                self._orders = normalize_queue(self._orders)
                return updated
        return None

    def complete(self, order_id: str, delivered_trays: int) -> tuple[WorkOrder | None, WorkOrder | None]:
        completed: WorkOrder | None = None
        for i, o in enumerate(self._orders):
            if o.id == order_id:
                completed = o.model_copy(
                    update={
                        "delivered_trays": delivered_trays,
                        "status": WorkOrderStatus.COMPLETED,
                    }
                )
                self._orders[i] = completed
                break

        started: WorkOrder | None = None
        for i, o in enumerate(self._orders):
            if o.status == WorkOrderStatus.PENDING:
                started = o.model_copy(update={"status": WorkOrderStatus.IN_PROGRESS})
                self._orders[i] = started
                break

        self._orders = normalize_queue(self._orders)
        if started is None:
            started = self.get_in_progress()
        return completed, started

    def assign_payload(self, order: WorkOrder) -> dict:
        return {
            "id": order.id,
            "totalTrays": order.total_trays,
            "deliveredTrays": order.delivered_trays,
            "pickup": order.pickup,
            "delivery": order.delivery,
            "backpackCapacity": order.backpack_capacity,
        }

    def create(
        self,
        *,
        order_id: str,
        total_trays: int,
        pickup: str,
        delivery: str,
        backpack_capacity: int = 20,
    ) -> WorkOrder:
        if any(o.id == order_id for o in self._orders):
            raise ValueError(f"工单 {order_id} 已存在")
        order = WorkOrder(
            id=order_id,
            total_trays=total_trays,
            delivered_trays=0,
            pickup=pickup,
            delivery=delivery,
            backpack_capacity=backpack_capacity,
            status=WorkOrderStatus.PENDING,
        )
        # 无进行中工单时，新工单自动升为 in_progress（否则排队 pending）
        if self.get_in_progress() is None:
            order = order.model_copy(update={"status": WorkOrderStatus.IN_PROGRESS})
        self._orders.append(order)
        self._orders = normalize_queue(self._orders)
        return next(o for o in self._orders if o.id == order_id)
