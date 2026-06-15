from fastapi import HTTPException, status

from app.data import store
from app.schemas.supply import PurchaseOrderCreate

STATUS_TRANSITIONS = {
    "draft": ["ordered", "cancelled"],
    "ordered": ["received", "cancelled"],
    "received": [],
    "cancelled": [],
}

STATUS_LABELS = {
    "draft": "草稿",
    "ordered": "已下单",
    "received": "已收货",
    "cancelled": "已取消",
}

ACTION_LABELS = {
    "ordered": "下单",
    "received": "入库收货",
    "cancelled": "取消订单",
}


def get_available_actions(current_status: str) -> list[str]:
    return STATUS_TRANSITIONS.get(current_status, [])


def validate_status_transition(current_status: str, target_status: str) -> None:
    allowed = STATUS_TRANSITIONS.get(current_status, [])
    if target_status not in allowed:
        current_label = STATUS_LABELS.get(current_status, current_status)
        target_label = STATUS_LABELS.get(target_status, target_status)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"状态流转非法：无法从「{current_label}」变为「{target_label}」",
        )


def list_ingredients() -> list[dict]:
    return list(store.ingredients.values())


def list_suppliers() -> list[dict]:
    return list(store.suppliers.values())


def list_purchase_orders() -> list[dict]:
    return list(store.purchase_orders.values())


def create_purchase_order(payload: PurchaseOrderCreate) -> dict:
    if payload.supplier_id not in store.suppliers:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    total = 0.0
    for item in payload.items:
        if item.ingredient_id not in store.ingredients:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ingredient {item.ingredient_id} not found")
        total += item.qty * item.unit_price

    order = {
        "id": store.new_id("po"),
        **payload.model_dump(),
        "status": "ordered",
        "total_amount": round(total, 2),
    }
    store.purchase_orders[order["id"]] = order
    return order


def update_purchase_status(order_id: str, status_value: str) -> dict:
    order = store.purchase_orders.get(order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    previous_status = order["status"]
    validate_status_transition(previous_status, status_value)

    order["status"] = status_value
    if status_value == "received" and previous_status != "received":
        for item in order["items"]:
            ingredient = store.ingredients[item["ingredient_id"]]
            ingredient["stock_qty"] = round(ingredient["stock_qty"] + item["qty"], 2)
            ingredient["avg_price"] = round(item["unit_price"], 2)
    return order


def get_purchase_order_available_actions(order_id: str) -> dict:
    order = store.purchase_orders.get(order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    current_status = order["status"]
    available = get_available_actions(current_status)
    return {
        "current_status": current_status,
        "current_status_label": STATUS_LABELS.get(current_status, current_status),
        "available_actions": [
            {
                "status": action,
                "label": ACTION_LABELS.get(action, action),
            }
            for action in available
        ],
    }

