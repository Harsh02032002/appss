# Rider app backend: auth, online toggle, requests pool, accept/reject/pickup/deliver, assignment, GPS WS, no-simulation
import os
import json
import time
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

CUSTOMER = ("test@dashbite.in", "test123")
PARTNER = ("biryaniblueskitchen@partner.dashbite.in", "partner123")
RAVI = ("ravi@rider.dashbite.in", "rider123")
SURESH = ("suresh@rider.dashbite.in", "rider123")
ADDRESS = {"label": "Home", "line1": "TEST_x", "lat": 12.99, "lng": 77.61}


def login(path, creds):
    r = requests.post(f"{API}{path}", json={"email": creds[0], "password": creds[1]})
    assert r.status_code == 200, r.text
    return r.json()


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


S = {}


@pytest.fixture(scope="module", autouse=True)
def tokens():
    S["cust"] = login("/auth/login", CUSTOMER)["token"]
    S["partner"] = login("/partner/auth/login", PARTNER)["token"]
    r = login("/rider/auth/login", RAVI)
    S["ravi"], S["ravi_id"] = r["token"], r["rider"]["id"]
    r = login("/rider/auth/login", SURESH)
    S["suresh"], S["suresh_id"] = r["token"], r["rider"]["id"]
    menu = requests.get(f"{API}/partner/menu", headers=H(S["partner"])).json()["menu"]
    S["item"] = next(m["id"] for m in menu if m.get("available", True))
    # make sure both riders free & offline at start
    for k in ("ravi", "suresh"):
        d = requests.get(f"{API}/rider/dashboard", headers=H(S[k])).json()
        assert d["active_order"] is None, f"{k} already has active order {d['active_order']['id']}"
        requests.patch(f"{API}/rider/status", json={"online": False}, headers=H(S[k]))
    yield
    for k in ("ravi", "suresh"):
        requests.patch(f"{API}/rider/status", json={"online": False}, headers=H(S[k]))


def place_order(tip=2000):
    r = requests.post(f"{API}/orders", headers=H(S["cust"]), json={
        "items": [{"item_id": S["item"], "qty": 1}], "address": ADDRESS, "payment_method": "cod", "tip": tip})
    assert r.status_code == 201, r.text
    o = r.json()["order"]
    assert o["status"] == "PLACED"
    return o["id"]


def partner_accept(oid_):
    r = requests.post(f"{API}/partner/orders/{oid_}/accept", headers=H(S["partner"]))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "CONFIRMED"


def rider_post(who, oid_, action):
    return requests.post(f"{API}/rider/orders/{oid_}/{action}", headers=H(S[who]))


def cust_order(oid_):
    return requests.get(f"{API}/orders/{oid_}", headers=H(S["cust"])).json()


# ---------------- Auth
class TestRiderAuth:
    def test_login_and_me(self):
        r = login("/rider/auth/login", RAVI)
        assert r["token"] and r["rider"]["name"] == "Ravi Kumar"
        assert "online" in r["rider"] and "status" in r["rider"]
        me = requests.get(f"{API}/rider/auth/me", headers=H(r["token"]))
        assert me.status_code == 200 and me.json()["email"] == RAVI[0]

    def test_wrong_password(self):
        r = requests.post(f"{API}/rider/auth/login", json={"email": RAVI[0], "password": "bad"})
        assert r.status_code == 401

    def test_customer_and_partner_tokens_rejected(self):
        for t in (S["cust"], S["partner"]):
            assert requests.get(f"{API}/rider/auth/me", headers=H(t)).status_code == 401
            assert requests.get(f"{API}/rider/dashboard", headers=H(t)).status_code == 401
        assert requests.get(f"{API}/rider/dashboard").status_code == 401


