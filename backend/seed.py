"""Seed data: realistic Zomato-like restaurants and menus (mixed Indian cuisines)."""
from datetime import datetime, timezone
from bson import ObjectId

IMG = {
    "biryani": [
        "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=800&auto=format&fit=crop",
    ],
    "pizza": [
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?q=80&w=800&auto=format&fit=crop",
    ],
    "burger": [
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=800&auto=format&fit=crop",
    ],
    "south": [
        "https://images.unsplash.com/photo-1630383249896-424e482df921?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=800&auto=format&fit=crop",
    ],
    "north": [
        "https://images.unsplash.com/photo-1585937421612-70a008356fbe?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1505253758473-96b7015fcd40?q=80&w=800&auto=format&fit=crop",
    ],
    "chinese": [
        "https://images.unsplash.com/photo-1525755662778-989d0524087e?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1552611052-33e04de081de?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?q=80&w=800&auto=format&fit=crop",
    ],
    "dessert": [
        "https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1565958011703-44f9829ba187?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=800&auto=format&fit=crop",
    ],
    "healthy": [
        "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=800&auto=format&fit=crop",
    ],
}

CATEGORIES = [
    {"name": "Biryani", "image": IMG["biryani"][0]},
    {"name": "Pizza", "image": IMG["pizza"][1]},
    {"name": "Burger", "image": IMG["burger"][0]},
    {"name": "South Indian", "image": IMG["south"][0]},
    {"name": "North Indian", "image": IMG["north"][1]},
    {"name": "Chinese", "image": IMG["chinese"][0]},
    {"name": "Desserts", "image": IMG["dessert"][0]},
    {"name": "Healthy", "image": IMG["healthy"][1]},
]

BANNERS = [
    {
        "title": "FLAT 50% OFF",
        "subtitle": "On your first order | Code: WELCOME50",
        "image": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop",
    },
    {
        "title": "Free Delivery",
        "subtitle": "On all orders above ₹499",
        "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1200&auto=format&fit=crop",
    },
    {
        "title": "Fresh & Healthy",
        "subtitle": "Salads and bowls from ₹199",
        "image": "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1200&auto=format&fit=crop",
    },
]


