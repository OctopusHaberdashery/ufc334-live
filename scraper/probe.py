# Temporary probe of ESPN odds endpoints for the live fight.
import os, requests, json
os.makedirs("events/_probe", exist_ok=True)
H={"User-Agent":"Mozilla/5.0","Origin":"https://octopushaberdashery.github.io"}
E="600061400"
fc=requests.get(f"https://site.web.api.espn.com/apis/common/v3/sports/mma/ufc/fightcenter/{E}?region=us&lang=en",headers=H,timeout=30).json()
comps=[c for s in fc["cards"].values() for c in s["competitions"]]
live=[c for c in comps if c["status"]["type"]["state"]=="in"] or comps[:1]
C=live[0]["id"]; print("PROBE live comp",C,[x["athlete"]["displayName"] for x in live[0]["competitors"]], live[0]["status"]["type"]["description"])
core=f"https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/{E}/competitions/{C}"
for k,u in {"odds":core+"/odds?lang=en&region=us","probabilities":core+"/probabilities?limit=50&lang=en&region=us","propbets":core+"/propBets?lang=en&region=us"}.items():
    r=requests.get(u,headers=H,timeout=30); print("PROBE",k,r.status_code,len(r.text)); open(f"events/_probe/{k}.json","w").write(r.text)
    if k=="odds" and r.ok:
        for it in r.json().get("items",[]):
            print("PROBE odds item", json.dumps({kk:it.get(kk) for kk in ("provider","homeAthleteOdds","awayAthleteOdds","moneyline","details")})[:900])
