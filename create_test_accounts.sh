#!/bin/bash
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWlpeWVrZmtmbGVzZG1jdnZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjExODg0MywiZXhwIjoyMDkxNjk0ODQzfQ.dP9k4FRmiRNcq9rRv5er2FEsMebzvyC-QITuv-7poN4"
BASE="https://oyaiiyekfkflesdmcvvo.supabase.co"

create_user() {
  local label="$1"
  local payload="$2"
  echo -n "Creating $label... "
  result=$(curl -s -X POST "$BASE/auth/v1/admin/users" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload")
  echo "$result" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'id' in d:
    print('OK  id=' + d['id'] + '  email=' + d.get('email','?'))
else:
    print('ERR ' + str(d))
"
}

create_user "buyer"  '{"email":"buyer@greenmarket.test","password":"Test@123456","email_confirm":true,"user_metadata":{"role":"buyer","first_name":"Ahmed","last_name":"Buyer"}}'
create_user "vendor" '{"email":"vendor@greenmarket.test","password":"Test@123456","email_confirm":true,"user_metadata":{"role":"vendor","first_name":"Fatima","last_name":"Vendor"}}'
create_user "driver" '{"email":"driver@greenmarket.test","password":"Test@123456","email_confirm":true,"user_metadata":{"role":"driver","first_name":"Youssef","last_name":"Driver"}}'
create_user "admin"  '{"email":"admin@greenmarket.test","password":"Test@123456","email_confirm":true,"user_metadata":{"role":"admin","first_name":"Admin","last_name":"GreenMarket"}}'
echo "Done."
