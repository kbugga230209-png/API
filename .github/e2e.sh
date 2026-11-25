#!/usr/bin/env bash
set -euo pipefail

EMAIL="e2e-$(date +%s)@e2e.bharatbite.invalid"
PASS="Bb-E2E-$(date +%s)-Aa1"
echo "email: $EMAIL"

echo "== signup"
curl -sS -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"data\":{\"display_name\":\"E2E\"}}" \
  -o /tmp/signup.json -w 'signup http %{http_code}\n'
head -c 300 /tmp/signup.json; echo

echo "== token"
curl -sS -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" -o /tmp/token.json -w 'token http %{http_code}\n'
head -c 200 /tmp/token.json; echo
TOKEN=$(python3 -c "import json;print(json.load(open('/tmp/token.json'))['access_token'])")
UID=$(python3 -c "import json;print(json.load(open('/tmp/token.json'))['user']['id'])")
echo "uid: $UID"

AUTH=(-H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

echo "== profile auto-created"
curl -sS "${AUTH[@]}" "$SUPABASE_URL/rest/v1/profiles?select=id,display_name,onboarding_completed" -o /tmp/p.json
cat /tmp/p.json; echo
python3 -c "import json;r=json.load(open('/tmp/p.json'));assert len(r)==1 and r[0]['display_name']=='E2E',r"

echo "== entitlement auto-created"
curl -sS "${AUTH[@]}" "$SUPABASE_URL/rest/v1/entitlements?select=status,plan_code" -o /tmp/e.json
cat /tmp/e.json; echo
python3 -c "import json;r=json.load(open('/tmp/e.json'));assert r and r[0]['status']=='free',r"

echo "== insert diary entry"
TODAY=$(date -u +%F)
NEWID=$(python3 -c "import uuid;print(uuid.uuid4())")
curl -sS -X POST "${AUTH[@]}" -H "Prefer: return=representation" \
  "$SUPABASE_URL/rest/v1/food_logs" \
  -d "[{\"id\":\"$NEWID\",\"user_id\":\"$UID\",\"log_date\":\"$TODAY\",\"meal_type\":\"lunch\",\"food_slug\":\"thepla\",\"variant_slug\":\"homemade\",\"grams\":120,\"kcal\":298.8,\"protein_g\":7.2,\"carbs_g\":44.4,\"fat_g\":10.8,\"sat_fat_g\":2.4,\"fibre_g\":6,\"sugar_g\":2.4,\"sodium_mg\":420,\"source\":\"manual_search\"}]" \
  -o /tmp/ins.json -w 'insert http %{http_code}\n'
head -c 400 /tmp/ins.json; echo
python3 -c "import json;r=json.load(open('/tmp/ins.json'));assert isinstance(r,list) and len(r)==1,r"

echo "== read back"
curl -sS "${AUTH[@]}" "$SUPABASE_URL/rest/v1/food_logs?select=food_slug,grams,kcal" -o /tmp/logs.json
cat /tmp/logs.json; echo
python3 -c "import json;r=json.load(open('/tmp/logs.json'));assert len(r)==1 and r[0]['food_slug']=='thepla',r"

echo "== search_foods rpc"
curl -sS "${AUTH[@]}" -X POST "$SUPABASE_URL/rest/v1/rpc/search_foods" \
  -d '{"q":"thepla","lim":5}' -o /tmp/search.json -w 'rpc http %{http_code}\n'
head -c 400 /tmp/search.json; echo
python3 -c "import json;r=json.load(open('/tmp/search.json'));assert r and r[0]['slug']=='thepla',r"

echo "== cross-user insert (must be rejected)"
DENYID=$(python3 -c "import uuid;print(uuid.uuid4())")
code=$(curl -sS -X POST "${AUTH[@]}" "$SUPABASE_URL/rest/v1/food_logs" \
  -d "[{\"id\":\"$DENYID\",\"user_id\":\"00000000-0000-4000-8000-000000000000\",\"log_date\":\"$TODAY\",\"meal_type\":\"lunch\",\"food_slug\":\"thepla\",\"variant_slug\":\"homemade\",\"grams\":100,\"kcal\":249,\"protein_g\":6,\"carbs_g\":37,\"fat_g\":9,\"sat_fat_g\":2,\"fibre_g\":5,\"sugar_g\":2,\"sodium_mg\":350,\"source\":\"manual_search\"}]" \
  -o /tmp/deny.json -w '%{http_code}')
echo "cross-user insert http $code"
cat /tmp/deny.json; echo
test "$code" = "403" -o "$code" = "401"

echo "== entitlement tamper (must be rejected)"
code=$(curl -sS -X PATCH "${AUTH[@]}" "$SUPABASE_URL/rest/v1/entitlements?user_id=eq.$UID" \
  -d '{"status":"active","plan_code":"plus_annual"}' -o /tmp/tamper.json -w '%{http_code}')
echo "entitlement tamper http $code"
cat /tmp/tamper.json; echo
test "$code" = "403" -o "$code" = "401"

echo "ALL E2E ASSERTIONS PASSED"
