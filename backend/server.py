from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict, EmailStr, BeforeValidator
from typing import Optional, List, Annotated
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os
import re
import hmac
import hashlib
import asyncio
import logging
import bcrypt
import jwt
import httpx

from seed import seed_database, CATEGORIES, BANNERS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
JWT_DAYS = 7
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
RAZORPAY_URL = "https://api.razorpay.com/v1"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Mongo helpers (ObjectId <-> str)
# ------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: PyObjectId = Field(default_factory=lambda: str(ObjectId()), alias="_id")

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True)
        if isinstance(data.get("_id"), str):
            data["_id"] = ObjectId(data["_id"])
        return data

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls(**doc)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def oid(id_str: str) -> ObjectId:
    if not ObjectId.is_valid(id_str):
        raise HTTPException(status_code=404, detail="Not found")
    return ObjectId(id_str)


# ------------------------------------------------------------------
# Models
# ------------------------------------------------------------------
class User(BaseDocument):
    name: str
    email: str
    phone: str = ""
    password_hash: str
    created_at: str = Field(default_factory=now_iso)


class Address(BaseDocument):
    user_id: str
    label: str = "Home"
    line1: str
    landmark: str = ""
    city: str = ""
    pincode: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_default: bool = False
    created_at: str = Field(default_factory=now_iso)


class AddressIn(BaseModel):
    label: str = "Home"
    line1: str
    landmark: str = ""
    city: str = ""
    pincode: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_default: bool = False


class OrderItemIn(BaseModel):
    item_id: str
    qty: int = Field(gt=0, le=20)
    notes: str = ""


class OrderAddressSnapshot(BaseModel):
    label: str = "Home"
    line1: str
    landmark: str = ""
    city: str = ""
    pincode: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None


class OrderCreateIn(BaseModel):
    items: List[OrderItemIn]
    address: OrderAddressSnapshot
    payment_method: str  # "cod" | "razorpay"
    tip: int = 0  # paise
    coupon_code: str = ""


class CouponValidateIn(BaseModel):
    code: str
    subtotal: int  # paise


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)


# ------------------------------------------------------------------
# Auth
# ------------------------------------------------------------------
bearer = HTTPBearer(auto_error=False)


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": user_id, "iat": now, "exp": now + timedelta(days=JWT_DAYS)},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


async def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def public_user(doc: dict) -> dict:
    return {"id": str(doc["_id"]), "name": doc["name"], "email": doc["email"], "phone": doc.get("phone", "")}


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: EmailStr
    phone: str = ""
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@api_router.post("/auth/register", status_code=201)
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(name=body.name.strip(), email=email, phone=body.phone.strip(),
                password_hash=hash_password(body.password))
    result = await db.users.insert_one(user.to_mongo())
    doc = await db.users.find_one({"_id": result.inserted_id})
    return {"token": make_token(str(doc["_id"])), "user": public_user(doc)}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower().strip()
    doc = await db.users.find_one({"email": email})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": make_token(str(doc["_id"])), "user": public_user(doc)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


# ------------------------------------------------------------------
# Browsing
# ------------------------------------------------------------------
def restaurant_out(doc: dict) -> dict:
    d = dict(doc)
    d["id"] = str(d.pop("_id"))
    d.pop("created_at", None)
    return d


def item_out(doc: dict) -> dict:
    d = dict(doc)
    d["id"] = str(d.pop("_id"))
    d["restaurant_id"] = str(d["restaurant_id"])
    d.pop("created_at", None)
    return d


@api_router.get("/")
async def root():
    return {"message": "DashBite API"}


@api_router.get("/home")
async def home():
    featured = await db.restaurants.find().sort("rating", -1).limit(6).to_list(6)
    return {
        "categories": CATEGORIES,
        "banners": BANNERS,
        "featured": [restaurant_out(r) for r in featured],
    }


