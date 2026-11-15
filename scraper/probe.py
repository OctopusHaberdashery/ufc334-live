# Temporary probe of ESPN play-by-play endpoints (Harrison vs. Nunes).
import os, requests
os.makedirs("events/_probe", exist_ok=True)
H={"User-Agent":"Mozilla/5.0","Origin":"https://octopushaberdashery.github.io"}
E="600061400"; C="401922638"; A="2516131"
core=f"https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/{E}/competitions/{C}"
urls={
 "plays":core+"/plays?limit=400&lang=en&region=us",
 "details":core+"/details?limit=400&lang=en&region=us",
 "comp":core+"?lang=en&region=us",
 "linescores":core+f"/competitors/{A}/linescores?lang=en&region=us",
 "statsA":core+f"/competitors/{A}/statistics?lang=en&region=us",
 "pbp_site":f"https://site.web.api.espn.com/apis/common/v3/sports/mma/ufc/fightcenter/{E}/playbyplay?competition={C}&region=us&lang=en",
 "summary_site":f"https://site.api.espn.com/apis/site/v2/sports/mma/ufc/summary?event={E}",
}
for k,u in urls.items():
    try:
        r=requests.get(u,headers=H,timeout=30); print("PROBE",k,r.status_code,len(r.text),"ACAO:",r.headers.get("access-control-allow-origin"))
        open(f"events/_probe/{k}.json","w").write(r.text)
    except Exception as e: print("PROBE",k,"ERR",e)
