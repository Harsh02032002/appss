"""Backend tests for the 4 new DashBite features:
Favourites, Coupons, Order Cancel (60s), Order Review."""
import os
import time

import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

from conftest import BASE_URL

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


# -------------------------- Favourites --------------------------
class TestFavourites:

    def test_list_favorites_requires_auth(self, api_client):
        r = requests.get(f"{BASE_URL}/api/favorites")
        assert r.status_code in (401, 403)

    def test_toggle_requires_auth(self, api_client):
        r = requests.post(f"{BASE_URL}/api/favorites/000000000000000000000000")
        assert r.status_code in (401, 403)

    def test_toggle_404_on_invalid_restaurant(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/favorites/000000000000000000000000")
        assert r.status_code == 404

    def test_toggle_add_then_remove_and_list(self, auth_client):
        rests = auth_client.get(f"{BASE_URL}/api/restaurants").json()["restaurants"]
        rid = rests[0]["id"]
        # make sure clean state - if present, remove first
        current_ids = auth_client.get(f"{BASE_URL}/api/favorites").json()["ids"]
        if rid in current_ids:
            auth_client.post(f"{BASE_URL}/api/favorites/{rid}")
        # add
        r1 = auth_client.post(f"{BASE_URL}/api/favorites/{rid}")
        assert r1.status_code == 200
        assert r1.json() == {"favorited": True}
        # list includes it
        data = auth_client.get(f"{BASE_URL}/api/favorites").json()
        assert rid in data["ids"]
        assert any(x["id"] == rid for x in data["restaurants"])
        # remove
        r2 = auth_client.post(f"{BASE_URL}/api/favorites/{rid}")
        assert r2.status_code == 200
        assert r2.json() == {"favorited": False}
        data2 = auth_client.get(f"{BASE_URL}/api/favorites").json()
        assert rid not in data2["ids"]


# -------------------------- Coupons --------------------------
class TestCoupons:

    def test_list_coupons(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/coupons")
        assert r.status_code == 200
        codes = {c["code"] for c in r.json()["coupons"]}
        assert codes == {"WELCOME50", "FLAT100", "TASTY20", "FREEDEL"}

    def test_validate_welcome50_percent(self, api_client):
        # subtotal ₹200 => 50% = ₹100, capped at ₹100 = 10000 paise
        r = api_client.post(f"{BASE_URL}/api/coupons/validate",
                            json={"code": "welcome50", "subtotal": 20000})
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == "WELCOME50"  # case-insensitive input, upper-case output
        assert data["discount"] == 10000  # capped at 100 rupees
        assert data["free_delivery"] is False

    def test_validate_flat100(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/coupons/validate",
                            json={"code": "FLAT100", "subtotal": 50000})
        assert r.status_code == 200
        data = r.json()
        assert data["discount"] == 10000
        assert data["free_delivery"] is False

    def test_validate_tasty20(self, api_client):
        # 20% of ₹200 = ₹40 = 4000 paise, below cap 7500
        r = api_client.post(f"{BASE_URL}/api/coupons/validate",
                            json={"code": "TASTY20", "subtotal": 20000})
        assert r.status_code == 200
        assert r.json()["discount"] == 4000

    def test_validate_freedel(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/coupons/validate",
                            json={"code": "FREEDEL", "subtotal": 30000})
        assert r.status_code == 200
        data = r.json()
        assert data["discount"] == 0
        assert data["free_delivery"] is True

    def test_validate_invalid_code(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/coupons/validate",
                            json={"code": "NOTACODE", "subtotal": 50000})
        assert r.status_code == 400
        assert "Invalid coupon code" in r.json()["detail"]

    def test_validate_below_min_order(self, api_client):
        # WELCOME50 min = 19900
        r = api_client.post(f"{BASE_URL}/api/coupons/validate",
                            json={"code": "WELCOME50", "subtotal": 10000})
        assert r.status_code == 400
        assert "more" in r.json()["detail"]

    def test_order_with_welcome50_applies_discount(self, auth_client):
        # Pick two of the most expensive-ish dish to clear ₹199 min
        rests = auth_client.get(f"{BASE_URL}/api/restaurants").json()["restaurants"]
        rid = rests[0]["id"]
        menu = auth_client.get(f"{BASE_URL}/api/restaurants/{rid}").json()["menu"]
        item = max(menu, key=lambda m: m["price"])
        qty = max(1, (19900 // item["price"]) + 1)
        r = auth_client.post(f"{BASE_URL}/api/orders", json={
            "items": [{"item_id": item["id"], "qty": qty}],
            "address": {"label": "Home", "line1": "TEST coupon addr", "city": "Bengaluru", "pincode": "560001"},
            "payment_method": "cod", "tip": 0, "coupon_code": "welcome50",
        })
        assert r.status_code == 201, r.text
        order = r.json()["order"]
        subtotal = item["price"] * qty
        expected_discount = min(round(subtotal * 0.5), 10000)
        assert order["coupon_code"] == "WELCOME50"
        assert order["amounts"]["discount"] == expected_discount
        assert order["amounts"]["delivery_fee"] == 3500
        assert order["amounts"]["total"] == (
            subtotal + order["amounts"]["delivery_fee"] + order["amounts"]["taxes"] - expected_discount
        )

    def test_order_with_freedel_zero_delivery(self, auth_client):
        rests = auth_client.get(f"{BASE_URL}/api/restaurants").json()["restaurants"]
        rid = rests[0]["id"]
        menu = auth_client.get(f"{BASE_URL}/api/restaurants/{rid}").json()["menu"]
        item = max(menu, key=lambda m: m["price"])
        qty = max(1, (29900 // item["price"]) + 1)
        r = auth_client.post(f"{BASE_URL}/api/orders", json={
            "items": [{"item_id": item["id"], "qty": qty}],
            "address": {"label": "Home", "line1": "TEST freedel", "city": "Bengaluru", "pincode": "560001"},
            "payment_method": "cod", "tip": 0, "coupon_code": "FREEDEL",
        })
        assert r.status_code == 201, r.text
        order = r.json()["order"]
        assert order["coupon_code"] == "FREEDEL"
        assert order["amounts"]["delivery_fee"] == 0
        assert order["amounts"]["discount"] == 0

    def test_order_with_invalid_coupon(self, auth_client):
        rests = auth_client.get(f"{BASE_URL}/api/restaurants").json()["restaurants"]
        rid = rests[0]["id"]
        menu = auth_client.get(f"{BASE_URL}/api/restaurants/{rid}").json()["menu"]
        item = menu[0]
        r = auth_client.post(f"{BASE_URL}/api/orders", json={
            "items": [{"item_id": item["id"], "qty": 1}],
            "address": {"label": "Home", "line1": "TEST invalid", "city": "Bengaluru", "pincode": "560001"},
            "payment_method": "cod", "tip": 0, "coupon_code": "BOGUS",
        })
        assert r.status_code == 400


# -------------------------- Order Cancel --------------------------
def _create_cod_order(auth_client):
    rests = auth_client.get(f"{BASE_URL}/api/restaurants").json()["restaurants"]
    rid = rests[0]["id"]
    menu = auth_client.get(f"{BASE_URL}/api/restaurants/{rid}").json()["menu"]
    item = menu[0]
    r = auth_client.post(f"{BASE_URL}/api/orders", json={
        "items": [{"item_id": item["id"], "qty": 1}],
        "address": {"label": "Home", "line1": "TEST cancel", "city": "Bengaluru", "pincode": "560001"},
        "payment_method": "cod", "tip": 0,
    })
    assert r.status_code == 201, r.text
    return r.json()["order"]


class TestCancel:

    def test_cancel_confirmed_order_success(self, auth_client):
        order = _create_cod_order(auth_client)
        oid_ = order["id"]
        assert order["status"] == "CONFIRMED"
        r = auth_client.post(f"{BASE_URL}/api/orders/{oid_}/cancel")
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["status"] == "CANCELLED"
        assert out["payment_status"] == "cancelled"
        statuses = [t["status"] for t in out["timeline"]]
        assert "CANCELLED" in statuses
        # list shows it
        lst = auth_client.get(f"{BASE_URL}/api/orders").json()["orders"]
        found = next((o for o in lst if o["id"] == oid_), None)
        assert found and found["status"] == "CANCELLED"

    def test_second_cancel_returns_400(self, auth_client):
        order = _create_cod_order(auth_client)
        oid_ = order["id"]
        r1 = auth_client.post(f"{BASE_URL}/api/orders/{oid_}/cancel")
        assert r1.status_code == 200
        r2 = auth_client.post(f"{BASE_URL}/api/orders/{oid_}/cancel")
        assert r2.status_code == 400

    def test_cancel_delivered_order_rejected(self, auth_client, mongo_db):
        order = _create_cod_order(auth_client)
        oid_ = order["id"]
        # Directly flip to DELIVERED in Mongo
        mongo_db.orders.update_one({"_id": ObjectId(oid_)}, {"$set": {"status": "DELIVERED"}})
        r = auth_client.post(f"{BASE_URL}/api/orders/{oid_}/cancel")
        assert r.status_code == 400


# -------------------------- Order Review --------------------------
class TestReview:

    def test_review_non_delivered_order_400(self, auth_client):
        order = _create_cod_order(auth_client)
        oid_ = order["id"]
        r = auth_client.post(f"{BASE_URL}/api/orders/{oid_}/review",
                             json={"rating": 5, "comment": "TEST good"})
        assert r.status_code == 400
        assert "after delivery" in r.json()["detail"]

    def test_review_rating_out_of_range(self, auth_client):
        order = _create_cod_order(auth_client)
        oid_ = order["id"]
        r = auth_client.post(f"{BASE_URL}/api/orders/{oid_}/review",
                             json={"rating": 6, "comment": "TEST"})
        assert r.status_code == 422

    def test_review_delivered_success_then_duplicate_409(self, auth_client, mongo_db):
        order = _create_cod_order(auth_client)
        oid_ = order["id"]
        rid = order["restaurant"]["id"]
        # Flip to DELIVERED in Mongo (cancel sim task first by waiting a tick)
        mongo_db.orders.update_one({"_id": ObjectId(oid_)}, {"$set": {"status": "DELIVERED"}})
        # Review succeeds
        r = auth_client.post(f"{BASE_URL}/api/orders/{oid_}/review",
                             json={"rating": 4, "comment": "TEST tasty food"})
        assert r.status_code == 201, r.text
        reviewed = r.json()
        assert reviewed["review"]["rating"] == 4
        assert reviewed["review"]["comment"] == "TEST tasty food"
        # Second review -> 409
        r2 = auth_client.post(f"{BASE_URL}/api/orders/{oid_}/review",
                              json={"rating": 5, "comment": "again"})
        assert r2.status_code == 409

        # Restaurant details include the review
        d = requests.get(f"{BASE_URL}/api/restaurants/{rid}")
        assert d.status_code == 200
        reviews = d.json().get("reviews", [])
        assert any(rv.get("comment") == "TEST tasty food" and rv.get("rating") == 4
                   for rv in reviews), f"Review not in restaurant payload: {reviews}"