@api_router.get("/restaurants")
async def list_restaurants(q: str = "", cuisine: str = "", sort: str = ""):
    query: dict = {}
    if cuisine:
        query["cuisines"] = {"$regex": f"^{re.escape(cuisine)}$", "$options": "i"}
    if q:
        query["$or"] = [
            {"name": {"$regex": re.escape(q), "$options": "i"}},
            {"cuisines": {"$regex": re.escape(q), "$options": "i"}},
        ]
    cursor = db.restaurants.find(query)
    if sort == "rating":
        cursor = cursor.sort("rating", -1)
    docs = await cursor.to_list(100)
    return {"restaurants": [restaurant_out(d) for d in docs]}


@api_router.get("/restaurants/{restaurant_id}")
async def restaurant_details(restaurant_id: str):
    doc = await db.restaurants.find_one({"_id": oid(restaurant_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    items = await db.menu_items.find({"restaurant_id": doc["_id"]}).to_list(200)
    reviews = await db.reviews.find({"restaurant_id": restaurant_id}).sort("created_at", -1).to_list(10)
    for r in reviews:
        r["id"] = str(r.pop("_id"))
    return {"restaurant": restaurant_out(doc), "menu": [item_out(i) for i in items], "reviews": reviews}


# ------------------------------------------------------------------
# Favourites (auth)
# ------------------------------------------------------------------
@api_router.get("/favorites")
async def list_favorites(user: dict = Depends(current_user)):
    favs = await db.favorites.find({"user_id": str(user["_id"])}).sort("created_at", -1).to_list(200)
    ids = [f["restaurant_id"] for f in favs]
    docs = await db.restaurants.find({"_id": {"$in": [ObjectId(i) for i in ids]}}).to_list(200)
    by_id = {str(d["_id"]): d for d in docs}
    ordered = [restaurant_out(by_id[i]) for i in ids if i in by_id]
    return {"ids": ids, "restaurants": ordered}


@api_router.post("/favorites/{restaurant_id}")
async def toggle_favorite(restaurant_id: str, user: dict = Depends(current_user)):
    rest = await db.restaurants.find_one({"_id": oid(restaurant_id)})
    if not rest:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    uid = str(user["_id"])
    existing = await db.favorites.find_one({"user_id": uid, "restaurant_id": restaurant_id})
    if existing:
        await db.favorites.delete_one({"_id": existing["_id"]})
        return {"favorited": False}
    await db.favorites.insert_one({"user_id": uid, "restaurant_id": restaurant_id, "created_at": now_iso()})
    return {"favorited": True}


# ------------------------------------------------------------------
# Coupons
# ------------------------------------------------------------------
COUPONS = {
    "WELCOME50": {"type": "percent", "value": 50, "max": 10000, "min_order": 19900,
                  "title": "50% off up to ₹100", "description": "On orders above ₹199"},
    "FLAT100": {"type": "flat", "value": 10000, "max": 10000, "min_order": 49900,
                "title": "Flat ₹100 off", "description": "On orders above ₹499"},
    "TASTY20": {"type": "percent", "value": 20, "max": 7500, "min_order": 14900,
                "title": "20% off up to ₹75", "description": "On orders above ₹149"},
    "FREEDEL": {"type": "free_delivery", "value": 0, "max": 0, "min_order": 29900,
                "title": "Free delivery", "description": "On orders above ₹299"},
}


def apply_coupon(code: str, subtotal: int) -> dict:
    """Returns {code, discount, free_delivery, title}. Raises 400 if invalid."""
    code = code.strip().upper()
    if not code:
        return {"code": "", "discount": 0, "free_delivery": False, "title": ""}
    c = COUPONS.get(code)
    if not c:
        raise HTTPException(status_code=400, detail="Invalid coupon code")
    if subtotal < c["min_order"]:
        raise HTTPException(status_code=400,
                            detail=f"Add items worth ₹{(c['min_order'] - subtotal) // 100 + 1} more to use {code}")
    if c["type"] == "percent":
        discount = min(round(subtotal * c["value"] / 100), c["max"])
    elif c["type"] == "flat":
        discount = min(c["value"], subtotal)
    else:
        discount = 0
    return {"code": code, "discount": discount, "free_delivery": c["type"] == "free_delivery", "title": c["title"]}


@api_router.get("/coupons")
async def list_coupons():
    return {"coupons": [{"code": k, "title": v["title"], "description": v["description"],
                         "min_order": v["min_order"]} for k, v in COUPONS.items()]}


@api_router.post("/coupons/validate")
async def validate_coupon(body: CouponValidateIn):
    return apply_coupon(body.code, body.subtotal)


@api_router.get("/menu-items/{item_id}")
async def menu_item_details(item_id: str):
    doc = await db.menu_items.find_one({"_id": oid(item_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Item not found")
    rest = await db.restaurants.find_one({"_id": doc["restaurant_id"]})
    out = item_out(doc)
    if rest:
        out["restaurant"] = restaurant_out(rest)
    return out


@api_router.get("/search")
async def search(q: str = ""):
    if not q.strip():
        return {"restaurants": [], "dishes": []}
    regex = {"$regex": re.escape(q.strip()), "$options": "i"}
    rests = await db.restaurants.find({"$or": [{"name": regex}, {"cuisines": regex}]}).to_list(50)
    dishes = await db.menu_items.find({"$or": [{"name": regex}, {"category": regex}]}).to_list(50)
    rest_map = {r["_id"]: r for r in await db.restaurants.find(
        {"_id": {"$in": [d["restaurant_id"] for d in dishes]}}).to_list(50)}
    dish_out = []
    for d in dishes:
        o = item_out(d)
        r = rest_map.get(d["restaurant_id"])
        if r:
            o["restaurant_name"] = r["name"]
            o["restaurant_rating"] = r["rating"]
            o["delivery_time"] = r["delivery_time"]
        dish_out.append(o)
    return {"restaurants": [restaurant_out(r) for r in rests], "dishes": dish_out}


# ------------------------------------------------------------------
# Addresses (auth)
# ------------------------------------------------------------------
@api_router.get("/addresses")
async def list_addresses(user: dict = Depends(current_user)):
    docs = await db.addresses.find({"user_id": str(user["_id"])}).to_list(50)
    out = []
    for d in docs:
        d["id"] = str(d.pop("_id"))
        out.append(d)
    return {"addresses": out}


@api_router.post("/addresses", status_code=201)
async def create_address(body: AddressIn, user: dict = Depends(current_user)):
    uid = str(user["_id"])
    count = await db.addresses.count_documents({"user_id": uid})
    addr = Address(user_id=uid, **body.model_dump())
    if count == 0:
        addr.is_default = True
    if addr.is_default:
        await db.addresses.update_many({"user_id": uid}, {"$set": {"is_default": False}})
    result = await db.addresses.insert_one(addr.to_mongo())
    doc = await db.addresses.find_one({"_id": result.inserted_id})
    doc["id"] = str(doc.pop("_id"))
    return doc


@api_router.put("/addresses/{address_id}")
async def update_address(address_id: str, body: AddressIn, user: dict = Depends(current_user)):
    uid = str(user["_id"])
    if body.is_default:
        await db.addresses.update_many({"user_id": uid}, {"$set": {"is_default": False}})
    result = await db.addresses.update_one(
        {"_id": oid(address_id), "user_id": uid}, {"$set": body.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")
    doc = await db.addresses.find_one({"_id": ObjectId(address_id)})
    doc["id"] = str(doc.pop("_id"))
    return doc


@api_router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, user: dict = Depends(current_user)):
    result = await db.addresses.delete_one({"_id": oid(address_id), "user_id": str(user["_id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")
    return {"ok": True}


# ------------------------------------------------------------------
# Orders + Payments
# ------------------------------------------------------------------
ORDER_STATUSES = ["PAYMENT_PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"]
DELIVERY_FEE = 3500  # paise
RIDER = {"name": "Ravi Kumar", "phone": "+91 98765 43210"}


def order_out(doc: dict) -> dict:
    d = dict(doc)
    d["id"] = str(d.pop("_id"))
    return d


async def compute_totals(items: List[OrderItemIn]):
    ids = [oid(i.item_id) for i in items]
    docs = await db.menu_items.find({"_id": {"$in": ids}}).to_list(100)
    by_id = {str(d["_id"]): d for d in docs}
    if len(by_id) != len(set(i.item_id for i in items)):
        raise HTTPException(status_code=400, detail="Some items are unavailable")
    restaurant_ids = {d["restaurant_id"] for d in docs}
    if len(restaurant_ids) != 1:
        raise HTTPException(status_code=400, detail="All items must be from one restaurant")
    line_items = []
    subtotal = 0
    for i in items:
        d = by_id[i.item_id]
        line_total = d["price"] * i.qty
        subtotal += line_total
        line_items.append({
            "item_id": i.item_id, "name": d["name"], "price": d["price"],
            "qty": i.qty, "veg": d["veg"], "image": d["image"], "notes": i.notes,
        })
    taxes = round(subtotal * 0.05)
    return line_items, restaurant_ids.pop(), subtotal, taxes


async def create_razorpay_order(amount_paise: int, receipt: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.post(
            f"{RAZORPAY_URL}/orders",
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            json={"amount": amount_paise, "currency": "INR", "receipt": receipt,
                  "payment_capture": 1},
        )
    if r.status_code >= 400:
        logger.error("Razorpay order failed: %s", r.text)
        raise HTTPException(status_code=502, detail="Payment gateway error")
    return r.json()


@api_router.post("/orders", status_code=201)
async def create_order(body: OrderCreateIn, user: dict = Depends(current_user)):
    if not body.items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    line_items, restaurant_id, subtotal, taxes = await compute_totals(body.items)
    tip = max(0, body.tip)
    coupon = apply_coupon(body.coupon_code, subtotal)
    delivery_fee = 0 if coupon["free_delivery"] else DELIVERY_FEE
    discount = coupon["discount"]
    total = subtotal + delivery_fee + taxes + tip - discount
    restaurant = await db.restaurants.find_one({"_id": restaurant_id})
    address = body.address.model_dump()
    if address.get("lat") is None:
        address["lat"] = (restaurant.get("lat") or 12.9716) + 0.018
        address["lng"] = (restaurant.get("lng") or 77.5946) + 0.012

    order_doc = {
        "_id": ObjectId(),
        "user_id": str(user["_id"]),
        "restaurant": {"id": str(restaurant["_id"]), "name": restaurant["name"],
                       "image": restaurant["image"], "address": restaurant["address"],
                       "lat": restaurant.get("lat"), "lng": restaurant.get("lng")},
        "items": line_items,
        "address": address,
        "amounts": {"subtotal": subtotal, "delivery_fee": delivery_fee,
                    "taxes": taxes, "tip": tip, "discount": discount, "total": total},
        "coupon_code": coupon["code"],
        "review": None,
        "payment_method": body.payment_method,
        "payment_status": "pending",
        "status": "PAYMENT_PENDING" if body.payment_method == "razorpay" else "CONFIRMED",
        "razorpay_order_id": None,
        "razorpay_payment_id": None,
        "rider": {**RIDER, "lat": restaurant.get("lat"), "lng": restaurant.get("lng")},
        "timeline": [],
        "created_at": now_iso(),
    }

    if body.payment_method == "razorpay":
        rp = await create_razorpay_order(total, f"db_{str(order_doc['_id'])[:20]}")
        order_doc["razorpay_order_id"] = rp["id"]
        await db.orders.insert_one(order_doc)
        return {
            "order": order_out(order_doc),
            "razorpay": {"order_id": rp["id"], "amount": total, "currency": "INR",
                         "key_id": RAZORPAY_KEY_ID},
        }

    order_doc["timeline"] = [{"status": "CONFIRMED", "at": now_iso()}]
    await db.orders.insert_one(order_doc)
    spawn_simulation(str(order_doc["_id"]))
    return {"order": order_out(order_doc), "razorpay": None}


class VerifyIn(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api_router.post("/payments/verify")
async def verify_payment(body: VerifyIn, user: dict = Depends(current_user)):
    order = await db.orders.find_one({"_id": oid(body.order_id), "user_id": str(user["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        return {"ok": True, "order": order_out(order)}
    message = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"payment_status": "paid", "status": "CONFIRMED",
                  "razorpay_payment_id": body.razorpay_payment_id,
                  "timeline": order.get("timeline", []) + [{"status": "CONFIRMED", "at": now_iso()}]}})
    spawn_simulation(str(order["_id"]))
    doc = await db.orders.find_one({"_id": order["_id"]})
    return {"ok": True, "order": order_out(doc)}


@api_router.get("/payments/checkout-page/{order_id}", response_class=HTMLResponse)
async def checkout_page(order_id: str):
    order = await db.orders.find_one({"_id": oid(order_id)})
    if not order or not order.get("razorpay_order_id"):
        raise HTTPException(status_code=404, detail="Order not found")
    user = await db.users.find_one({"_id": ObjectId(order["user_id"])})
    html = f"""<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DashBite Payment</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#FDFBF7">
<p id="msg">Opening secure payment...</p>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
var options = {{
  key: "{RAZORPAY_KEY_ID}",
  amount: {order['amounts']['total']},
  currency: "INR",
  order_id: "{order['razorpay_order_id']}",
  name: "DashBite",
  description: "Food order payment",
  prefill: {{ name: "{(user or {}).get('name','')}", email: "{(user or {}).get('email','')}" }},
  theme: {{ color: "#D95325" }},
  handler: function (resp) {{
    fetch("/api/payments/verify-public", {{
      method: "POST", headers: {{"Content-Type": "application/json"}},
      body: JSON.stringify({{ order_id: "{order_id}", razorpay_order_id: resp.razorpay_order_id,
        razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature }})
    }}).finally(function () {{ window.location.href = "feastwave://payment-success"; }});
  }},
  modal: {{ ondismiss: function () {{ window.location.href = "feastwave://payment-cancelled"; }} }}
}};
var rzp = new Razorpay(options);
rzp.on("payment.failed", function () {{ window.location.href = "feastwave://payment-failed"; }});
rzp.open();
</script></body></html>"""
    return HTMLResponse(html)


class VerifyPublicIn(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api_router.post("/payments/verify-public")
async def verify_payment_public(body: VerifyPublicIn):
    """Used by the hosted checkout page (WebView). Signature-verified, idempotent."""
    order = await db.orders.find_one({"_id": oid(body.order_id)})
    if not order or order.get("razorpay_order_id") != body.razorpay_order_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        return {"ok": True}
    message = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    await db.orders.update_one(
        {"_id": order["_id"], "payment_status": {"$ne": "paid"}},
        {"$set": {"payment_status": "paid", "status": "CONFIRMED",
                  "razorpay_payment_id": body.razorpay_payment_id,
                  "timeline": order.get("timeline", []) + [{"status": "CONFIRMED", "at": now_iso()}]}})
    spawn_simulation(str(order["_id"]))
    return {"ok": True}


@api_router.get("/orders")
async def list_orders(user: dict = Depends(current_user)):
    docs = await db.orders.find({"user_id": str(user["_id"])}).sort("created_at", -1).to_list(100)
    return {"orders": [order_out(d) for d in docs]}


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(current_user)):
    doc = await db.orders.find_one({"_id": oid(order_id), "user_id": str(user["_id"])})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    return order_out(doc)


CANCEL_WINDOW_SECONDS = 60
CANCELLABLE = {"PAYMENT_PENDING", "CONFIRMED", "PREPARING"}


@api_router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, user: dict = Depends(current_user)):
    order = await db.orders.find_one({"_id": oid(order_id), "user_id": str(user["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] not in CANCELLABLE:
        raise HTTPException(status_code=400, detail="This order can no longer be cancelled")
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(order["created_at"])).total_seconds()
    if age > CANCEL_WINDOW_SECONDS:
        raise HTTPException(status_code=400, detail="Cancellation window (60s) has passed")
    task = sim_tasks.pop(order_id, None)
    if task and not task.done():
        task.cancel()
    payment_status = "refund_initiated" if order.get("payment_status") == "paid" else "cancelled"
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"status": "CANCELLED", "payment_status": payment_status},
         "$push": {"timeline": {"status": "CANCELLED", "at": now_iso()}}})
    await manager.broadcast(order_id, {"type": "status", "status": "CANCELLED", "eta_mins": 0})
    doc = await db.orders.find_one({"_id": order["_id"]})
    return order_out(doc)


@api_router.post("/orders/{order_id}/review", status_code=201)
async def review_order(order_id: str, body: ReviewIn, user: dict = Depends(current_user)):
    order = await db.orders.find_one({"_id": oid(order_id), "user_id": str(user["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "DELIVERED":
        raise HTTPException(status_code=400, detail="You can rate an order only after delivery")
    if order.get("review"):
        raise HTTPException(status_code=409, detail="Order already reviewed")
    review = {"rating": body.rating, "comment": body.comment.strip(), "at": now_iso()}
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {"review": review}})
    await db.reviews.insert_one({
        "order_id": order_id, "user_id": str(user["_id"]), "user_name": user["name"],
        "restaurant_id": order["restaurant"]["id"], "rating": body.rating,
        "comment": review["comment"], "created_at": review["at"],
    })
    doc = await db.orders.find_one({"_id": order["_id"]})
    return order_out(doc)


# ------------------------------------------------------------------
# Live order tracking (WebSocket + simulated progression)
# ------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active: dict[str, set] = {}

    async def connect(self, order_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(order_id, set()).add(ws)

    def disconnect(self, order_id: str, ws: WebSocket):
        conns = self.active.get(order_id)
        if conns:
            conns.discard(ws)
            if not conns:
                self.active.pop(order_id, None)

    async def broadcast(self, order_id: str, payload: dict):
        for ws in list(self.active.get(order_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(order_id, ws)


manager = ConnectionManager()
sim_tasks: dict[str, asyncio.Task] = {}

ETA_BY_STATUS = {"CONFIRMED": 35, "PREPARING": 25, "OUT_FOR_DELIVERY": 10, "DELIVERED": 0}


async def push_status(order_id: str, status: str):
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": status},
         "$push": {"timeline": {"status": status, "at": now_iso()}}})
    await manager.broadcast(order_id, {
        "type": "status", "status": status, "eta_mins": ETA_BY_STATUS.get(status, 30)})


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


async def simulate_order(order_id: str):
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            return
        status = order["status"]
        seq = ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"]
        if status not in seq:
            return
        idx = seq.index(status)
        if idx < 1:
            await asyncio.sleep(15)
            await push_status(order_id, "PREPARING")
        if idx < 2:
            await asyncio.sleep(25)
            await push_status(order_id, "OUT_FOR_DELIVERY")
            await simulate_ride(order_id)
        await push_status(order_id, "DELIVERED")
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error("simulation error for %s: %s", order_id, e)
    finally:
        sim_tasks.pop(order_id, None)


def spawn_simulation(order_id: str):
    task = sim_tasks.get(order_id)
    if task is None or task.done():
        sim_tasks[order_id] = asyncio.create_task(simulate_order(order_id))


@app.websocket("/api/ws/orders/{order_id}")
async def order_ws(websocket: WebSocket, order_id: str):
    await manager.connect(order_id, websocket)
    try:
        doc = await db.orders.find_one({"_id": ObjectId(order_id)})
        if doc:
            await websocket.send_json({
                "type": "init", "status": doc["status"], "timeline": doc.get("timeline", []),
                "rider": doc.get("rider"), "eta_mins": ETA_BY_STATUS.get(doc["status"], 30)})
            if doc["status"] in ("CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"):
                spawn_simulation(order_id)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(order_id, websocket)
    except Exception:
        manager.disconnect(order_id, websocket)


# ------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.favorites.create_index([("user_id", 1), ("restaurant_id", 1)], unique=True)
    await db.reviews.create_index("restaurant_id")
    count = await db.restaurants.count_documents({})
    if count == 0:
        r, m = await seed_database(db)
        logger.info("Seeded %d restaurants and %d menu items", r, m)
    async for o in db.orders.find({"status": {"$in": ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"]}}):
        spawn_simulation(str(o["_id"]))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
