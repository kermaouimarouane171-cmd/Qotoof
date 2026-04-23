#!/bin/bash
# Full API integration test for all 4 roles
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWlpeWVrZmtmbGVzZG1jdnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMTg4NDMsImV4cCI6MjA5MTY5NDg0M30.6GWGva5OXcOH55CwjvvHNXlPN4pF5EYqQPRLh5Y-USo"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWlpeWVrZmtmbGVzZG1jdnZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjExODg0MywiZXhwIjoyMDkxNjk0ODQzfQ.dP9k4FRmiRNcq9rRv5er2FEsMebzvyC-QITuv-7poN4"
BASE="https://oyaiiyekfkflesdmcvvo.supabase.co"

PASS=0
FAIL=0

check() {
  local label="$1"
  local status="$2"
  if [ "$status" = "OK" ]; then
    echo "  ✓ $label"
    PASS=$((PASS+1))
  else
    echo "  ✗ $label -- $status"
    FAIL=$((FAIL+1))
  fi
}

login() {
  curl -s -X POST "$BASE/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('access_token',''))"
}

api_get() {
  local token="$1"; local path="$2"
  curl -s "$BASE/rest/v1/$path" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $token"
}

api_post() {
  local token="$1"; local path="$2"; local data="$3"
  curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/rest/v1/$path" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$data"
}

echo ""
echo "============================================"
echo " GreenMarket API Integration Test Suite"
echo "============================================"

# Get tokens
BUYER_TOKEN=$(login "buyer@greenmarket.test" "Test@123456")
VENDOR_TOKEN=$(login "vendor@greenmarket.test" "Test@123456")
DRIVER_TOKEN=$(login "driver@greenmarket.test" "Test@123456")
ADMIN_TOKEN=$(login "admin@greenmarket.test" "Test@123456")

[ -n "$BUYER_TOKEN" ]  && check "buyer login"  "OK" || check "buyer login"  "No token"
[ -n "$VENDOR_TOKEN" ] && check "vendor login" "OK" || check "vendor login" "No token"
[ -n "$DRIVER_TOKEN" ] && check "driver login" "OK" || check "driver login" "No token"
[ -n "$ADMIN_TOKEN" ]  && check "admin login"  "OK" || check "admin login"  "No token"

echo ""
echo "--- Public API ---"

PRODUCTS=$(api_get "$ANON_KEY" "products?select=id,name,category&is_available=eq.true&limit=5")
COUNT=$(echo "$PRODUCTS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)")
[ "$COUNT" -gt 0 ] && check "public products list ($COUNT items)" "OK" || check "public products list" "EMPTY or error: $PRODUCTS"

STORES=$(api_get "$ANON_KEY" "stores?select=id,name&is_active=eq.true")
SCOUNT=$(echo "$STORES" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)")
[ "$SCOUNT" -gt 0 ] && check "public stores list ($SCOUNT stores)" "OK" || check "public stores list" "EMPTY"

echo ""
echo "--- Buyer Flow ---"

# Get buyer profile
PROFILE=$(api_get "$BUYER_TOKEN" "profiles?select=id,email,role&id=eq.6e3b748f-c338-46d6-a12f-8cbb9a0d9bf9")
ROLE=$(echo "$PROFILE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['role'] if d else 'none')")
[ "$ROLE" = "buyer" ] && check "buyer profile role=buyer" "OK" || check "buyer profile role" "got '$ROLE'"

# Get first product ID
PROD_ID=$(echo "$PRODUCTS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if d else '')")

# Add to cart
if [ -n "$PROD_ID" ]; then
  CART_STATUS=$(api_post "$BUYER_TOKEN" \
    "cart_items" \
    "{\"user_id\":\"6e3b748f-c338-46d6-a12f-8cbb9a0d9bf9\",\"product_id\":\"$PROD_ID\",\"quantity\":2}")
  if [ "$CART_STATUS" = "201" ] || [ "$CART_STATUS" = "409" ]; then
    check "add product to cart" "OK"
  else
    check "add product to cart" "HTTP $CART_STATUS"
  fi
fi

# Read cart
CART=$(api_get "$BUYER_TOKEN" "cart_items?user_id=eq.6e3b748f-c338-46d6-a12f-8cbb9a0d9bf9&select=id,quantity,product_id")
CCOUNT=$(echo "$CART" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)")
[ "$CCOUNT" -gt 0 ] && check "read cart ($CCOUNT items)" "OK" || check "read cart" "EMPTY: $CART"

echo ""
echo "--- Vendor Flow ---"

# Get vendor profile
VPROFILE=$(api_get "$VENDOR_TOKEN" "profiles?select=id,role,vendor_status&id=eq.6dfb9e5b-0b6f-448d-ba27-4585fa867a31")
VSTATUS=$(echo "$VPROFILE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0].get('vendor_status','?') if d else 'none')")
[ "$VSTATUS" = "approved" ] && check "vendor status=approved" "OK" || check "vendor status" "got '$VSTATUS'"

# Get vendor products
VPRODUCTS=$(api_get "$VENDOR_TOKEN" "products?vendor_id=eq.6dfb9e5b-0b6f-448d-ba27-4585fa867a31&select=id,name")
VPCOUNT=$(echo "$VPRODUCTS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)")
[ "$VPCOUNT" -gt 0 ] && check "vendor products ($VPCOUNT items)" "OK" || check "vendor products" "EMPTY"

# Get vendor store
VSTORE=$(api_get "$VENDOR_TOKEN" "stores?owner_id=eq.6dfb9e5b-0b6f-448d-ba27-4585fa867a31&select=id,name")
VSCOUNT=$(echo "$VSTORE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)")
[ "$VSCOUNT" -gt 0 ] && check "vendor stores ($VSCOUNT stores)" "OK" || check "vendor stores" "EMPTY"

echo ""
echo "--- Driver Flow ---"

# Get driver profile
DPROFILE=$(api_get "$DRIVER_TOKEN" "profiles?select=id,role,vehicle_type,is_available_for_delivery&id=eq.742cf3ca-cbe3-485d-ac30-4c4d5ace42bd")
DVEHICLE=$(echo "$DPROFILE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0].get('vehicle_type','?') if d else 'none')")
[ "$DVEHICLE" = "motorcycle" ] && check "driver vehicle=motorcycle" "OK" || check "driver vehicle" "got '$DVEHICLE'"

echo ""
echo "--- Admin Flow ---"

# Admin can list all profiles
ALLPROFILES=$(api_get "$ADMIN_TOKEN" "profiles?select=id,email,role&limit=10")
APCOUNT=$(echo "$ALLPROFILES" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)")
[ "$APCOUNT" -gt 0 ] && check "admin sees $APCOUNT profiles" "OK" || check "admin profiles" "EMPTY: $ALLPROFILES"

echo ""
echo "============================================"
echo " RESULTS: $PASS passed | $FAIL failed"
echo "============================================"
