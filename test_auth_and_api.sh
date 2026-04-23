#!/bin/bash
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWlpeWVrZmtmbGVzZG1jdnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMTg4NDMsImV4cCI6MjA5MTY5NDg0M30.6GWGva5OXcOH55CwjvvHNXlPN4pF5EYqQPRLh5Y-USo"
BASE="https://oyaiiyekfkflesdmcvvo.supabase.co"

test_login() {
  local label="$1"
  local email="$2"
  local password="$3"
  echo -n "Login $label ($email)... "
  result=$(curl -s -X POST "$BASE/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}")
  echo "$result" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'access_token' in d:
    u = d['user']
    role = u.get('user_metadata',{}).get('role','?')
    print('OK | role=' + role + ' | id=' + u['id'][:8] + '...')
else:
    print('FAILED: ' + str(d.get('error_description', d.get('msg', d))))
"
}

echo "=== Testing all 4 accounts ==="
test_login "buyer"  "buyer@greenmarket.test"  "Test@123456"
test_login "vendor" "vendor@greenmarket.test" "Test@123456"
test_login "driver" "driver@greenmarket.test" "Test@123456"
test_login "admin"  "admin@greenmarket.test"  "Test@123456"

echo ""
echo "=== Testing API: Products list ==="
curl -s "$BASE/rest/v1/products?select=id,name,category,price_per_unit&limit=5" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if isinstance(d, list):
    print('Products returned:', len(d))
    for p in d[:5]:
        print(' -', p['name'], '|', p['category'], '|', p['price_per_unit'], 'MAD/unit')
else:
    print('Error:', d)
"

echo ""
echo "=== Testing API: Stores list ==="
curl -s "$BASE/rest/v1/stores?select=id,name,city,rating&is_active=eq.true" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if isinstance(d, list):
    print('Stores returned:', len(d))
    for s in d:
        print(' -', s['name'], '|', s['city'], '| rating:', s['rating'])
else:
    print('Error:', d)
"