# ---------------- Full workflow
class TestRiderWorkflow:
    def test_01_accept_guards(self):
        S["o1"] = place_order(2000)
        S["dash_before"] = requests.get(f"{API}/rider/dashboard", headers=H(S["ravi"])).json()
        r = rider_post("ravi", S["o1"], "accept")
        # Ravi is offline -> online check happens first
        assert r.status_code == 400
        requests.patch(f"{API}/rider/status", json={"online": True}, headers=H(S["ravi"]))
        r = rider_post("ravi", S["o1"], "accept")
        assert r.status_code == 400 and "hasn't accepted" in r.json()["detail"], r.text
        requests.patch(f"{API}/rider/status", json={"online": False}, headers=H(S["ravi"]))
        partner_accept(S["o1"])
        r = rider_post("ravi", S["o1"], "accept")
        assert r.status_code == 400 and r.json()["detail"] == "Go online to accept deliveries"

    def test_02_online_and_requests(self):
        r = requests.patch(f"{API}/rider/status", json={"online": True}, headers=H(S["ravi"]))
        assert r.status_code == 200 and r.json()["online"] is True
        reqs = requests.get(f"{API}/rider/requests", headers=H(S["ravi"])).json()
        row = next((o for o in reqs["requests"] if o["id"] == S["o1"]), None)
        assert row is not None and row["earning"] == 5500

    def test_03_accept_race_and_busy(self):
        r = rider_post("ravi", S["o1"], "accept")
        assert r.status_code == 200, r.text
        assert r.json()["rider"]["name"] == "Ravi Kumar"
        requests.patch(f"{API}/rider/status", json={"online": True}, headers=H(S["suresh"]))
        r = rider_post("suresh", S["o1"], "accept")
        assert r.status_code == 409 and "already taken" in r.json()["detail"]
        S["o2"] = place_order(0)
        partner_accept(S["o2"])
        r = rider_post("ravi", S["o2"], "accept")
        assert r.status_code == 400 and r.json()["detail"] == "Finish your current delivery first"
        assert rider_post("ravi", S["o1"], "pickup").status_code == 400  # still CONFIRMED

    def test_04_pickup_deliver(self):
        for st in ("PREPARING", "READY"):
            r = requests.post(f"{API}/partner/orders/{S['o1']}/status", json={"status": st}, headers=H(S["partner"]))
            assert r.status_code == 200, r.text
        assert rider_post("suresh", S["o1"], "pickup").status_code == 403
        r = rider_post("ravi", S["o1"], "pickup")
        assert r.status_code == 200 and r.json()["status"] == "OUT_FOR_DELIVERY"
        assert rider_post("ravi", S["o1"], "reject").status_code == 400
        r = rider_post("ravi", S["o1"], "deliver")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "DELIVERED"
        S["delivered_doc"] = d

    def test_05_post_delivery_state(self):
        d = S["delivered_doc"]
        assert d.get("rider_earning") == 5500, d.get("rider_earning")
        assert d.get("payout_status") == "pending"
        assert d.get("delivered_at")
        dash = requests.get(f"{API}/rider/dashboard", headers=H(S["ravi"])).json()
        b = S["dash_before"]
        assert dash["today_deliveries"] == b["today_deliveries"] + 1
        assert dash["today_earnings"] == b["today_earnings"] + 5500
        assert dash["active_order"] is None
        hist = requests.get(f"{API}/rider/history", headers=H(S["ravi"])).json()["orders"]
        row = next(o for o in hist if o["id"] == S["o1"])
        assert row["earning"] == 5500 and row["payout_status"] == "pending"
        assert hist[0]["id"] == S["o1"], "newest delivered should be first"
        riders = requests.get(f"{API}/partner/riders", headers=H(S["partner"])).json()["riders"]
        assert next(x for x in riders if x["id"] == S["ravi_id"])["status"] == "available"

    def test_06_reject_before_pickup(self):
        r = rider_post("ravi", S["o2"], "accept")
        assert r.status_code == 200, r.text
        r = rider_post("ravi", S["o2"], "reject")
        assert r.status_code == 200 and r.json()["rider"] is None
        reqs = requests.get(f"{API}/rider/requests", headers=H(S["ravi"])).json()
        assert any(o["id"] == S["o2"] for o in reqs["requests"])
        riders = requests.get(f"{API}/partner/riders", headers=H(S["partner"])).json()["riders"]
        assert next(x for x in riders if x["id"] == S["ravi_id"])["status"] == "available"

    def test_07_partner_assign_and_gps_ws(self):
        r = requests.post(f"{API}/partner/orders/{S['o2']}/assign-rider", json={"rider_id": S["ravi_id"]},
                          headers=H(S["partner"]))
        assert r.status_code == 200, r.text
        reqs = requests.get(f"{API}/rider/requests", headers=H(S["ravi"])).json()
        assert any(o["id"] == S["o2"] for o in reqs["assigned"])
        dash = requests.get(f"{API}/rider/dashboard", headers=H(S["ravi"])).json()
        assert dash["active_order"]["id"] == S["o2"]

        async def run():
            async with websockets.connect(f"{WS_BASE}/api/ws/orders/{S['o2']}") as ws:
                init = json.loads(await asyncio.wait_for(ws.recv(), 10))
                assert init["type"] == "init"
                await asyncio.sleep(0.5)
                loop = asyncio.get_event_loop()
                resp = await loop.run_in_executor(None, lambda: requests.post(
                    f"{API}/rider/location", json={"lat": 12.98, "lng": 77.605}, headers=H(S["ravi"])))
                assert resp.status_code == 200 and resp.json()["order_id"] == S["o2"]
                deadline = time.time() + 10
                while time.time() < deadline:
                    m = json.loads(await asyncio.wait_for(ws.recv(), 10))
                    if m.get("type") == "location":
                        return m
                raise AssertionError("no location msg")

        m = asyncio.run(run())
        assert m["rider"]["lat"] == 12.98 and m["rider"]["lng"] == 77.605
        assert isinstance(m["eta_mins"], int) and m["status"] == "CONFIRMED"
        o = cust_order(S["o2"])
        assert o["rider"]["lat"] == 12.98 and o["rider"]["lng"] == 77.605

    def test_08_no_auto_progression(self):
        for st in ("PREPARING", "READY"):
            assert requests.post(f"{API}/partner/orders/{S['o2']}/status", json={"status": st},
                                 headers=H(S["partner"])).status_code == 200
        time.sleep(22)
        assert cust_order(S["o2"])["status"] == "READY"
        assert rider_post("ravi", S["o2"], "pickup").json()["status"] == "OUT_FOR_DELIVERY"
        assert rider_post("ravi", S["o2"], "deliver").json()["status"] == "DELIVERED"

    def test_09_location_no_active(self):
        r = requests.post(f"{API}/rider/location", json={"lat": 12.975, "lng": 77.60}, headers=H(S["ravi"]))
        assert r.status_code == 200 and r.json() == {"ok": True, "order_id": None}

    def test_10_customer_cancel_and_partner_reject_free_rider(self):
        o3 = place_order(0)
        r = requests.post(f"{API}/orders/{o3}/cancel", headers=H(S["cust"]))
        assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
        # partner reject on CONFIRMED order that has a rider -> rider freed
        o4 = place_order(0)
        partner_accept(o4)
        assert rider_post("suresh", o4, "accept").status_code == 200
        r = requests.post(f"{API}/partner/orders/{o4}/reject", json={"reason": "TEST"}, headers=H(S["partner"]))
        assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
        riders = requests.get(f"{API}/partner/riders", headers=H(S["partner"])).json()["riders"]
        assert next(x for x in riders if x["id"] == S["suresh_id"])["status"] == "available"
        # customer cancel of CONFIRMED order with rider -> rider freed
        o5 = place_order(0)
        partner_accept(o5)
        assert rider_post("suresh", o5, "accept").status_code == 200
        r = requests.post(f"{API}/orders/{o5}/cancel", headers=H(S["cust"]))
        assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
        dash = requests.get(f"{API}/rider/dashboard", headers=H(S["suresh"])).json()
        assert dash["active_order"] is None
        riders = requests.get(f"{API}/partner/riders", headers=H(S["partner"])).json()["riders"]
        assert next(x for x in riders if x["id"] == S["suresh_id"])["status"] == "available"
