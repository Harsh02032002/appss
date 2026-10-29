"""Shared infrastructure: DB, JWT config, helpers, WebSocket managers and delivery simulation.
Imported by server.py (customer API) and partner.py (restaurant partner API)."""
from fastapi import WebSocket, HTTPException
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from pathlib import Path
import os
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
rider_manager = ConnectionManager()    # keyed by rider_id, plus "pool" for unassigned requests


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
        await notify_riders(doc)


async def notify_riders(order_doc: dict):
    """Assigned rider gets every update; unassigned orders restaurants are cooking go to the pool."""
    payload = {"type": "order_update", "order": order_out(order_doc)}
    if order_doc.get("rider"):
        await rider_manager.broadcast(order_doc["rider"]["id"], payload)
    elif order_doc["status"] in ("CONFIRMED", "PREPARING", "READY"):
        await rider_manager.broadcast("pool", {"type": "request_new", "order": order_out(order_doc)})
    elif order_doc["status"] == "CANCELLED":
        await rider_manager.broadcast("pool", {"type": "request_taken", "order_id": str(order_doc["_id"])})
