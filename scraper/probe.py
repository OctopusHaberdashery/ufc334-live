# One-off probe of ESPN's public MMA feed; writes raw samples to events/_probe/.
import json, os, requests
os.makedirs("events/_probe", exist_ok=True)
H={"User-Agent":"Mozilla/5.0"}
urls={
 "scoreboard":"https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard",
 "calendar":"https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/calendar/ondays?lang=en&region=us",
 "events":"https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events?limit=10&lang=en&region=us",
}
for k,u in urls.items():
    try:
        r=requests.get(u,headers=H,timeout=30); print(k,r.status_code,len(r.text))
        open(f"events/_probe/{k}.json","w").write(r.text)
    except Exception as e: print(k,"ERR",e)
