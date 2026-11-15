"""Scrape UFCStats.com into events/index.json and events/<id>.json.

Runs in GitHub Actions. Only stdlib + requests + beautifulsoup4.
Re-fetches upcoming events, the 3 most recent completed events, and any event
whose file is missing, so each run is small.
"""
import json, os, re, sys, time
from datetime import datetime, timezone
import requests
from bs4 import BeautifulSoup

BASE = "http://ufcstats.com"
OUT = os.path.join(os.path.dirname(__file__), "..", "events")
KEEP_COMPLETED = int(os.environ.get("KEEP_COMPLETED", "40"))
S = requests.Session()
S.headers["User-Agent"] = "Mozilla/5.0 (compatible; ufc-live-tracker)"

def get(url):
    for i in range(3):
        try:
            r = S.get(url, timeout=30)
            r.raise_for_status()
            t = re.search(r"<title>(.*?)</title>", r.text, re.S)
            print("GET", url, r.status_code, len(r.text), "->", r.url, "|", (t.group(1).strip()[:80] if t else "-"), file=sys.stderr)
            return BeautifulSoup(r.text, "html.parser")
        except Exception as e:
            print("retry", url, e, file=sys.stderr); time.sleep(3 * (i + 1))
    raise RuntimeError("failed " + url)

def txt(el):
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip() if el else ""

def parse_date(s):
    try: return datetime.strptime(s.strip(), "%B %d, %Y").strftime("%Y-%m-%d")
    except Exception: return s.strip()

def list_events(kind):
    soup = get(f"{BASE}/statistics/events/{kind}?page=all")
    out = []
    for tr in soup.select("tr.b-statistics__table-row"):
        a = tr.select_one("a.b-link")
        if not a or "event-details" not in a.get("href", ""): continue
        tds = tr.find_all("td")
        out.append({
            "id": a["href"].rstrip("/").split("/")[-1],
            "name": txt(a),
            "date": parse_date(txt(tr.select_one("span.b-statistics__date"))),
            "location": txt(tds[1]) if len(tds) > 1 else "",
            "status": "upcoming" if kind == "upcoming" else "completed",
        })
    return out

def num(s):
    s = s.strip()
    return int(s) if s.isdigit() else None

def event_detail(ev):
    soup = get(f"{BASE}/event-details/{ev['id']}")
    fights = []
    for i, tr in enumerate(soup.select("tbody.b-fight-details__table-body tr.b-fight-details__table-row")):
        cols = tr.find_all("td")
        if len(cols) < 10: continue
        cell = lambda c: [txt(p) for p in cols[c].select("p.b-fight-details__table-text")] or [txt(cols[c])]
        names = cell(1)
        if len(names) < 2: continue
        flags = [txt(x).lower() for x in cols[0].select("i.b-flag__text")]
        result = flags[0] if flags else ""
        meth = cell(7)
        f = {
            "order": i,
            "red": names[0], "blue": names[1],
            "weight": txt(cols[6]),
            "status": "final" if result else "next",
            "kd": [num(x) for x in cell(2)[:2]],
            "sig": [num(x) for x in cell(3)[:2]],
            "td": [num(x) for x in cell(4)[:2]],
            "subatt": [num(x) for x in cell(5)[:2]],
            "link": tr.get("data-link", ""),
        }
        if result:
            f["method"] = " · ".join(m for m in meth if m)
            f["round"] = num(txt(cols[8])) or txt(cols[8])
            f["time"] = txt(cols[9])
            if result == "win": f["winner"] = "red"   # UFCStats lists the winner first
            elif result == "draw": f["draw"] = True
            elif result == "nc": f["nc"] = True
        title_flag = cols[6].find("img")
        if title_flag and "belt" in title_flag.get("src", ""): f["titleFight"] = True
        fights.append(f)
    ev = dict(ev)
    ev["fights"] = fights
    ev["scraped"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return ev

def main():
    os.makedirs(OUT, exist_ok=True)
    upcoming = list_events("upcoming")
    completed = list_events("completed")
    print(len(upcoming), "upcoming,", len(completed), "completed", file=sys.stderr)
    if not completed:
        raise SystemExit("No events parsed; UFCStats layout may have changed. Leaving existing data in place.")
    completed = completed[:KEEP_COMPLETED]
    # UFCStats lists today's event under upcoming until it is complete.
    allev = sorted(upcoming, key=lambda e: e["date"]) + completed
    refresh = {e["id"] for e in upcoming} | {e["id"] for e in completed[:3]}
    for e in allev:
        path = os.path.join(OUT, e["id"] + ".json")
        if e["id"] in refresh or not os.path.exists(path):
            try:
                d = event_detail(e)
                with open(path, "w") as fh: json.dump(d, fh, indent=1)
                print("wrote", e["name"], len(d["fights"]), "fights")
            except Exception as ex:
                print("skip", e["name"], ex, file=sys.stderr)
            time.sleep(0.5)
    index = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
             "events": [{k: e[k] for k in ("id", "name", "date", "location", "status")} for e in allev]}
    with open(os.path.join(OUT, "index.json"), "w") as fh: json.dump(index, fh, indent=1)

if __name__ == "__main__":
    main()
