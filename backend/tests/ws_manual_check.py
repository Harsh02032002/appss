"""Quick WS verification: create COD order, connect to /api/ws/orders/{id}, observe status transitions."""
import asyncio
import json
import os
import sys
import time

import requests

BASE_URL = "https://feastwave.preview.emergentagent.com"


async def main():
    try:
        import websockets
    except ImportError:
        print("websockets not installed")
        return 2

    # login
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "test@dashbite.in", "password": "test123"})
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # get a dish
    s = requests.get(f"{BASE_URL}/api/search?q=biryani").json()
    item = s["dishes"][0]

    # create COD order
    o = requests.post(f"{BASE_URL}/api/orders", headers=headers, json={
        "items": [{"item_id": item["id"], "qty": 1}],
        "address": {"label": "Home", "line1": "TEST WS 12 MG Road", "city": "Bengaluru", "pincode": "560001"},
        "payment_method": "cod", "tip": 0})
    assert o.status_code == 201, o.text
    order_id = o.json()["order"]["id"]
    print(f"ORDER_ID={order_id} status={o.json()['order']['status']}")

    ws_url = f"wss://feastwave.preview.emergentagent.com/api/ws/orders/{order_id}"
    events = []
    start = time.time()
    async with websockets.connect(ws_url) as ws:
        while time.time() - start < 75:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=80)
            except asyncio.TimeoutError:
                break
            data = json.loads(msg)
            elapsed = round(time.time() - start, 1)
            events.append({"t": elapsed, **data})
            print(f"[{elapsed}s] {data.get('type')}: {data.get('status', data.get('progress', ''))}")
            if data.get("status") == "OUT_FOR_DELIVERY":
                break

    statuses = [e.get("status") for e in events if e.get("type") == "status"]
    assert any(e.get("type") == "init" for e in events), "no init event"
    assert "PREPARING" in statuses, f"PREPARING not observed. events={events}"
    print("WS_OK transitions:", statuses)
    return 0


sys.exit(asyncio.run(main()))
