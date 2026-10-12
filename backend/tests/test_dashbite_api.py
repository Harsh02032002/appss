"""Backend sanity tests for DashBite: health, browsing, search, auth, orders."""
import pytest
import requests

from conftest import BASE_URL


class TestHealthAndBrowsing:
    """Public browsing endpoints"""

    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "DashBite" in r.json()["message"]

    def test_home_payload(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/home")
        assert r.status_code == 200
        data = r.json()
        assert len(data["categories"]) > 0
        assert len(data["banners"]) > 0
        assert len(data["featured"]) > 0

    def test_restaurants_seeded_8(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/restaurants")
        assert r.status_code == 200
        rests = r.json()["restaurants"]
        assert len(rests) == 8, f"expected 8 seeded restaurants, got {len(rests)}"
        for rest in rests:
            assert rest["id"] and rest["name"] and "rating" in rest

    def test_restaurants_cuisine_filter(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/restaurants", params={"cuisine": "Biryani"})
        assert r.status_code == 200
        rests = r.json()["restaurants"]
        assert len(rests) >= 1
        for rest in rests:
            assert any(c.lower() == "biryani" for c in rest["cuisines"])

    def test_restaurant_details_with_menu(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/restaurants")
        rid = r.json()["restaurants"][0]["id"]
        d = api_client.get(f"{BASE_URL}/api/restaurants/{rid}")
        assert d.status_code == 200
        data = d.json()
        assert data["restaurant"]["id"] == rid
        assert len(data["menu"]) > 0
        return data["menu"][0]["id"]

    def test_menu_item_details(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/search", params={"q": "biryani"})
        dishes = r.json()["dishes"]
        assert len(dishes) > 0
        item_id = dishes[0]["id"]
        d = api_client.get(f"{BASE_URL}/api/menu-items/{item_id}")
        assert d.status_code == 200
        item = d.json()
        assert item["id"] == item_id
        assert "restaurant" in item
        assert "price" in item

    def test_restaurant_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/restaurants/000000000000000000000000")
        assert r.status_code == 404


class TestSearch:
    """Search endpoint - both restaurants and dishes"""

    def test_search_pizza(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/search", params={"q": "pizza"})
        assert r.status_code == 200
        data = r.json()
        total = len(data["restaurants"]) + len(data["dishes"])
        assert total > 0, "search 'pizza' returned nothing"

    def test_search_biryani_both_tabs(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/search", params={"q": "biryani"})
        assert r.status_code == 200
        data = r.json()
        assert len(data["restaurants"]) > 0, "no restaurant results for biryani"
        assert len(data["dishes"]) > 0, "no dish results for biryani"
        # dishes should carry restaurant context for UI
        dish = data["dishes"][0]
        assert dish.get("restaurant_name")
        assert dish.get("delivery_time")

    def test_search_empty(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/search", params={"q": ""})
        assert r.status_code == 200
        data = r.json()
        assert data == {"restaurants": [], "dishes": []}


class TestAuth:
    """Auth flows: login, register, wrong password, /me"""

    def test_login_success(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@dashbite.in", "password": "test123"})
        assert r.status_code == 200
        data = r.json()
        assert data["token"]
        assert data["user"]["email"] == "test@dashbite.in"
        assert "password" not in str(data["user"]).lower()

    def test_login_wrong_password(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@dashbite.in", "password": "wrongpass1"})
        assert r.status_code == 401

    def test_register_new_user_and_login(self, api_client):
        import time
        email = f"TEST_user_{int(time.time())}@dashbite.in"
        r = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "TEST Pytest User", "email": email,
            "phone": "9000000001", "password": "pass1234"})
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["token"]
        assert data["user"]["email"] == email.lower()
        # duplicate register -> 409
        r2 = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "TEST Pytest User", "email": email, "password": "pass1234"})
        assert r2.status_code == 409

    def test_register_short_password_rejected(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "TEST Short", "email": "TEST_short@dashbite.in", "password": "123"})
        assert r.status_code == 422

    def test_me_requires_auth(self, api_client):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code in (401, 403)

    def test_me_with_token(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == "test@dashbite.in"


class TestAddressesAndOrders:
    """Authenticated address CRUD + COD order create/list/get + bill math"""

    def test_orders_requires_auth(self, api_client):
        r = requests.get(f"{BASE_URL}/api/orders")
        assert r.status_code in (401, 403)

    def test_address_crud_and_default(self, auth_client):
        # create
        payload = {"label": "Work", "line1": "TEST 100 Ft Road, Indiranagar",
                   "landmark": "Near Metro", "city": "Bengaluru", "pincode": "560038"}
        r = auth_client.post(f"{BASE_URL}/api/addresses", json=payload)
        assert r.status_code == 201, r.text
        addr = r.json()
        assert addr["line1"] == payload["line1"]
        addr_id = addr["id"]
        # read-back persistence
        lst = auth_client.get(f"{BASE_URL}/api/addresses")
        assert lst.status_code == 200
        ids = [a["id"] for a in lst.json()["addresses"]]
        assert addr_id in ids
        # delete + verify gone
        d = auth_client.delete(f"{BASE_URL}/api/addresses/{addr_id}")
        assert d.status_code == 200
        lst2 = auth_client.get(f"{BASE_URL}/api/addresses")
        assert addr_id not in [a["id"] for a in lst2.json()["addresses"]]

    def test_cod_order_flow_and_bill_math(self, auth_client):
        # pick a dish from search
        s = auth_client.get(f"{BASE_URL}/api/search", params={"q": "biryani"})
        dishes = s.json()["dishes"]
        assert dishes
        item = dishes[0]
        qty = 2
        r = auth_client.post(f"{BASE_URL}/api/orders", json={
            "items": [{"item_id": item["id"], "qty": qty, "notes": "TEST extra spicy"}],
            "address": {"label": "Home", "line1": "TEST 12 MG Road", "city": "Bengaluru",
                        "pincode": "560001"},
            "payment_method": "cod",
            "tip": 2000,  # ₹20
        })
        assert r.status_code == 201, r.text
        order = r.json()["order"]
        amounts = order["amounts"]
        assert amounts["subtotal"] == item["price"] * qty
        assert amounts["delivery_fee"] == 3500
        assert amounts["taxes"] == round(amounts["subtotal"] * 0.05)
        assert amounts["total"] == (amounts["subtotal"] + amounts["delivery_fee"]
                                    + amounts["taxes"] + amounts["tip"])
        assert order["status"] == "CONFIRMED"
        assert order["timeline"][0]["status"] == "CONFIRMED"
        assert order["razorpay_order_id"] is None
        oid_ = order["id"]
        # GET back the order (persistence + ownership)
        g = auth_client.get(f"{BASE_URL}/api/orders/{oid_}")
        assert g.status_code == 200
        assert g.json()["id"] == oid_
        # list orders includes it
        lst = auth_client.get(f"{BASE_URL}/api/orders")
        assert lst.status_code == 200
        assert oid_ in [o["id"] for o in lst.json()["orders"]]
        # new order should be first (sorted desc by created_at)
        assert lst.json()["orders"][0]["id"] == oid_

    def test_mixed_restaurant_order_rejected(self, auth_client):
        s1 = auth_client.get(f"{BASE_URL}/api/search", params={"q": "biryani"}).json()["dishes"]
        s2 = auth_client.get(f"{BASE_URL}/api/search", params={"q": "pizza"}).json()["dishes"]
        if not s1 or not s2:
            pytest.skip("not enough dishes to test mixed-restaurant rejection")
        r = auth_client.post(f"{BASE_URL}/api/orders", json={
            "items": [{"item_id": s1[0]["id"], "qty": 1},
                      {"item_id": s2[0]["id"], "qty": 1}],
            "address": {"label": "Home", "line1": "TEST x"},
            "payment_method": "cod", "tip": 0})
        assert r.status_code == 400

    def test_empty_cart_rejected(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/orders", json={
            "items": [],
            "address": {"label": "Home", "line1": "TEST x"},
            "payment_method": "cod", "tip": 0})
        assert r.status_code == 400
