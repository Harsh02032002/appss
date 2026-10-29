"""Restaurant partner API: owner login, live orders, accept/reject, status updates,
rider assignment, menu availability and open/close toggle."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import re
import bcrypt
import jwt

from core import (rider_manager, db, JWT_SECRET, JWT_ALGORITHM, JWT_DAYS, now_iso, oid, order_out, partner_manager,
                  push_status, notify_partner, notify_riders, manager)

router = APIRouter(prefix="/api/partner")
bearer = HTTPBearer(auto_error=False)

PARTNER_DEFAULT_PASSWORD = "partner123"
RIDERS_SEED = [
    {"name": "Ravi Kumar", "phone": "+91 98765 43210", "vehicle": "Bike · KA 01 AB 1234"},
    {"name": "Suresh Babu", "phone": "+91 98450 11223", "vehicle": "Scooter · KA 05 MX 4321"},
    {"name": "Imran Shaikh", "phone": "+91 99000 55667", "vehicle": "Bike · KA 03 HJ 9087"},
    {"name": "Manoj Reddy", "phone": "+91 97400 77889", "vehicle": "Bike · KA 51 ZZ 2211"},
    {"name": "Deepak Singh", "phone": "+91 96320 44556", "vehicle": "EV Scooter · KA 02 EV 7788"},
]


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


async def seed_partners():
    """One owner login per restaurant + a pool of riders (idempotent)."""
    async for r in db.restaurants.find():
        email = f"{slug(r['name'])}@partner.dashbite.in"
        if not await db.partner_users.find_one({"email": email}):
            await db.partner_users.insert_one({
                "email": email, "name": f"{r['name']} Owner", "restaurant_id": str(r["_id"]),
                "password_hash": bcrypt.hashpw(PARTNER_DEFAULT_PASSWORD.encode(), bcrypt.gensalt()).decode(),
                "created_at": now_iso(),
            })
    if await db.riders.count_documents({}) == 0:
        await db.riders.insert_many([{**r, "status": "available", "created_at": now_iso()} for r in RIDERS_SEED])


# ------------------------------------------------------------------ Auth
class LoginIn(BaseModel):
    email: EmailStr
    password: str


def make_partner_token(partner_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": partner_id, "role": "partner", "iat": now, "exp": now + timedelta(days=JWT_DAYS)},
                      JWT_SECRET, algorithm=JWT_ALGORITHM)


async def partner_from_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "partner":
            return None
        return await db.partner_users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        return None


async def current_partner(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    partner = await partner_from_token(credentials.credentials)
    if not partner:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return partner


async def partner_payload(partner: dict) -> dict:
    rest = await db.restaurants.find_one({"_id": ObjectId(partner["restaurant_id"])})
    return {
        "id": str(partner["_id"]), "name": partner["name"], "email": partner["email"],
        "restaurant": {"id": str(rest["_id"]), "name": rest["name"], "image": rest["image"],
                       "address": rest["address"], "rating": rest["rating"], "cuisines": rest["cuisines"],
                       "is_open": rest.get("is_open", True)},
    }


@router.post("/auth/login")
async def login(body: LoginIn):
    doc = await db.partner_users.find_one({"email": body.email.lower().strip()})
    ok = doc and bcrypt.checkpw(body.password.encode(), doc["password_hash"].encode())
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": make_partner_token(str(doc["_id"])), "partner": await partner_payload(doc)}


@router.get("/auth/me")
async def me(partner: dict = Depends(current_partner)):
    return await partner_payload(partner)


# ------------------------------------------------------------------ Dashboard
ACTIVE = ["PLACED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"]


@router.get("/dashboard")
async def dashboard(partner: dict = Depends(current_partner)):
    rid = partner["restaurant_id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    orders = await db.orders.find({"restaurant.id": rid}).to_list(2000)
    todays = [o for o in orders if o["created_at"].startswith(today)]
    delivered_today = [o for o in todays if o["status"] == "DELIVERED"]
    reviews = await db.reviews.find({"restaurant_id": rid}).to_list(1000)
    avg = round(sum(r["rating"] for r in reviews) / len(reviews), 1) if reviews else None
    return {
        "today_orders": len(todays),
        "today_revenue": sum(o["amounts"]["total"] for o in delivered_today),
        "pending": sum(1 for o in orders if o["status"] == "PLACED"),
        "active": sum(1 for o in orders if o["status"] in ACTIVE),
        "delivered_total": sum(1 for o in orders if o["status"] == "DELIVERED"),
        "avg_rating": avg,
        "review_count": len(reviews),
        "restaurant": (await partner_payload(partner))["restaurant"],
    }


class OpenIn(BaseModel):
    is_open: bool


@router.patch("/restaurant")
async def set_open(body: OpenIn, partner: dict = Depends(current_partner)):
    await db.restaurants.update_one({"_id": ObjectId(partner["restaurant_id"])}, {"$set": {"is_open": body.is_open}})
    return (await partner_payload(partner))["restaurant"]


# ------------------------------------------------------------------ Orders
async def own_order(order_id: str, partner: dict) -> dict:
    order = await db.orders.find_one({"_id": oid(order_id), "restaurant.id": partner["restaurant_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/orders")
async def list_orders(scope: str = "active", partner: dict = Depends(current_partner)):
    q: dict = {"restaurant.id": partner["restaurant_id"]}
    if scope == "active":
        q["status"] = {"$in": ACTIVE}
    elif scope == "past":
        q["status"] = {"$in": ["DELIVERED", "CANCELLED"]}
    docs = await db.orders.find(q).sort("created_at", -1).to_list(200)
    return {"orders": [order_out(d) for d in docs]}


@router.get("/orders/{order_id}")
async def get_order(order_id: str, partner: dict = Depends(current_partner)):
    return order_out(await own_order(order_id, partner))


@router.post("/orders/{order_id}/accept")
async def accept_order(order_id: str, partner: dict = Depends(current_partner)):
    order = await own_order(order_id, partner)
    if order["status"] != "PLACED":
        raise HTTPException(status_code=400, detail="Only new orders can be accepted")
    await push_status(order_id, "CONFIRMED")
    return order_out(await own_order(order_id, partner))


class RejectIn(BaseModel):
    reason: str = Field(default="Restaurant unable to fulfil", max_length=200)


@router.post("/orders/{order_id}/reject")
async def reject_order(order_id: str, body: RejectIn, partner: dict = Depends(current_partner)):
    order = await own_order(order_id, partner)
    if order["status"] not in ("PLACED", "CONFIRMED"):
        raise HTTPException(status_code=400, detail="Order can no longer be rejected")
    payment_status = "refund_initiated" if order.get("payment_status") == "paid" else "cancelled"
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"status": "CANCELLED", "payment_status": payment_status, "cancel_reason": body.reason},
         "$push": {"timeline": {"status": "CANCELLED", "at": now_iso()}}})
    await manager.broadcast(order_id, {"type": "status", "status": "CANCELLED", "eta_mins": 0})
    doc = await own_order(order_id, partner)
    await notify_partner(doc, "order_update")
    await notify_riders(doc)
    if order.get("rider"):
        await db.riders.update_one({"_id": ObjectId(order["rider"]["id"])}, {"$set": {"status": "available"}, "$unset": {"order_id": ""}})
    return order_out(doc)


class StatusIn(BaseModel):
    status: str  # PREPARING | READY


NEXT_ALLOWED = {"CONFIRMED": "PREPARING", "PREPARING": "READY"}


@router.post("/orders/{order_id}/status")
async def update_status(order_id: str, body: StatusIn, partner: dict = Depends(current_partner)):
    order = await own_order(order_id, partner)
    if NEXT_ALLOWED.get(order["status"]) != body.status:
        raise HTTPException(status_code=400, detail=f"Cannot move from {order['status']} to {body.status}")
    await push_status(order_id, body.status)
    return order_out(await own_order(order_id, partner))


class AssignIn(BaseModel):
    rider_id: str


@router.post("/orders/{order_id}/assign-rider")
async def assign_rider(order_id: str, body: AssignIn, partner: dict = Depends(current_partner)):
    order = await own_order(order_id, partner)
    if order["status"] not in ("CONFIRMED", "PREPARING", "READY"):
        raise HTTPException(status_code=400, detail="Accept the order before assigning a rider")
    if order.get("rider"):
        raise HTTPException(status_code=400, detail="A rider is already assigned")
    rider = await db.riders.find_one({"_id": oid(body.rider_id)})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    if rider.get("status") != "available":
        raise HTTPException(status_code=400, detail=f"{rider['name']} is busy on another delivery")
    rider_snapshot = {"id": str(rider["_id"]), "name": rider["name"], "phone": rider["phone"],
                      "vehicle": rider["vehicle"], "lat": order["restaurant"].get("lat"),
                      "lng": order["restaurant"].get("lng")}
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {"rider": rider_snapshot}})
    await db.riders.update_one({"_id": rider["_id"]}, {"$set": {"status": "busy", "order_id": order_id}})
    await manager.broadcast(order_id, {"type": "rider", "rider": rider_snapshot})
    doc = await own_order(order_id, partner)
    await notify_partner(doc, "order_update")
    await notify_riders(doc)
    await rider_manager.broadcast("pool", {"type": "request_taken", "order_id": order_id})
    return order_out(doc)


@router.get("/riders")
async def list_riders(partner: dict = Depends(current_partner)):
    docs = await db.riders.find().to_list(50)
    return {"riders": [{"id": str(d["_id"]), "name": d["name"], "phone": d["phone"], "vehicle": d["vehicle"],
                        "status": d.get("status", "available"), "online": d.get("online", False)} for d in docs]}


# ------------------------------------------------------------------ Rider payouts
def rider_earning(o: dict) -> int:
    return o["amounts"].get("delivery_fee", 0) + o["amounts"].get("tip", 0)


@router.get("/payouts")
async def payouts(partner: dict = Depends(current_partner)):
    """Per-rider settlement summary for deliveries of this restaurant."""
    riders = await db.riders.find().to_list(50)
    delivered = await db.orders.find({"restaurant.id": partner["restaurant_id"], "status": "DELIVERED",
                                      "rider": {"$ne": None}}).to_list(5000)
    # ascending sort so the most recent payout per rider wins in the dict
    last_payouts = {p["rider_id"]: p async for p in db.payouts.find({"restaurant_id": partner["restaurant_id"]}).sort("at", 1)}
    out = []
    for r in riders:
        rid = str(r["_id"])
        mine = [o for o in delivered if o["rider"].get("id") == rid]
        pending = [o for o in mine if o.get("payout_status", "pending") != "paid"]
        paid = [o for o in mine if o.get("payout_status") == "paid"]
        out.append({
            "id": rid, "name": r["name"], "phone": r["phone"], "vehicle": r["vehicle"],
            "online": r.get("online", False), "status": r.get("status", "available"),
            "pending_amount": sum(rider_earning(o) for o in pending), "pending_count": len(pending),
            "paid_amount": sum(rider_earning(o) for o in paid), "delivered_count": len(mine),
            "last_payout": ({"amount": last_payouts[rid]["amount"], "at": last_payouts[rid]["at"]}
                            if rid in last_payouts else None),
        })
    out.sort(key=lambda x: x["pending_amount"], reverse=True)
    return {"riders": out, "total_pending": sum(x["pending_amount"] for x in out)}


@router.post("/payouts/{rider_id}/settle")
async def settle_rider(rider_id: str, partner: dict = Depends(current_partner)):
    rider = await db.riders.find_one({"_id": oid(rider_id)})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    q = {"restaurant.id": partner["restaurant_id"], "status": "DELIVERED", "rider.id": rider_id,
         "payout_status": {"$ne": "paid"}}
    pending = await db.orders.find(q).to_list(5000)
    if not pending:
        raise HTTPException(status_code=400, detail="Nothing pending for this rider")
    paid_at = now_iso()
    # Claim atomically: only orders that are still unpaid get stamped with this payout time
    await db.orders.update_many({"_id": {"$in": [o["_id"] for o in pending]}, "payout_status": {"$ne": "paid"}},
                                {"$set": {"payout_status": "paid", "paid_at": paid_at}})
    claimed = await db.orders.find({"rider.id": rider_id, "paid_at": paid_at}).to_list(5000)
    if not claimed:
        raise HTTPException(status_code=400, detail="Nothing pending for this rider")
    amount = sum(rider_earning(o) for o in claimed)
    pending = claimed
    payout = {"rider_id": rider_id, "restaurant_id": partner["restaurant_id"], "amount": amount,
              "deliveries": len(pending), "at": paid_at, "by": partner["email"]}
    await db.payouts.insert_one(payout)
    await rider_manager.broadcast(rider_id, {"type": "payout", "amount": amount, "deliveries": len(pending), "at": paid_at})
    return {"rider_id": rider_id, "amount": amount, "deliveries": len(pending), "at": paid_at}


# ------------------------------------------------------------------ Menu
@router.get("/menu")
async def menu(partner: dict = Depends(current_partner)):
    items = await db.menu_items.find({"restaurant_id": ObjectId(partner["restaurant_id"])}).to_list(300)
    out = []
    for i in items:
        i["id"] = str(i.pop("_id"))
        i["restaurant_id"] = str(i["restaurant_id"])
        i.setdefault("available", True)
        i.pop("created_at", None)
        out.append(i)
    return {"menu": out}


class AvailabilityIn(BaseModel):
    available: bool


@router.patch("/menu/{item_id}")
async def set_availability(item_id: str, body: AvailabilityIn, partner: dict = Depends(current_partner)):
    res = await db.menu_items.update_one(
        {"_id": oid(item_id), "restaurant_id": ObjectId(partner["restaurant_id"])},
        {"$set": {"available": body.available}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"id": item_id, "available": body.available}


# ------------------------------------------------------------------ Live feed
@router.websocket("/ws")
async def partner_ws(websocket: WebSocket, token: str = Query("")):
    partner = await partner_from_token(token)
    if not partner:
        await websocket.close(code=4401)
        return
    rid = partner["restaurant_id"]
    await partner_manager.connect(rid, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        partner_manager.disconnect(rid, websocket)
    except Exception:
        partner_manager.disconnect(rid, websocket)
