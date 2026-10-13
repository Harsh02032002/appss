"""Shared infrastructure: DB, JWT config, helpers, WebSocket managers and delivery simulation.
Imported by server.py (customer API) and partner.py (restaurant partner API)."""
from fastapi import WebSocket, HTTPException
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from pathlib import Path
import os
import asyncio
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
JWT_DAYS = 7

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("dashbite")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def oid(id_str: str) -> ObjectId:
    if not ObjectId.is_valid(id_str):
        raise HTTPException(status_code=404, detail="Not found")
    return ObjectId(id_str)


def order_out(doc: dict) -> dict:
    d = dict(doc)
    d["id"] = str(d.pop("_id"))
    return d


# Order lifecycle:
# PAYMENT_PENDING -> PLACED -> CONFIRMED (accepted) -> PREPARING -> READY -> OUT_FOR_DELIVERY -> DELIVERED
# CANCELLED (customer within 60s, or restaurant rejects)
ETA_BY_STATUS = {"PLACED": 40, "CONFIRMED": 35, "PREPARING": 25, "READY": 15,
                 "OUT_FOR_DELIVERY": 10, "DELIVERED": 0, "CANCELLED": 0}


# ------------------------------------------------------------------ WebSocket managers
class ConnectionManager:
    def __init__(self):
        self.active: dict[str, set] = {}

    async def connect(self, key: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(key, set()).add(ws)

    def disconnect(self, key: str, ws: WebSocket):
        conns = self.active.get(key)
        if conns:
            conns.discard(ws)
            if not conns:
                self.active.pop(key, None)

    async def broadcast(self, key: str, payload: dict):
        for ws in list(self.active.get(key, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(key, ws)


manager = ConnectionManager()          # keyed by order_id (customer tracking)
partner_manager = ConnectionManager()  # keyed by restaurant_id (partner dashboard)
sim_tasks: dict[str, asyncio.Task] = {}


async def notify_partner(order_doc: dict, event: str):
    await partner_manager.broadcast(order_doc["restaurant"]["id"], {"type": event, "order": order_out(order_doc)})


async def push_status(order_id: str, status: str):
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": status},
         "$push": {"timeline": {"status": status, "at": now_iso()}}})
    await manager.broadcast(order_id, {
        "type": "status", "status": status, "eta_mins": ETA_BY_STATUS.get(status, 30)})
    doc = await db.orders.find_one({"_id": ObjectId(order_id)})
    if doc:
        await notify_partner(doc, "order_update")


# ------------------------------------------------------------------ Delivery simulation (rider leg only)
async def simulate_ride(order_id: str):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        return
    r_lat = order["restaurant"].get("lat") or 12.9716
    r_lng = order["restaurant"].get("lng") or 77.5946
    a_lat = order["address"].get("lat") or r_lat + 0.02
    a_lng = order["address"].get("lng") or r_lng + 0.015
    steps = 12
    for i in range(1, steps + 1):
        await asyncio.sleep(5)
        frac = i / steps
        lat = r_lat + (a_lat - r_lat) * frac
        lng = r_lng + (a_lng - r_lng) * frac
        await db.orders.update_one({"_id": ObjectId(order_id)},
                                   {"$set": {"rider.lat": lat, "rider.lng": lng}})
        await manager.broadcast(order_id, {
            "type": "location", "rider": {"lat": lat, "lng": lng},
            "progress": frac, "eta_mins": max(1, round((1 - frac) * 8))})


async def simulate_delivery(order_id: str):
    """Runs once the restaurant marks the order READY and a rider is assigned:
    rider picks up (~5s) -> OUT_FOR_DELIVERY -> ride (~60s) -> DELIVERED."""
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if not order or not order.get("rider"):
            return
        if order["status"] == "READY":
            await asyncio.sleep(5)
            await push_status(order_id, "OUT_FOR_DELIVERY")
        elif order["status"] != "OUT_FOR_DELIVERY":
            return
        await simulate_ride(order_id)
        await push_status(order_id, "DELIVERED")
        await db.riders.update_one({"_id": ObjectId(order["rider"]["id"])}, {"$set": {"status": "available"}})
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error("delivery simulation error for %s: %s", order_id, e)
    finally:
        sim_tasks.pop(order_id, None)


def spawn_delivery(order_id: str):
    task = sim_tasks.get(order_id)
    if task is None or task.done():
        sim_tasks[order_id] = asyncio.create_task(simulate_delivery(order_id))


def cancel_simulation(order_id: str):
    task = sim_tasks.pop(order_id, None)
    if task and not task.done():
        task.cancel()