def item(restaurant_id, name, desc, price, veg, category, image, bestseller=False, rating=4.2):
    return {
        "_id": ObjectId(),
        "restaurant_id": restaurant_id,
        "name": name,
        "description": desc,
        "price": price * 100,  # paise
        "veg": veg,
        "category": category,
        "image": image,
        "bestseller": bestseller,
        "rating": rating,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def build_seed():
    restaurants = []
    menu = []

    def add_restaurant(name, cuisines, rating, votes, time, price_two, image, offer, area, lat, lng, items):
        rid = ObjectId()
        restaurants.append({
            "_id": rid,
            "name": name,
            "cuisines": cuisines,
            "rating": rating,
            "rating_count": votes,
            "delivery_time": time,
            "price_for_two": price_two,
            "image": image,
            "offer": offer,
            "address": area,
            "lat": lat,
            "lng": lng,
            "is_open": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        for it in items:
            menu.append(item(rid, *it))
        return rid

    add_restaurant(
        "Biryani Blues Kitchen", ["Biryani", "North Indian"], 4.4, "2.1k", "30-35 min", 600,
        IMG["biryani"][0], "50% OFF up to ₹100", "Koramangala, Bengaluru", 12.9352, 77.6245,
        [
            ("Hyderabadi Chicken Biryani", "Slow-cooked basmati layered with spiced chicken, saffron and fried onions. Served with raita.", 329, False, "Biryanis", IMG["biryani"][0], True, 4.5),
            ("Paneer Dum Biryani", "Fragrant basmati with marinated paneer, mint and brown onions.", 279, True, "Biryanis", IMG["biryani"][2], False, 4.3),
            ("Mughlai Egg Biryani", "Classic dum biryani topped with masala fried eggs.", 229, False, "Biryanis", IMG["biryani"][1], False, 4.1),
            ("Chicken 65", "Fiery deep-fried chicken tossed with curry leaves and red chillies.", 249, False, "Starters", IMG["north"][2], True, 4.4),
            ("Mirchi ka Salan", "Tangy peanut-sesame curry with whole green chillies.", 99, True, "Accompaniments", IMG["north"][0], False, 4.0),
            ("Double ka Meetha", "Hyderabadi bread pudding soaked in saffron milk and nuts.", 129, True, "Desserts", IMG["dessert"][2], False, 4.3),
        ],
    )

    add_restaurant(
        "Slice Society", ["Pizza", "Italian"], 4.3, "1.8k", "25-30 min", 700,
        IMG["pizza"][0], "Buy 1 Get 1 Free", "Indiranagar, Bengaluru", 12.9719, 77.6412,
        [
            ("Margherita Classic", "San Marzano tomato sauce, fresh mozzarella and basil on a wood-fired base.", 299, True, "Pizzas", IMG["pizza"][1], True, 4.4),
            ("Farmhouse Feast", "Loaded with crunchy capsicum, onions, mushrooms and sweet corn.", 399, True, "Pizzas", IMG["pizza"][2], False, 4.2),
            ("Pepperoni Blast", "Double pepperoni, extra mozzarella and oregano dust.", 449, False, "Pizzas", IMG["pizza"][0], True, 4.5),
            ("BBQ Chicken Pizza", "Smoky BBQ sauce, grilled chicken, caramelised onions.", 429, False, "Pizzas", IMG["pizza"][2], False, 4.3),
            ("Garlic Breadsticks", "Buttery garlic bread with cheese dip.", 149, True, "Sides", IMG["north"][2], False, 4.1),
            ("Choco Lava Cake", "Molten chocolate centre cake, baked fresh.", 109, True, "Desserts", IMG["dessert"][0], False, 4.6),
        ],
    )

    add_restaurant(
        "Burger Theory", ["Burger", "Fast Food"], 4.2, "3.4k", "20-25 min", 450,
        IMG["burger"][0], "20% OFF up to ₹75", "HSR Layout, Bengaluru", 12.9116, 77.6474,
        [
            ("Classic Smash Burger", "Smashed patty, cheddar, house sauce, pickles in a toasted brioche bun.", 199, False, "Burgers", IMG["burger"][0], True, 4.4),
            ("Crispy Chicken Burger", "Buttermilk-fried chicken, chipotle mayo, crunchy slaw.", 229, False, "Burgers", IMG["burger"][2], False, 4.3),
            ("Double Cheese Blast", "Two patties, double cheddar, caramelised onions.", 299, False, "Burgers", IMG["burger"][1], False, 4.5),
            ("Veggie Zinger", "Crispy veg patty, mint mayo, fresh lettuce.", 179, True, "Burgers", IMG["burger"][2], False, 4.0),
            ("Peri Peri Fries", "Crispy fries dusted with peri peri spice mix.", 129, True, "Sides", IMG["burger"][1], True, 4.2),
            ("Oreo Thickshake", "Creamy vanilla shake blended with Oreo crumbles.", 149, True, "Beverages", IMG["dessert"][1], False, 4.4),
        ],
    )

    add_restaurant(
        "Madras Dosa Co.", ["South Indian"], 4.5, "2.9k", "25-30 min", 300,
        IMG["south"][0], "Flat ₹50 OFF above ₹299", "Jayanagar, Bengaluru", 12.9308, 77.5838,
        [
            ("Masala Dosa", "Golden crispy dosa with spiced potato filling, sambar and chutneys.", 129, True, "Dosas", IMG["south"][0], True, 4.6),
            ("Ghee Roast Dosa", "Extra-crispy dosa roasted in pure ghee.", 159, True, "Dosas", IMG["south"][0], False, 4.5),
            ("Rava Masala Dosa", "Semolina crepe with onions, chillies and potato masala.", 149, True, "Dosas", IMG["south"][0], False, 4.3),
            ("Idli Sambar (4 pc)", "Steamed rice cakes with hot sambar and coconut chutney.", 99, True, "Tiffin", IMG["south"][1], False, 4.4),
            ("Medu Vada (3 pc)", "Crispy urad dal vadas, fluffy inside.", 89, True, "Tiffin", IMG["south"][2], False, 4.2),
            ("Filter Coffee", "Strong frothy degree coffee, served in davara-tumbler.", 49, True, "Beverages", IMG["south"][1], False, 4.7),
            ("Mysore Pak", "Melt-in-mouth ghee sweet from gram flour.", 79, True, "Desserts", IMG["dessert"][2], False, 4.3),
        ],
    )

    add_restaurant(
        "Curry Leaf House", ["North Indian", "Curry"], 4.1, "1.2k", "35-40 min", 650,
        IMG["north"][0], "30% OFF up to ₹120", "BTM Layout, Bengaluru", 12.9166, 77.6101,
        [
            ("Butter Chicken", "Tandoori chicken simmered in creamy tomato-makhani gravy.", 349, False, "Mains", IMG["north"][1], True, 4.4),
            ("Paneer Butter Masala", "Soft paneer in rich cashew-tomato gravy.", 299, True, "Mains", IMG["north"][0], True, 4.3),
            ("Dal Makhani", "Slow-cooked black lentils finished with cream and butter.", 249, True, "Mains", IMG["north"][2], False, 4.2),
            ("Garlic Naan", "Tandoor-baked naan brushed with garlic butter.", 59, True, "Breads", IMG["north"][0], False, 4.1),
            ("Jeera Rice", "Basmati tempered with ghee and cumin.", 179, True, "Rice", IMG["north"][2], False, 4.0),
            ("Gulab Jamun (2 pc)", "Warm khoya dumplings in rose syrup.", 99, True, "Desserts", IMG["dessert"][2], False, 4.5),
        ],
    )

    add_restaurant(
        "Wok This Way", ["Chinese", "Asian"], 4.0, "980", "30-35 min", 550,
        IMG["chinese"][0], "Free Spring Rolls above ₹399", "Whitefield, Bengaluru", 12.9698, 77.7500,
        [
            ("Veg Hakka Noodles", "Wok-tossed noodles with crunchy vegetables and soy glaze.", 199, True, "Noodles", IMG["chinese"][0], False, 4.1),
            ("Chicken Chowmein", "Street-style noodles with shredded chicken and scallions.", 249, False, "Noodles", IMG["chinese"][1], True, 4.3),
            ("Veg Manchurian Gravy", "Crispy veg dumplings in a garlicky Indo-Chinese gravy.", 229, True, "Mains", IMG["chinese"][2], False, 4.0),
            ("Chicken Fried Rice", "Smoky wok rice with egg and chicken.", 219, False, "Rice", IMG["chinese"][1], False, 4.2),
            ("Chilli Paneer Dry", "Battered paneer tossed with peppers in chilli sauce.", 269, True, "Starters", IMG["chinese"][2], True, 4.4),
            ("Veg Spring Rolls", "Crisp rolls stuffed with glass noodles and vegetables.", 159, True, "Starters", IMG["chinese"][0], False, 4.1),
        ],
    )

    add_restaurant(
        "Sugar Rush", ["Desserts", "Bakery"], 4.6, "2.5k", "20-25 min", 400,
        IMG["dessert"][0], "Flat 20% OFF", "JP Nagar, Bengaluru", 12.9077, 77.5851,
        [
            ("Belgian Chocolate Truffle", "Dense 54% dark chocolate ganache cake slice.", 189, True, "Cakes", IMG["dessert"][0], True, 4.7),
            ("Red Velvet Pastry", "Classic red velvet with cream cheese frosting.", 149, True, "Cakes", IMG["dessert"][1], False, 4.5),
            ("Blueberry Cheesecake", "Baked cheesecake with a blueberry compote top.", 219, True, "Cheesecakes", IMG["dessert"][1], True, 4.6),
            ("Fudgy Walnut Brownie", "Warm chocolate brownie loaded with walnuts.", 129, True, "Brownies", IMG["dessert"][0], False, 4.4),
            ("Macarons Box (4 pc)", "Assorted French macarons — pistachio, rose, vanilla, salted caramel.", 249, True, "Macarons", IMG["dessert"][2], False, 4.3),
            ("Tres Leches", "Milk-soaked sponge cake topped with whipped cream.", 199, True, "Cakes", IMG["dessert"][2], False, 4.5),
        ],
    )

    add_restaurant(
        "Green Bowl Co.", ["Healthy", "Salads"], 4.3, "860", "25-30 min", 500,
        IMG["healthy"][0], "Free smoothie above ₹499", "Koramangala, Bengaluru", 12.9345, 77.6260,
        [
            ("Buddha Bowl", "Quinoa, roasted veggies, hummus, greens and tahini drizzle.", 299, True, "Bowls", IMG["healthy"][0], True, 4.5),
            ("Grilled Chicken Salad", "Herb-grilled chicken over crunchy garden greens.", 329, False, "Salads", IMG["healthy"][2], False, 4.4),
            ("Quinoa Fiesta", "Mexican-style quinoa with beans, corn, salsa and lime.", 279, True, "Bowls", IMG["healthy"][1], False, 4.2),
            ("Paneer Tikka Bowl", "Charred paneer tikka on millet with mint yogurt.", 289, True, "Bowls", IMG["healthy"][2], False, 4.3),
            ("Berry Blast Smoothie", "Strawberries, blueberries, banana and Greek yogurt.", 149, True, "Smoothies", IMG["healthy"][1], False, 4.4),
            ("Avocado Toast", "Sourdough, smashed avocado, chilli flakes, seeds.", 199, True, "Toasts", IMG["healthy"][0], False, 4.1),
        ],
    )

    return restaurants, menu


async def seed_database(db):
    restaurants, menu = build_seed()
    await db.restaurants.insert_many(restaurants)
    await db.menu_items.insert_many(menu)
    await db.menu_items.create_index("restaurant_id")
    await db.restaurants.create_index("name")
    return len(restaurants), len(menu)
