# Helper for rider UI tests: create a CONFIRMED order for Biryani Blues / advance partner status / reset riders
import os, sys, requests
API = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"


def tok(path, e, p):
    return requests.post(f"{API}{path}", json={"email": e, "password": p}).json()["token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


cmd = sys.argv[1]
pt = tok("/partner/auth/login", "biryaniblueskitchen@partner.dashbite.in", "partner123")
if cmd == "create":
    ct = tok("/auth/login", "test@dashbite.in", "test123")
    item = next(m["id"] for m in requests.get(f"{API}/partner/menu", headers=H(pt)).json()["menu"] if m.get("available", True))
    o = requests.post(f"{API}/orders", headers=H(ct), json={"items": [{"item_id": item, "qty": 1}],
        "address": {"label": "Home", "line1": "TEST_ui", "lat": 12.99, "lng": 77.61}, "payment_method": "cod", "tip": 2000}).json()["order"]
    if len(sys.argv) < 3 or sys.argv[2] != "placed":
        requests.post(f"{API}/partner/orders/{o['id']}/accept", headers=H(pt))
    print(o["id"])
elif cmd == "accept":
    print(requests.post(f"{API}/partner/orders/{sys.argv[2]}/accept", headers=H(pt)).json()["status"])
elif cmd == "status":
    print(requests.post(f"{API}/partner/orders/{sys.argv[2]}/status", json={"status": sys.argv[3]}, headers=H(pt)).json().get("status"))
elif cmd == "state":
    for e in ("ravi", "suresh"):
        rt = tok("/rider/auth/login", f"{e}@rider.dashbite.in", "rider123")
        d = requests.get(f"{API}/rider/dashboard", headers=H(rt)).json()
        print(e, d["rider"]["online"], d["rider"]["status"], (d["active_order"] or {}).get("id"), (d["active_order"] or {}).get("status"),
              "today", d["today_deliveries"], d["today_earnings"], "pending", d["pending_requests"])
elif cmd == "offline":
    rt = tok("/rider/auth/login", f"{sys.argv[2]}@rider.dashbite.in", "rider123")
    print(requests.patch(f"{API}/rider/status", json={"online": False}, headers=H(rt)).json()["online"])
