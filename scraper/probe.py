# Temporary probe of ESPN fighter endpoints (Amanda Nunes). Writes samples to events/_probe/.
import os, requests
os.makedirs("events/_probe", exist_ok=True)
H={"User-Agent":"Mozilla/5.0","Origin":"https://octopushaberdashery.github.io"}
A="2516131"
urls={
 "overview":f"https://site.web.api.espn.com/apis/common/v3/sports/mma/athletes/{A}/overview?region=us&lang=en",
 "fighthistory":f"https://site.web.api.espn.com/apis/common/v3/sports/mma/athletes/{A}/fighthistory?region=us&lang=en",
 "athlete":f"https://site.web.api.espn.com/apis/common/v3/sports/mma/athletes/{A}?region=us&lang=en",
 "news":f"https://site.api.espn.com/apis/site/v2/sports/mma/news?athlete={A}&limit=6",
 "news2":f"https://now.core.api.espn.com/v1/sports/news?athlete={A}&limit=6",
 "core_records":f"https://sports.core.api.espn.com/v2/sports/mma/athletes/{A}/eventlog?lang=en&region=us",
}
for k,u in urls.items():
    try:
        r=requests.get(u,headers=H,timeout=30); print("PROBE",k,r.status_code,len(r.text),"ACAO:",r.headers.get("access-control-allow-origin"))
        open(f"events/_probe/{k}.json","w").write(r.text)
    except Exception as e: print("PROBE",k,"ERR",e)
