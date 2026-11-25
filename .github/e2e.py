#!/usr/bin/env python3
"""End-to-end check of the paths the web app actually uses against the live project.

Signs up a throwaway user with the public anon key (exactly what the browser
does), then exercises profile bootstrap, diary insert, own-row reads, the
search RPC, and the two negative checks that matter: writing another user's row
and granting yourself Plus. Exits non-zero with a GitHub annotation on failure.

The user it creates is cleanable with:
  delete from auth.users where email like '%@e2e.bharatbite.invalid';
"""
import json
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = "https://xetdzgsbzjctenhelaki.supabase.co"
ANON = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGR6Z3NiempjdGVuaGVsYWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1OTM2MTUsImV4cCI6MjExMTE2OTYxNX0."
    "lVeGrodiueGDKLlv5HZU-QbQvyAqvQNKYzzkizP60oU"
)


def call(method, path, body=None, token=None, prefer=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"apikey": ANON, "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read().decode()
            return res.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as err:
        raw = err.read().decode()
        try:
            parsed = json.loads(raw) if raw.strip() else None
        except json.JSONDecodeError:
            parsed = raw
        return err.code, parsed


def stage(name):
    print(f"\n=== {name}", flush=True)


def need(condition, message):
    if not condition:
        print(f"::error title=db e2e::{message}")
        print(f"FAILED: {message}")
        sys.exit(1)


stamp = int(time.time())
email = f"e2e-{stamp}@e2e.bharatbite.invalid"
password = f"Bb-E2E-{stamp}-Aa1"

stage("signup with the anon key (browser path)")
status, body = call(
    "POST",
    "/auth/v1/signup",
    {"email": email, "password": password, "data": {"display_name": "E2E"}},
)
print("status", status)
need(status in (200, 201), f"signup returned {status}: {body}")

stage("password login")
status, body = call("POST", "/auth/v1/token?grant_type=password", {"email": email, "password": password})
need(status == 200 and body and body.get("access_token"), f"login returned {status}: {body}")
token = body["access_token"]
user_id = body["user"]["id"]
print("user", user_id)

stage("profile + entitlement created by the signup trigger")
status, rows = call("GET", "/rest/v1/profiles?select=id,display_name,onboarding_completed", token=token)
print(status, rows)
need(status == 200 and isinstance(rows, list) and len(rows) == 1, f"profiles read: {status} {rows}")
need(rows[0]["display_name"] == "E2E", f"display_name not taken from metadata: {rows[0]}")

status, rows = call("GET", "/rest/v1/entitlements?select=status,plan_code", token=token)
print(status, rows)
need(status == 200 and rows and rows[0]["status"] == "free", f"entitlement bootstrap: {status} {rows}")

stage("insert a diary entry")
today = time.strftime("%Y-%m-%d", time.gmtime())
entry = {
    "id": str(uuid.uuid4()),
    "user_id": user_id,
    "log_date": today,
    "meal_type": "lunch",
    "food_slug": "thepla",
    "variant_slug": "homemade",
    "grams": 120,
    "kcal": 298.8,
    "protein_g": 7.2,
    "carbs_g": 44.4,
    "fat_g": 10.8,
    "sat_fat_g": 2.4,
    "fibre_g": 6,
    "sugar_g": 2.4,
    "sodium_mg": 420,
    "source": "manual_search",
}
status, body = call("POST", "/rest/v1/food_logs", [entry], token=token, prefer="return=representation")
print(status, str(body)[:200])
need(status in (200, 201) and isinstance(body, list) and len(body) == 1, f"insert: {status} {body}")

stage("read back, scoped to this user")
status, rows = call("GET", "/rest/v1/food_logs?select=food_slug,grams,kcal", token=token)
print(status, rows)
need(status == 200 and len(rows) == 1 and rows[0]["food_slug"] == "thepla", f"read back: {status} {rows}")

stage("search_foods RPC, as the app calls it")
status, rows = call("POST", "/rest/v1/rpc/search_foods", {"q": "thepla", "lim": 5}, token=token)
print(status, str(rows)[:200])
need(status == 200 and rows and rows[0]["slug"] == "thepla", f"rpc: {status} {rows}")

stage("devanagari/alias search")
status, rows = call("POST", "/rest/v1/rpc/search_foods", {"q": "થેપલા", "lim": 5}, token=token)
print(status, str(rows)[:200])
need(status == 200 and rows and rows[0]["slug"] == "thepla", f"alias rpc: {status} {rows}")

stage("writing another user's diary row must be rejected")
other = dict(entry)
other["id"] = str(uuid.uuid4())
other["user_id"] = "00000000-0000-4000-8000-000000000000"
status, body = call("POST", "/rest/v1/food_logs", [other], token=token, prefer="return=representation")
print(status, body)
need(status in (401, 403), f"cross-user insert was allowed: {status} {body}")

stage("granting myself Plus must be rejected")
status, body = call(
    "PATCH",
    f"/rest/v1/entitlements?user_id=eq.{user_id}",
    {"status": "active", "plan_code": "plus_annual"},
    token=token,
    prefer="return=representation",
)
print(status, body)
need(status in (401, 403), f"entitlement tamper was allowed: {status} {body}")

stage("planner write is refused without Plus")
status, body = call(
    "POST",
    "/rest/v1/diet_plans",
    {"user_id": user_id, "week_start": today, "title": "should not exist"},
    token=token,
)
print(status, body)
need(status in (401, 403), f"free user could write a diet plan: {status} {body}")

print("\nALL E2E ASSERTIONS PASSED")
print(f"cleanup: delete from auth.users where email = '{email}';")
