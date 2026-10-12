# DashBite — Customer Food Delivery App (PRD)

## Original Problem Statement
Build a complete, modern Zomato-style Customer Food Delivery mobile application (Phase 1: Customer App ONLY).
- Auth: Guest browsing + email/password account creation
- Checkout: Cash on Delivery + Razorpay
- Data: Real backend API + MongoDB, seeded with realistic restaurant/menu data
- Location: Device location + manual saved addresses
- Order Tracking: Live status updates with simulated progression via WebSockets (preparing for real GPS)
- UI/UX: Premium, modern, mobile-first, Zomato-inspired; safe areas + proper navigation
- Screens: Splash, Onboarding, Login, Registration, Home, Search, Restaurant Listing/Details, Food Menu/Details, Cart, Checkout, Address Selection/Add, Payment Selection, Order Confirmation, My Orders, Order Details, Track Order, Profile, Saved Addresses, Help

## User Personas
- Hungry urban customer who wants fast food discovery and live delivery updates
- Guest browser who explores before committing to an account
- Registered regular who saves addresses and reorders

## Architecture
- **Database:** MongoDB Atlas (cluster0.hddqr9e, db `food`) — switched Jun 2026; local data (8 restaurants, 49 items, users, orders) migrated. `MONGO_URL`/`DB_NAME` in `/app/backend/.env`.
- **Frontend:** Expo Router (SDK 57), React Native 0.86, file-based routing. Tabs (Home/Search/Orders/Profile) with NativeTabs on iOS 26+ and JS Tabs elsewhere. Context providers: Auth, Cart (persisted), Location. Theme tokens from design_guidelines.json (warm sand #FDFBF7, terracotta #D95325, Plus Jakarta Sans + Geist fonts).
- **Backend:** FastAPI (`/app/backend/server.py`) on 0.0.0.0:8001, all routes under `/api`. MongoDB via Motor. JWT auth (bcrypt + PyJWT, 7-day tokens). WebSocket endpoint `/api/ws/orders/{id}` with asyncio order-status simulation + rider GPS interpolation.
- **DB Collections:** users, restaurants, menu_items, addresses, orders. Seed in `/app/backend/seed.py` (8 restaurants, ~49 menu items, mixed Indian cuisines).
- **Payments:** Razorpay — server-side order creation + HMAC-SHA256 signature verification; web uses checkout.js, native uses hosted checkout page (`/api/payments/checkout-page/{id}`) in a WebView with `feastwave://` redirect interception.

## Core Requirements (static)
Guest browsing, email/password auth, restaurant/menu browsing, cart, COD + Razorpay checkout, address management, live order tracking, profile, help.

## Implemented
- **Jun 2026 (Feature pack 2):**
  - Favourites: heart on restaurant cards + restaurant screen, `/favorites` screen via Profile; `favorites` collection, `GET/POST /api/favorites`
  - Coupons: WELCOME50 / FLAT100 / TASTY20 / FREEDEL; `GET /api/coupons`, `POST /api/coupons/validate`; server-side discount in `POST /api/orders` (`coupon_code`, `amounts.discount`)
  - Rating & Review: `POST /api/orders/{id}/review` (DELIVERED only, once); `reviews` collection shown on restaurant screen ("What customers say")
  - Reorder (Orders tab + order details → refills cart) and Cancel (`POST /api/orders/{id}/cancel`, 60s window, cancels simulation, WS broadcasts CANCELLED)
  - Tested: 20/20 backend pytest (`/app/backend/tests/test_new_features.py`) + all frontend flows pass (iteration_2.json)
- **12 Oct 2026 (MVP):**
  - All 18 screens: Splash, Onboarding, Login, Register, Home, Search, Restaurant Details, Food Item modal, Cart, Checkout (incl. Payment Selection + tip), Address Selection, Add/Edit Address, Order Confirmation, My Orders, Order Details, Track Order, Profile, Saved Addresses (in Address screen), Help
  - Backend: auth (register/login/me), home feed, restaurants list/filter, search (restaurants + dishes), address CRUD, orders (server-side bill math), Razorpay order create + verify (+ public verify for hosted page), WebSocket live tracking with simulated progression + rider movement
  - Live tracking verified: CONFIRMED → PREPARING (15s) → OUT_FOR_DELIVERY (40s) → DELIVERED (~100s), rider marker animates, ETA counts down
  - Test suite: `/app/backend/tests/test_dashbite_api.py` (21 backend tests, all passing)
  - Test user: test@dashbite.in / test123

## Known Issues / Blockers
- ⚠️ **Razorpay keys invalid** (401 from Razorpay API directly, re-verified Jun 2026 with same keys). User chose to continue with COD. Integration code is complete and ready.

## Backlog (prioritized)
- **P1:** Fix Razorpay credentials → verify Pay Online end-to-end
- **P1:** Real map on Track screen (react-native-maps) once GPS rider tracking exists
- **P2:** Restaurant admin + rider apps (Phase 2)

## Next Tasks
1. User pastes valid Razorpay test keys → wire into .env → test payment flow
2. Deploy via Publish button → test on Expo Go (native WebView Razorpay checkout)
