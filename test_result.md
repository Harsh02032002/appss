#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Iteration: 4 new features (Favourites, Coupons, Rating & Review, Reorder + Cancel) — Jun 2026
backend:
  - task: "Favourites API (GET /api/favorites, POST /api/favorites/{restaurant_id} toggle)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
  - task: "Coupons API (GET /api/coupons, POST /api/coupons/validate, coupon_code in POST /api/orders)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
  - task: "Order review (POST /api/orders/{id}/review) + reviews in GET /api/restaurants/{id}"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
  - task: "Order cancel (POST /api/orders/{id}/cancel, 60s window, statuses PAYMENT_PENDING/CONFIRMED/PREPARING)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
frontend:
  - task: "Heart button on restaurant cards + restaurant screen, Favourites screen (/favorites) via Profile"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/context/favorites.tsx, /app/frontend/app/favorites.tsx"
  - task: "Coupon input + coupon cards on Checkout, discount shown in bill"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/checkout.tsx"
  - task: "Order details: Cancel (countdown), Rate & Review form, Reorder button; Orders tab: Reorder/Rate buttons on past orders"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/order/[id].tsx, /app/frontend/app/(tabs)/orders.tsx"
agent_communication:
  - agent: "main"
    message: "Backend endpoints smoke-tested manually via python requests (all pass). Need full frontend+backend test."

## Iteration: Restaurant Partner App + new order flow + search filters + real map — Jun 2026
backend:
  - task: "Partner auth (/api/partner/auth/login, /me), dashboard, orders (accept/reject/status/assign-rider), riders, menu availability, restaurant open/close, partner WS /api/partner/ws?token="
    implemented: true
    working: "NA"
    file: "/app/backend/partner.py, /app/backend/core.py"
  - task: "New order lifecycle: PLACED -> CONFIRMED -> PREPARING -> READY -> OUT_FOR_DELIVERY (sim after rider assigned + READY) -> DELIVERED; customer cancel window includes PLACED"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py, /app/backend/core.py"
  - task: "GET /api/restaurants filters: sort=rating|time|price_low|price_high, veg_only, rating_min, cuisine; menu item 'available' + restaurant 'is_open' enforcement on order create"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
frontend (restaurant-app, separate Expo project at /app/restaurant-app):
  - task: "Login, Orders tab (segments New/In kitchen/Ready & out/Past, live WS), Order details, Assign rider sheet, Reject sheet, Menu availability toggles, Dashboard stats + open/close + logout"
    implemented: true
    working: "NA"
frontend (customer app):
  - task: "Search tab filters (sort/veg/rating/cuisine chips), Track screen real map (react-native-maps native, illustrated fallback web) + new statuses, unavailable items, closed restaurant badge"
    implemented: true
    working: "NA"
agent_communication:
  - agent: "main"
    message: "Backend partner flow smoke tested manually (login→place order→accept→assign→preparing→ready→auto OUT_FOR_DELIVERY). Only ONE Expo app can be served on the public URL at a time (port 3000)."

## Iteration: Rider App (/app/rider-app) + rider backend — real GPS, no simulation
backend:
  - task: "Rider auth/login, PATCH /api/rider/status, GET dashboard/requests/history, POST orders/{id}/accept|reject|pickup|deliver (atomic claim, ownership checks), POST /api/rider/location (broadcasts to customer order WS), WS /api/rider/ws?token="
    implemented: true
    working: "NA"
    file: "/app/backend/rider.py, /app/backend/core.py"
  - task: "Removed fake delivery simulation; OUT_FOR_DELIVERY/DELIVERED now set only by rider actions"
    implemented: true
    working: "NA"
frontend (rider-app):
  - task: "Login, Home (online toggle, stats, active delivery, requests), Requests, Earnings/History, Profile, Delivery screen (Leaflet+OSM map via WebView/iframe, OSRM route, navigate, pickup/deliver/decline)"
    implemented: true
    working: "NA"
agent_communication:
  - agent: "main"
    message: "Rider app currently served on public URL (port 3000). Backend rider flow smoke-tested manually (login→online→accept→location→pickup→deliver→dashboard/history)."
