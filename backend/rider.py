"""Rider (delivery partner) API: login, online toggle, delivery requests, accept/reject,
pickup/deliver, real GPS location streaming, earnings and history."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import math
import bcrypt
import jwt

from core import (db, JWT_SECRET, JWT_ALGORITHM, JWT_DAYS, now_iso, oid, order_out, manager,
                  rider_manager, push_status, notify_partner)

router = APIRouter(prefix="/api/rider")
bearer = HTTPBearer(auto_error=False)

RIDER_DEFAULT_PASSWORD = "rider123"
OPEN_FOR_RIDERS = ["CONFIRMED", "PREPARING", "READY"]


async def seed_rider_logins():
    """Give every seeded rider an email/password (idempotent)."""
    async for r in db.riders.find({"email": {"$exists": False}}):
        first = r["name"].split()[0].lower()
        await db.riders.update_one({"_id": r["_id"]}, {"$set": {
            "email": f"{first}@rider.dashbite.in",
            "password_hash": bcrypt.hashpw(RIDER_DEFAULT_PASSWORD.encode(), bcrypt.gensalt()).decode(),
            "online": False,
        }})


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lng2 - lng1) * p)) / 2
    return 12742 * math.asin(math.sqrt(a))


def eta_minutes(lat, lng, dest_lat, dest_lng) -> int:
    if None in (lat, lng, dest_lat, dest_lng):
        return 10
    return max(1, round(haversine_km(lat, lng, dest_lat, dest_lng) / 25 * 60))  # 25 km/h city speed


def rider_out(r: dict) -> dict:
    return {"id": str(r["_id"]), "name": r["name"], "email": r.get("email"), "phone": r["phone"],
            "vehicle": r["vehicle"], "status": r.get("status", "available"), "online": r.get("online", False),
            "lat": r.get("lat"), "lng": r.get("lng")}


def earning_for(order: dict) -> int:
    return order["amounts"].get("delivery_fee", 0) + order["amounts"].get("tip", 0)


# ------------------------------------------------------------------ Auth
class LoginIn(BaseModel):
    email: EmailStr
    password: str


async def rider_from_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "rider":
            return None
        return await db.riders.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        return None


async def current_rider(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    rider = await rider_from_token(credentials.credentials)
    if not rider:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return rider


@router.post("/auth/login")
async def login(body: LoginIn):
    doc = await db.riders.find_one({"email": body.email.lower().strip()})
    if not doc or not bcrypt.checkpw(body.password.encode(), doc["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    now = datetime.now(timezone.utc)
    token = jwt.encode({"sub": str(doc["_id"]), "role": "rider", "iat": now, "exp": now + timedelta(days=JWT_DAYS)},
                       JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {"token": token, "rider": rider_out(doc)}


@router.get("/auth/me")
async def me(rider: dict = Depends(current_rider)):
    return rider_out(rider)


class OnlineIn(BaseModel):
    online: bool


@router.patch("/status")
async def set_online(body: OnlineIn, rider: dict = Depends(current_rider)):
    await db.riders.update_one({"_id": rider["_id"]}, {"$set": {"online": body.online}})
    return rider_out(await db.riders.find_one({"_id": rider["_id"]}))


# ------------------------------------------------------------------ Dashboard / requests
async def active_order_for(rider_id: str):
    return await db.orders.find_one({"rider.id": rider_id, "status": {"$in": OPEN_FOR_RIDERS + ["OUT_FOR_DELIVERY"]}})


@router.get("/dashboard")
async def dashboard(rider: dict = Depends(current_rider)):
    rid = str(rider["_id"])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    delivered = await db.orders.find({"rider.id": rid, "status": "DELIVERED"}).to_list(5000)
    todays = [o for o in delivered if o.get("delivered_at", o["created_at"]).startswith(today)]
    active = await active_order_for(rid)
    requests_count = await db.orders.count_documents({"status": {"$in": OPEN_FOR_RIDERS}, "rider": None})
    return {
        "rider": rider_out(rider),
        "today_deliveries": len(todays),
        "today_earnings": sum(earning_for(o) for o in todays),
        "total_deliveries": len(delivered),
        "total_earnings": sum(earning_for(o) for o in delivered),
        "pending_payout": sum(earning_for(o) for o in delivered if o.get("payout_status", "pending") != "paid"),
        "settled_total": sum(earning_for(o) for o in delivered if o.get("payout_status") == "paid"),
        "pending_requests": requests_count,
        "active_order": order_out(active) if active else None,
    }


@router.get("/requests")
async def requests(rider: dict = Depends(current_rider)):
    """Unassigned orders any online rider can pick up, plus orders the restaurant assigned to me."""
    rid = str(rider["_id"])
    pool = await db.orders.find({"status": {"$in": OPEN_FOR_RIDERS}, "rider": None}).sort("created_at", 1).to_list(50)
    mine = await db.orders.find({"status": {"$in": OPEN_FOR_RIDERS}, "rider.id": rid}).to_list(5)
    lat, lng = rider.get("lat"), rider.get("lng")

    def decorate(o):
        d = order_out(o)
        r = o["restaurant"]
        d["distance_km"] = round(haversine_km(lat, lng, r["lat"], r["lng"]), 1) if None not in (lat, lng, r.get("lat"), r.get("lng")) else None
        d["earning"] = earning_for(o)
        return d

    return {"requests": [decorate(o) for o in pool], "assigned": [decorate(o) for o in mine]}


# ------------------------------------------------------------------ Delivery workflow
async def my_order(order_id: str, rider: dict) -> dict:
    order = await db.orders.find_one({"_id": oid(order_id), "rider.id": str(rider["_id"])})
    if not order:
        raise HTTPException(status_code=403, detail="This order is not assigned to you")
    return order


@router.post("/orders/{order_id}/accept")
async def accept(order_id: str, rider: dict = Depends(current_rider)):
    rid = str(rider["_id"])
    if not rider.get("online", False):
        raise HTTPException(status_code=400, detail="Go online to accept deliveries")
    if await active_order_for(rid):
        raise HTTPException(status_code=400, detail="Finish your current delivery first")
    snapshot = {"id": rid, "name": rider["name"], "phone": rider["phone"], "vehicle": rider["vehicle"],
                "lat": rider.get("lat"), "lng": rider.get("lng")}
    # Atomic claim: only succeeds if nobody else has taken it
    res = await db.orders.update_one(
        {"_id": oid(order_id), "rider": None, "status": {"$in": OPEN_FOR_RIDERS}},
        {"$set": {"rider": snapshot}})
    if res.matched_count == 0:
        existing = await db.orders.find_one({"_id": oid(order_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Order not found")
        if existing.get("rider") is None and existing["status"] == "PLACED":
            raise HTTPException(status_code=400, detail="Restaurant hasn't accepted this order yet")
        if existing.get("rider") is None:
            raise HTTPException(status_code=400, detail="This order is no longer available")
        raise HTTPException(status_code=409, detail="This delivery was already taken")
    await db.riders.update_one({"_id": rider["_id"]}, {"$set": {"status": "busy", "order_id": order_id}})
    doc = await db.orders.find_one({"_id": oid(order_id)})
    await manager.broadcast(order_id, {"type": "rider", "rider": snapshot})
    await notify_partner(doc, "order_update")
    await rider_manager.broadcast("pool", {"type": "request_taken", "order_id": order_id})
    return order_out(doc)


@router.post("/orders/{order_id}/reject")
async def reject(order_id: str, rider: dict = Depends(current_rider)):
    order = await my_order(order_id, rider)
    if order["status"] == "OUT_FOR_DELIVERY":
        raise HTTPException(status_code=400, detail="Cannot reject after pickup")
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {"rider": None}})
    await db.riders.update_one({"_id": rider["_id"]}, {"$set": {"status": "available"}, "$unset": {"order_id": ""}})
    doc = await db.orders.find_one({"_id": order["_id"]})
    await manager.broadcast(order_id, {"type": "rider", "rider": None})
    await notify_partner(doc, "order_update")
    await rider_manager.broadcast("pool", {"type": "request_new", "order": order_out(doc)})
    return order_out(doc)


@router.post("/orders/{order_id}/pickup")
async def pickup(order_id: str, rider: dict = Depends(current_rider)):
    order = await my_order(order_id, rider)
    if order["status"] != "READY":
        raise HTTPException(status_code=400, detail="Restaurant hasn't marked this order ready yet")
    await push_status(order_id, "OUT_FOR_DELIVERY")
    return order_out(await db.orders.find_one({"_id": order["_id"]}))


@router.post("/orders/{order_id}/deliver")
async def deliver(order_id: str, rider: dict = Depends(current_rider)):
    order = my = await my_order(order_id, rider)
    if my["status"] != "OUT_FOR_DELIVERY":
        raise HTTPException(status_code=400, detail="Pick up the order before marking it delivered")
    await db.orders.update_one({"_id": order["_id"]},
                               {"$set": {"delivered_at": now_iso(), "rider_earning": earning_for(order),
                                         "payout_status": "pending"}})
    await push_status(order_id, "DELIVERED")
    await db.riders.update_one({"_id": rider["_id"]}, {"$set": {"status": "available"}, "$unset": {"order_id": ""}})
    return order_out(await db.orders.find_one({"_id": order["_id"]}))


# ------------------------------------------------------------------ Live GPS
class LocationIn(BaseModel):
    lat: float
    lng: float
    heading: float | None = None


@router.post("/location")
async def update_location(body: LocationIn, rider: dict = Depends(current_rider)):
    rid = str(rider["_id"])
    await db.riders.update_one({"_id": rider["_id"]}, {"$set": {"lat": body.lat, "lng": body.lng, "located_at": now_iso()}})
    active = await active_order_for(rid)
    if not active:
        return {"ok": True, "order_id": None}
    await db.orders.update_one({"_id": active["_id"]}, {"$set": {"rider.lat": body.lat, "rider.lng": body.lng}})
    if active["status"] == "OUT_FOR_DELIVERY":
        dest = active["address"]
    else:
        dest = active["restaurant"]
    eta = eta_minutes(body.lat, body.lng, dest.get("lat"), dest.get("lng"))
    await manager.broadcast(str(active["_id"]), {
        "type": "location", "rider": {"lat": body.lat, "lng": body.lng, "heading": body.heading},
        "eta_mins": eta, "status": active["status"]})
    return {"ok": True, "order_id": str(active["_id"]), "eta_mins": eta}


# ------------------------------------------------------------------ Earnings / history
@router.get("/history")
async def history(rider: dict = Depends(current_rider)):
    docs = await db.orders.find({"rider.id": str(rider["_id"]), "status": {"$in": ["DELIVERED", "CANCELLED"]}}) \
        .sort("created_at", -1).to_list(200)
    out = []
    for o in docs:
        d = order_out(o)
        d["earning"] = earning_for(o) if o["status"] == "DELIVERED" else 0
        d["payout_status"] = o.get("payout_status", "pending" if o["status"] == "DELIVERED" else None)
        d["paid_at"] = o.get("paid_at")
        out.append(d)
    payouts = await db.payouts.find({"rider_id": str(rider["_id"])}).sort("at", -1).to_list(50)
    for p in payouts:
        p["id"] = str(p.pop("_id"))
    return {"orders": out, "payouts": payouts}


# ------------------------------------------------------------------ Live feed
@router.websocket("/ws")
async def rider_ws(websocket: WebSocket, token: str = Query("")):
    rider = await rider_from_token(token)
    if not rider:
        await websocket.close(code=4401)
        return
    rid = str(rider["_id"])
    await rider_manager.connect("pool", websocket)
    rider_manager.active.setdefault(rid, set()).add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        rider_manager.disconnect("pool", websocket)
        rider_manager.disconnect(rid, websocket)
