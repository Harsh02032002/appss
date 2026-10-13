"""Backend tests for Restaurant Partner app:
- Partner auth, dashboard, menu availability, restaurant open/close
- Order lifecycle (accept/reject/preparing/ready/assign-rider), rider pool
- Customer-side verification of unavailable item + closed restaurant
- Search filters: veg_only, rating_min, sort, cuisine
"""
import os
import time

import pytest
import requests

from conftest import BASE_URL, TEST_EMAIL, TEST_PASSWORD

PARTNER_EMAIL = "biryaniblueskitchen@partner.dashbite.in"
PARTNER_PASSWORD = "partner123"


# ------------------------------------------------------------------ Fixtures
@pytest.fixture(scope="module")
def partner_token():
    r = requests.post(f"{BASE_URL}/api/partner/auth/login",
                      json={"email": PARTNER_EMAIL, "password": PARTNER_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="module")
def partner_client(partner_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {partner_token}"})
    return s


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def customer_client(customer_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {customer_token}"})
    return s


@pytest.fixture(scope="module")
def biryani_blues(customer_client):
    r = customer_client.get(f"{BASE_URL}/api/restaurants")
    assert r.status_code == 200
    rests = r.json()["restaurants"]
    rest = next((x for x in rests if x["name"] == "Biryani Blues Kitchen"), None)
    assert rest, "Biryani Blues Kitchen not found in restaurant list"
    return rest


def _place_order(customer_client, rid):
    menu = customer_client.get(f"{BASE_URL}/api/restaurants/{rid}").json()["menu"]
    item = menu[0]
    r = customer_client.post(f"{BASE_URL}/api/orders", json={
        "items": [{"item_id": item["id"], "qty": 1}],
        "address": {"label": "Home", "line1": "TEST partner lifecycle",
                    "city": "Bengaluru", "pincode": "560001"},
        "payment_method": "cod",
    })
    assert r.status_code == 201, r.text
    return r.json()["order"]


# ------------------------------------------------------------------ Auth
class TestPartnerAuth:
    def test_login_success(self):
        r = requests.post(f"{BASE_URL}/api/partner/auth/login",
                          json={"email": PARTNER_EMAIL, "password": PARTNER_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["partner"]["email"] == PARTNER_EMAIL
        assert data["partner"]["restaurant"]["name"] == "Biryani Blues Kitchen"
        assert "id" in data["partner"]["restaurant"]

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/partner/auth/login",
                          json={"email": PARTNER_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_endpoint(self, partner_client):
        r = partner_client.get(f"{BASE_URL}/api/partner/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == PARTNER_EMAIL

    def test_customer_token_rejected_on_partner_endpoint(self, customer_token):
        r = requests.get(f"{BASE_URL}/api/partner/auth/me",
                         headers={"Authorization": f"Bearer {customer_token}"})
        assert r.status_code == 401

    def test_no_auth_rejected(self):
        r = requests.get(f"{BASE_URL}/api/partner/auth/me")
        assert r.status_code in (401, 403)


# ------------------------------------------------------------------ Dashboard
class TestDashboard:
    def test_dashboard_fields(self, partner_client):
        r = partner_client.get(f"{BASE_URL}/api/partner/dashboard")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("today_orders", "today_revenue", "pending", "active",
                  "delivered_total", "avg_rating", "review_count", "restaurant"):
            assert k in data, f"missing {k}"
        assert "is_open" in data["restaurant"]


# ------------------------------------------------------------------ Riders list
class TestRiders:
    def test_list_riders(self, partner_client):
        r = partner_client.get(f"{BASE_URL}/api/partner/riders")
        assert r.status_code == 200
        riders = r.json()["riders"]
        assert len(riders) == 5
        for rd in riders:
            assert rd["status"] in ("available", "busy")


# ------------------------------------------------------------------ Full order lifecycle
class TestOrderLifecycle:

    def test_full_happy_path(self, customer_client, partner_client, biryani_blues):
        rid = biryani_blues["id"]
        order = _place_order(customer_client, rid)
        oid_ = order["id"]
        assert order["status"] == "PLACED"
        assert order["customer"]["name"]
        assert order["customer"]["phone"]
        assert order.get("rider") in (None,)

        # partner sees it
        active = partner_client.get(f"{BASE_URL}/api/partner/orders?scope=active").json()["orders"]
        assert any(o["id"] == oid_ for o in active)

        # cannot jump to PREPARING from PLACED
        r_bad = partner_client.post(
            f"{BASE_URL}/api/partner/orders/{oid_}/status", json={"status": "PREPARING"})
        assert r_bad.status_code == 400

        # accept -> CONFIRMED
        r_acc = partner_client.post(f"{BASE_URL}/api/partner/orders/{oid_}/accept")
        assert r_acc.status_code == 200
        assert r_acc.json()["status"] == "CONFIRMED"

        # READY from CONFIRMED -> 400 (must do PREPARING first)
        r_bad2 = partner_client.post(
            f"{BASE_URL}/api/partner/orders/{oid_}/status", json={"status": "READY"})
        assert r_bad2.status_code == 400

        # PREPARING
        r_prep = partner_client.post(
            f"{BASE_URL}/api/partner/orders/{oid_}/status", json={"status": "PREPARING"})
        assert r_prep.status_code == 200
        assert r_prep.json()["status"] == "PREPARING"

        # pick an available rider
        riders = partner_client.get(f"{BASE_URL}/api/partner/riders").json()["riders"]
        avail = next((rd for rd in riders if rd["status"] == "available"), None)
        assert avail, "No available rider for test"

        r_assign = partner_client.post(
            f"{BASE_URL}/api/partner/orders/{oid_}/assign-rider",
            json={"rider_id": avail["id"]})
        assert r_assign.status_code == 200
        assigned = r_assign.json()
        assert assigned["rider"] and assigned["rider"]["id"] == avail["id"]

        # that rider is now busy
        riders2 = partner_client.get(f"{BASE_URL}/api/partner/riders").json()["riders"]
        rd2 = next(rd for rd in riders2 if rd["id"] == avail["id"])
        assert rd2["status"] == "busy"

        # cannot assign another rider
        another = next((rd for rd in riders2 if rd["status"] == "available"), None)
        if another:
            r_assign2 = partner_client.post(
                f"{BASE_URL}/api/partner/orders/{oid_}/assign-rider",
                json={"rider_id": another["id"]})
            assert r_assign2.status_code == 400

        # READY
        r_ready = partner_client.post(
            f"{BASE_URL}/api/partner/orders/{oid_}/status", json={"status": "READY"})
        assert r_ready.status_code == 200
        assert r_ready.json()["status"] == "READY"

        # Wait ~8s -> OUT_FOR_DELIVERY
        time.sleep(9)
        c_order = customer_client.get(f"{BASE_URL}/api/orders/{oid_}").json()
        assert c_order["status"] == "OUT_FOR_DELIVERY", f"got {c_order['status']}"

        # Wait ~65s more -> DELIVERED (ride simulation is 12 steps * 5s = 60s)
        deadline = time.time() + 90
        delivered = False
        while time.time() < deadline:
            c_order = customer_client.get(f"{BASE_URL}/api/orders/{oid_}").json()
            if c_order["status"] == "DELIVERED":
                delivered = True
                break
            time.sleep(3)
        assert delivered, f"Final status: {c_order['status']}"

        # Rider back to available
        riders3 = partner_client.get(f"{BASE_URL}/api/partner/riders").json()["riders"]
        rd3 = next(rd for rd in riders3 if rd["id"] == avail["id"])
        assert rd3["status"] == "available"

    def test_reject_places_cancelled(self, customer_client, partner_client, biryani_blues):
        rid = biryani_blues["id"]
        order = _place_order(customer_client, rid)
        oid_ = order["id"]
        r = partner_client.post(f"{BASE_URL}/api/partner/orders/{oid_}/reject",
                                json={"reason": "Out of stock"})
        assert r.status_code == 200
        out = r.json()
        assert out["status"] == "CANCELLED"
        assert out.get("cancel_reason") == "Out of stock"
        assert out.get("payment_status") == "cancelled"

    def test_reject_preparing_order_rejected(self, customer_client, partner_client, biryani_blues):
        rid = biryani_blues["id"]
        order = _place_order(customer_client, rid)
        oid_ = order["id"]
        assert partner_client.post(f"{BASE_URL}/api/partner/orders/{oid_}/accept").status_code == 200
        assert partner_client.post(f"{BASE_URL}/api/partner/orders/{oid_}/status",
                                   json={"status": "PREPARING"}).status_code == 200
        r = partner_client.post(f"{BASE_URL}/api/partner/orders/{oid_}/reject",
                                json={"reason": "nope"})
        assert r.status_code == 400

    def test_customer_cancel_within_60s_then_partner_sees_cancelled(
            self, customer_client, partner_client, biryani_blues):
        rid = biryani_blues["id"]
        order = _place_order(customer_client, rid)
        oid_ = order["id"]
        # customer cancel within 60s on PLACED (or CONFIRMED w/in 60s)
        r = customer_client.post(f"{BASE_URL}/api/orders/{oid_}/cancel")
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "CANCELLED"
        past = partner_client.get(f"{BASE_URL}/api/partner/orders?scope=past").json()["orders"]
        found = next((o for o in past if o["id"] == oid_), None)
        assert found and found["status"] == "CANCELLED"


# ------------------------------------------------------------------ Menu availability & open/close
class TestMenuAndOpenClose:

    def test_toggle_menu_unavailable_blocks_order(self, customer_client, partner_client, biryani_blues):
        rid = biryani_blues["id"]
        menu = partner_client.get(f"{BASE_URL}/api/partner/menu").json()["menu"]
        assert menu, "partner menu empty"
        for i in menu:
            assert "available" in i
        item_id = menu[0]["id"]
        try:
            r = partner_client.patch(f"{BASE_URL}/api/partner/menu/{item_id}",
                                     json={"available": False})
            assert r.status_code == 200
            assert r.json()["available"] is False

            # customer view reflects it
            cust = customer_client.get(f"{BASE_URL}/api/restaurants/{rid}").json()
            cust_item = next((m for m in cust["menu"] if m["id"] == item_id), None)
            assert cust_item and cust_item.get("available") is False

            # ordering it -> 400 "unavailable"
            r_bad = customer_client.post(f"{BASE_URL}/api/orders", json={
                "items": [{"item_id": item_id, "qty": 1}],
                "address": {"label": "Home", "line1": "TEST unavail",
                            "city": "Bengaluru", "pincode": "560001"},
                "payment_method": "cod",
            })
            assert r_bad.status_code == 400
            assert "unavailable" in r_bad.json()["detail"].lower()
        finally:
            # restore
            partner_client.patch(f"{BASE_URL}/api/partner/menu/{item_id}",
                                 json={"available": True})

    def test_toggle_restaurant_closed_blocks_order(self, customer_client, partner_client, biryani_blues):
        rid = biryani_blues["id"]
        menu = customer_client.get(f"{BASE_URL}/api/restaurants/{rid}").json()["menu"]
        item_id = menu[0]["id"]
        try:
            r = partner_client.patch(f"{BASE_URL}/api/partner/restaurant",
                                     json={"is_open": False})
            assert r.status_code == 200
            assert r.json()["is_open"] is False

            rests = customer_client.get(f"{BASE_URL}/api/restaurants").json()["restaurants"]
            target = next(x for x in rests if x["id"] == rid)
            assert target["is_open"] is False

            r_bad = customer_client.post(f"{BASE_URL}/api/orders", json={
                "items": [{"item_id": item_id, "qty": 1}],
                "address": {"label": "Home", "line1": "TEST closed",
                            "city": "Bengaluru", "pincode": "560001"},
                "payment_method": "cod",
            })
            assert r_bad.status_code == 400
            assert "closed" in r_bad.json()["detail"].lower()
        finally:
            partner_client.patch(f"{BASE_URL}/api/partner/restaurant",
                                 json={"is_open": True})


# ------------------------------------------------------------------ Search filters
class TestSearchFilters:
    def test_veg_only(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/restaurants?veg_only=true")
        assert r.status_code == 200
        names = {x["name"] for x in r.json()["restaurants"]}
        # expect both pure-veg to be present and nothing else
        assert "Madras Dosa Co." in names, names
        assert "Sugar Rush" in names, names
        # Common non-veg must NOT be in result
        assert "Biryani Blues Kitchen" not in names

    def test_rating_min(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/restaurants?rating_min=4.5")
        assert r.status_code == 200
        for rest in r.json()["restaurants"]:
            assert rest["rating"] >= 4.5

    def test_sort_time_asc(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/restaurants?sort=time")
        assert r.status_code == 200
        rests = r.json()["restaurants"]
        import re
        times = [int(re.search(r"\d+", x["delivery_time"]).group()) for x in rests]
        assert times == sorted(times)

    def test_sort_price_low(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/restaurants?sort=price_low")
        prices = [x["price_for_two"] for x in r.json()["restaurants"]]
        assert prices == sorted(prices)

    def test_sort_price_high(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/restaurants?sort=price_high")
        prices = [x["price_for_two"] for x in r.json()["restaurants"]]
        assert prices == sorted(prices, reverse=True)

    def test_cuisine_filter(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/restaurants?cuisine=Biryani")
        assert r.status_code == 200
        rests = r.json()["restaurants"]
        assert rests, "No restaurants returned for cuisine=Biryani"
        for rest in rests:
            assert any("biryani" in c.lower() for c in rest["cuisines"]), rest

    def test_combo_veg_rating(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/restaurants?veg_only=true&rating_min=4.5")
        assert r.status_code == 200
        for rest in r.json()["restaurants"]:
            assert rest["rating"] >= 4.5
