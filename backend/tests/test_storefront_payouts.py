# Iteration 6: single-restaurant storefront + rider payouts (settle) + lifecycle regression
import os
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
CUST = ("test@dashbite.in", "test123")
PARTNER = ("biryaniblueskitchen@partner.dashbite.in", "partner123")
SURESH = ("suresh@rider.dashbite.in", "rider123")


def login(path, creds):
    r = requests.post(f"{API}/{path}", json={"email": creds[0], "password": creds[1]}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def tokens():
    c = login("auth/login", CUST)["token"]
    p = login("partner/auth/login", PARTNER)["token"]
    rl = login("rider/auth/login", SURESH)
    yield {"cust": c, "partner": p, "rider": rl["token"], "suresh_id": rl["rider"]["id"]}
    # teardown: suresh offline
    requests.patch(f"{API}/rider/status", json={"online": False}, headers=h(rl["token"]), timeout=30)


# ---------------- Storefront
class TestStorefront:
    def test_restaurant_storefront(self):
        r = requests.get(f"{API}/restaurant", timeout=30)
        assert r.status_code == 200
        d = r.json()
        rest = d["restaurant"]
        assert rest["name"] == "Biryani Blues Kitchen"
        for k in ("is_open", "rating", "cuisines", "delivery_time", "offer"):
            assert k in rest, k
        assert len(d["menu"]) == 21
        for m in d["menu"]:
            for k in ("category", "veg", "bestseller", "available"):
                assert k in m, (k, m.get("name"))
        assert isinstance(d["banners"], list) and d["banners"]
        assert isinstance(d["reviews"], list)
        assert all("_id" not in rv for rv in d["reviews"])

    def test_restaurants_single(self):
        r = requests.get(f"{API}/restaurants", timeout=30)
        assert r.status_code == 200
        assert len(r.json()["restaurants"]) == 1

    def test_search_biryani(self):
        r = requests.get(f"{API}/search", params={"q": "biryani"}, timeout=30)
        assert r.status_code == 200
        assert len(r.json()["dishes"]) > 0

    def test_coupon_validate(self):
        r = requests.post(f"{API}/coupons/validate", json={"code": "WELCOME50", "subtotal": 50000}, timeout=30)
        assert r.status_code == 200 and r.json()["discount"] == 10000
        r2 = requests.post(f"{API}/coupons/validate", json={"code": "BOGUS", "subtotal": 50000}, timeout=30)
        assert r2.status_code == 400


# ---------------- Payouts auth
class TestPayoutAuth:
    def test_customer_token_401(self, tokens):
        assert requests.get(f"{API}/partner/payouts", headers=h(tokens["cust"]), timeout=30).status_code == 401

    def test_rider_token_401(self, tokens):
        assert requests.get(f"{API}/partner/payouts", headers=h(tokens["rider"]), timeout=30).status_code == 401

    def test_no_token_401(self):
        assert requests.get(f"{API}/partner/payouts", timeout=30).status_code == 401

    def test_payouts_shape(self, tokens):
        r = requests.get(f"{API}/partner/payouts", headers=h(tokens["partner"]), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "total_pending" in d
        for rd in d["riders"]:
            for k in ("id", "name", "pending_amount", "pending_count", "paid_amount", "delivered_count",
                      "last_payout", "online", "status"):
                assert k in rd

    def test_settle_unknown_rider_404(self, tokens):
        r = requests.post(f"{API}/partner/payouts/000000000000000000000000/settle", headers=h(tokens["partner"]), timeout=30)
        assert r.status_code == 404
        r = requests.post(f"{API}/partner/payouts/not-an-id/settle", headers=h(tokens["partner"]), timeout=30)
        assert r.status_code == 404


def suresh_row(tokens):
    d = requests.get(f"{API}/partner/payouts", headers=h(tokens["partner"]), timeout=30).json()
    return next(x for x in d["riders"] if x["id"] == tokens["suresh_id"]), d["total_pending"]


def rider_dash(tokens):
    return requests.get(f"{API}/rider/dashboard", headers=h(tokens["rider"]), timeout=30).json()


def full_delivery(tokens, tip=1000):
    """Place COD order and drive it to DELIVERED. Returns order id."""
    menu = requests.get(f"{API}/restaurant", timeout=30).json()["menu"]
    item = next(m for m in menu if m.get("available", True))
    addr = {"label": "Home", "line1": "TEST_ 1 Payout Lane", "city": "Bengaluru", "pincode": "560001"}
    r = requests.post(f"{API}/orders", headers=h(tokens["cust"]), json={
        "items": [{"item_id": item["id"], "qty": 1}], "address": addr, "payment_method": "cod", "tip": tip}, timeout=30)
    assert r.status_code == 201, r.text
    oid_ = r.json()["order"]["id"]
    assert r.json()["order"]["status"] == "PLACED"
    pt, rt = h(tokens["partner"]), h(tokens["rider"])
    r = requests.post(f"{API}/partner/orders/{oid_}/accept", headers=pt, timeout=30)
    assert r.status_code == 200 and r.json()["status"] == "CONFIRMED", r.text
    r = requests.patch(f"{API}/rider/status", json={"online": True}, headers=rt, timeout=30)
    assert r.status_code == 200 and r.json()["online"] is True
    r = requests.post(f"{API}/rider/orders/{oid_}/accept", headers=rt, timeout=30)
    assert r.status_code == 200, r.text
    for st in ("PREPARING", "READY"):
        r = requests.post(f"{API}/partner/orders/{oid_}/status", json={"status": st}, headers=pt, timeout=30)
        assert r.status_code == 200 and r.json()["status"] == st, r.text
    r = requests.post(f"{API}/rider/orders/{oid_}/pickup", headers=rt, timeout=30)
    assert r.status_code == 200 and r.json()["status"] == "OUT_FOR_DELIVERY", r.text
    r = requests.post(f"{API}/rider/orders/{oid_}/deliver", headers=rt, timeout=30)
    assert r.status_code == 200 and r.json()["status"] == "DELIVERED", r.text
    # customer sees delivered
    r = requests.get(f"{API}/orders/{oid_}", headers=h(tokens["cust"]), timeout=30)
    assert r.json()["status"] == "DELIVERED"
    return oid_


# ---------------- Full payout flow
class TestPayoutFlow:
    def test_lifecycle_and_settle(self, tokens):
        before, _ = suresh_row(tokens)
        dash_before = rider_dash(tokens)
        assert dash_before["active_order"] is None, "Suresh already has an active order"
        oid_ = full_delivery(tokens, tip=1000)

        after, total_pending = suresh_row(tokens)
        assert after["pending_amount"] == before["pending_amount"] + 4500
        assert after["pending_count"] == before["pending_count"] + 1
        assert after["delivered_count"] == before["delivered_count"] + 1
        dash = rider_dash(tokens)
        assert dash["pending_payout"] == dash_before["pending_payout"] + 4500
        assert dash["pending_payout"] >= 4500

        r = requests.post(f"{API}/partner/payouts/{tokens['suresh_id']}/settle", headers=h(tokens["partner"]), timeout=30)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["amount"] == after["pending_amount"]
        assert s["deliveries"] == after["pending_count"]
        assert s["at"]

        settled, _ = suresh_row(tokens)
        assert settled["pending_amount"] == 0 and settled["pending_count"] == 0
        assert settled["paid_amount"] == before["paid_amount"] + after["pending_amount"]
        dash2 = rider_dash(tokens)
        assert dash2["pending_payout"] == 0
        assert dash2["settled_total"] == dash_before["settled_total"] + after["pending_amount"]

        hist = requests.get(f"{API}/rider/history", headers=h(tokens["rider"]), timeout=30).json()
        assert hist["orders"][0]["id"] == oid_
        assert hist["orders"][0]["payout_status"] == "paid"
        assert hist["orders"][0]["paid_at"] == s["at"]
        assert hist["payouts"][0]["at"] == s["at"] and hist["payouts"][0]["amount"] == s["amount"]
        assert "_id" not in hist["payouts"][0]

        r = requests.post(f"{API}/partner/payouts/{tokens['suresh_id']}/settle", headers=h(tokens["partner"]), timeout=30)
        assert r.status_code == 400 and r.json()["detail"] == "Nothing pending for this rider"
        tokens["last_settle_at"] = s["at"]
        tokens["last_settle_amount"] = s["amount"]

    def test_last_payout_is_latest(self, tokens):
        """last_payout on partner payouts should reflect the most recent settlement."""
        if "last_settle_at" not in tokens:
            pytest.skip("settle flow did not run")
        row, _ = suresh_row(tokens)
        assert row["last_payout"] is not None
        assert row["last_payout"]["at"] == tokens["last_settle_at"], \
            f"last_payout shows {row['last_payout']} but latest settle was {tokens['last_settle_at']}"

    def test_rider_offline_end(self, tokens):
        r = requests.patch(f"{API}/rider/status", json={"online": False}, headers=h(tokens["rider"]), timeout=30)
        assert r.status_code == 200 and r.json()["online"] is False
        assert rider_dash(tokens)["active_order"] is None
