# Temporary probe: per-round competitor statistics (Harrison vs. Nunes, Gane vs. Hokit).
import requests
H={"User-Agent":"Mozilla/5.0","Origin":"https://octopushaberdashery.github.io"}
E="600061400"
fc=requests.get(f"https://site.web.api.espn.com/apis/common/v3/sports/mma/ufc/fightcenter/{E}?region=us&lang=en",headers=H,timeout=30).json()
for c in [c for s in fc["cards"].values() for c in s["competitions"]][:2]:
    print("PROBE fight",c["id"],[x["athlete"]["displayName"] for x in c["competitors"]],c["status"]["type"]["description"],c["status"].get("period"),c["status"].get("result",{}).get("displayName"))
    for x in c["competitors"]:
        a=x["athlete"]["id"]
        for n in (0,1,2):
            u=f"https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/{E}/competitions/{c['id']}/competitors/{a}/statistics/{n}?lang=en&region=us"
            r=requests.get(u,headers=H,timeout=30)
            if r.ok:
                st={s["name"]:s.get("displayValue") for cat in r.json().get("splits",{}).get("categories",[]) for s in cat["stats"]}
                print("PROBE",x["athlete"]["displayName"],"period",n,r.status_code,{k:st.get(k) for k in ("timeInControl","sigStrikesLanded","takedownsLanded","knockDowns","totalStrikesLanded")}, r.headers.get("access-control-allow-origin"))
            else: print("PROBE",x["athlete"]["displayName"],"period",n,r.status_code)
