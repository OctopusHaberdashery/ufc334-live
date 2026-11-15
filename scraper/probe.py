# One-off probe of ESPN's public MMA feed; writes raw samples to events/_probe/.
import json, os, requests
os.makedirs("events/_probe", exist_ok=True)
H={"User-Agent":"Mozilla/5.0","Origin":"https://octopushaberdashery.github.io"}
E="600061400"; C="401913647"
urls={
 "past":"https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=20261107",
 "season":"https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=2026",
 "summary":f"https://site.web.api.espn.com/apis/common/v3/sports/mma/ufc/fightcenter/{E}?region=us&lang=en",
 "core_event":f"https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/{E}?lang=en&region=us",
 "comp_stats":f"https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/{E}/competitions/{C}/competitors/2615077/statistics?lang=en&region=us","comp":f"https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/{E}/competitions/{C}?lang=en&region=us"}
for k,u in urls.items():
    try:
        r=requests.get(u,headers=H,timeout=30); print(k,r.status_code,len(r.text),"ACAO:",r.headers.get("access-control-allow-origin"))
        open(f"events/_probe/{k}.json","w").write(r.text)
    except Exception as e: print(k,"ERR",e)
