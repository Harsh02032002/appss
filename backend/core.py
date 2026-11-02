"""Shared infrastructure: DB, JWT config, helpers, WebSocket managers and delivery simulation.
Imported by server.py (customer API) and partner.py (restaurant partner API)."""
from fastapi import WebSocket, HTTPException
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from pathlib import Path
import asyncio
import dns.resolver
import os
import logging

# Configure public DNS (Google + Cloudflare) to prevent SRV ECONNREFUSED on local/cloud networks
try:
    _dns_resolver = dns.resolver.Resolver(configure=False)
    _dns_resolver.nameservers = ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]
    _dns_resolver.timeout = 5.0
    _dns_resolver.lifetime = 10.0
    dns.resolver.default_resolver = _dns_resolver
except Exception:
    pass

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

DEFAULT_FOOD_SRV = "mongodb+srv://Harsh:Harsh%402925@cluster0.hddqr9e.mongodb.net/food?retryWrites=true&w=majority&appName=Cluster0"
DIRECT_FOOD_FALLBACK = (
    "mongodb://Harsh:Harsh%402925@"
    "ac-dxh54g9-shard-00-00.hddqr9e.mongodb.net:27017,"
    "ac-dxh54g9-shard-00-01.hddqr9e.mongodb.net:27017,"
    "ac-dxh54g9-shard-00-02.hddqr9e.mongodb.net:27017/food"
    "?ssl=true&replicaSet=atlas-131fot-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0"
)

mongo_url = (os.environ.get('MONGO_URI') or os.environ.get('MONGO_URL') or DEFAULT_FOOD_SRV).strip().strip('"').strip()
db_name = os.environ.get('DB_NAME', 'food').strip().strip('"').strip()

_clients: dict[int, AsyncIOMotorClient] = {}


def get_client() -> AsyncIOMotorClient:
    try:
        loop_id = id(asyncio.get_running_loop())
    except RuntimeError:
        loop_id = 0
    c = _clients.get(loop_id)
    if c is None:
        try:
            c = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
        except Exception:
            c = AsyncIOMotorClient(DIRECT_FOOD_FALLBACK, serverSelectionTimeoutMS=10000)
        _clients[loop_id] = c
    return c


class _LoopAwareClient:
    def close(self):
        for c in list(_clients.values()):
            try:
                c.close()
            except Exception:
                pass
        _clients.clear()


class _LoopAwareDB:
    def __getattr__(self, name: str):
        return getattr(get_client()[db_name], name)

    def __getitem__(self, name: str):
        return get_client()[db_name][name]


client = _LoopAwareClient()
db = _LoopAwareDB()

JWT_SECRET = os.environ.get('JWT_SECRET', 'dashbite-production-jwt-secret').strip().strip('"')
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
