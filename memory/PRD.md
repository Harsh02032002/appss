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
- **Frontend:** Expo Router (SDK 57), React Native 0.86, file-based routing. Tabs (Home/Search/Orders/Profile) with NativeTabs on iOS 26+ and JS Tabs elsewhere. Context providers: Auth, Cart (persisted), Location. Theme tokens from design_guidelines.json (warm sand #FDFBF7, terracotta #D95325, Plus Jakarta Sans + Geist fonts).
- **Backend:** FastAPI (`/app/backend/server.py`) on 0.0.0.0:8001, all routes under `/api`. MongoDB via Motor. JWT auth (bcrypt + PyJWT, 7-day tokens). WebSocket endpoint `/api/ws/orders/{id}` with asyncio order-status simulation + rider GPS interpolation.
- **DB Collections:** users, restaurants, menu_items, addresses, orders. Seed in `/app/backend/seed.py` (8 restaurants, ~49 menu items, mixed Indian cuisines).
- **Payments:** Razorpay — server-side order creation + HMAC-SHA256 signature verification; web uses checkout.js, native uses hosted checkout page (`/api/payments/checkout-page/{id}`) in a WebView with `feastwave://` redirect interception.

## Core Requirements (static)
Guest browsing, email/password auth, restaurant/menu browsing, cart, COD + Razorpay checkout, address management, live order tracking, profile, help.

## Implemented
- **12 Oct 2026 (MVP):**
  - All 18 screens: Splash, Onboarding, Login, Register, Home, Search, Restaurant Details, Food Item modal, Cart, Checkout (incl. Payment Selection + tip), Address Selection, Add/Edit Address, Order Confirmation, My Orders, Order Details, Track Order, Profile, Saved Addresses (in Address screen), Help
  - Backend: auth (register/login/me), home feed, restaurants list/filter, search (restaurants + dishes), address CRUD, orders (server-side bill math), Razorpay order create + verify (+ public verify for hosted page), WebSocket live tracking with simulated progression + rider movement
  - Live tracking verified: CONFIRMED → PREPARING (15s) → OUT_FOR_DELIVERY (40s) → DELIVERED (~100s), rider marker animates, ETA counts down
  - Test suite: `/app/backend/tests/test_dashbite_api.py` (21 backend tests, all passing)
  - Test user: test@dashbite.in / test123

## Known Issues / Blockers
- ⚠️ **Razorpay keys invalid** (401 from Razorpay API directly). User to regenerate Test Mode keys at dashboard.razorpay.com → Account & Settings → API Keys, then update `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `/app/backend/.env`. Integration code is complete and ready.

## Backlog (prioritized)
- **P0:** Fix Razorpay credentials → verify Pay Online end-to-end
- **P1:** Order cancellation (within 60s window), reorder button on past orders
- **P1:** Real map on Track screen (react-native-maps) once GPS rider tracking exists
- **P2:** Promo codes / coupon application at checkout
- **P2:** Ratings & reviews after delivery
- **P2:** Restaurant admin + rider apps (Phase 2)

## Next Tasks
1. User pastes valid Razorpay test keys → wire into .env → test payment flow
2. Deploy via Publish button → test on Expo Go (native WebView Razorpay checkout)
