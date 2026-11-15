"""Build events/index.json (every UFC event this year and last) from ESPN's public scoreboard.
Live fight data is fetched by the app itself, straight from ESPN."""
import json, os, sys
from datetime import datetime, timezone
import requests

OUT = os.path.join(os.path.dirname(__file__), "..", "events", "index.json")
H = {"User-Agent": "Mozilla/5.0 (compatible; ufc-live-tracker)"}
year = datetime.now(timezone.utc).year
events = {}
for y in (year - 1, year, year + 1):
    r = requests.get(f"https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates={y}", headers=H, timeout=60)
    if r.status_code != 200:
        print("skip", y, r.status_code, file=sys.stderr); continue
    for e in r.json().get("events", []):
        v = (e.get("venues") or [{}])[0]
        events[e["id"]] = {
            "id": e["id"], "name": e["name"], "date": e["date"],
            "state": e.get("status", {}).get("type", {}).get("state", "pre"),
            "venue": v.get("fullName", ""),
        }
evs = sorted(events.values(), key=lambda e: e["date"], reverse=True)
if len(evs) < 5:
    sys.exit("Too few events returned; keeping the existing index.")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as fh:
    json.dump({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "events": evs}, fh, indent=1)
print(len(evs), "events")
