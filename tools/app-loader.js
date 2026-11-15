/* Every-event loader.
   Live data: ESPN's public fight center feed, fetched straight from the browser (CORS open).
   Event list: events/index.json, rebuilt by the GitHub Action.
   Overlays: hand-written notes, odds, rankings and round notes keyed by event (e.g. data.json for UFC 334). */
const OVERLAYS = {"600061400": "data.json"};
const FC = id => `https://site.web.api.espn.com/apis/common/v3/sports/mma/ufc/fightcenter/${id}?region=us&lang=en`;
const SB = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard";
const ODDS = (e,c) => `https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/${e}/competitions/${c}/odds?lang=en&region=us`;
let CTRL_LOG = {}; try{ for(const k of Object.keys(localStorage)) if(k.startsWith('ctrl-')) CTRL_LOG[k.slice(5)] = JSON.parse(localStorage.getItem(k)); }catch(e){}
let INDEX = null, CUR = null, LIVE_STATE = "pre", TIMER = null, ODDS_CACHE = {};
const last = n => (n||"").trim().split(/\s+/).slice(-1)[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
const pairKey = (a,b) => [last(a),last(b)].sort().join("|");
const flat = n => (n||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z]/g,"");
const same = (a,b) => flat(b).includes(last(a)) || flat(a).includes(last(b));
const findOv = (list,r,b) => list.find(o=>(same(o.red,r)&&same(o.blue,b))||(same(o.red,b)&&same(o.blue,r)));
const fmtDate = d => { try { return new Date(d).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}); } catch(e){ return d; } };
const nowTime = () => new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
async function getJSON(u, bust){ const r=await fetch(bust?u+(u.includes("?")?"&":"?")+"t="+Date.now():u,{cache:"no-store"}); if(!r.ok) throw new Error(r.status); return r.json(); }

const SEG = {main:"main", prelims1:"prelims", prelims2:"early"};
const pair = (v) => { if(v==null) return null; const m=String(v).match(/^(\d+)/); return m?+m[1]:null; };
// cs must be the competitors already sorted into red (order 1), blue (order 2).
// ESPN's competitors array is NOT in corner order, so never index it directly.
function statsOf(cs){
  const g = c => Object.fromEntries((c.stats||[]).map(x=>[x.name,x.displayValue]));
  const a=g(cs[0]), b=g(cs[1]);
  if(!("sigStrikes" in a)) return null;               // pre-fight feeds carry career averages instead
  return {sig:[pair(a.sigStrikes),pair(b.sigStrikes)], td:[pair(a.takedowns),pair(b.takedowns)],
          tot:[pair(a.totalStrikes),pair(b.totalStrikes)], kd:[pair(a.knockDowns),pair(b.knockDowns)],
          ctrl: a.timeInControl ? [a.timeInControl,b.timeInControl] : null};
}

// Odds come from ESPN's core odds feed. Each line names its athlete, so map by athlete id (never by home/away guess).
// Provider 100 = DraftKings pre-fight line, provider 200 = DraftKings live in-fight line.
const ODDS_HIST = {};
async function oddsFor(eid, comp, force){
  const k = comp.id; if(!force && k in ODDS_CACHE) return ODDS_CACHE[k];
  if(!(k in ODDS_CACHE)) ODDS_CACHE[k] = null;
  try{
    const d = await getJSON(ODDS(eid,k), force);
    const aidOf = o => { const r = o && o.athlete && o.athlete.$ref; const m = r && r.match(/athletes\/(\d+)/); return m ? m[1] : null; };
    const am = v => { const n = parseInt(v,10); return isNaN(n) ? null : n; };
    const order1 = (comp.competitors.find(c=>c.order===1)||comp.competitors[0]).athlete.id;
    const order2 = (comp.competitors.find(c=>c.order===2)||comp.competitors[1]).athlete.id;
    const out = {pre:{}, live:null, provider:null};
    let homeAid = null;
    for(const it of d.items||[]) if(aidOf(it.homeAthleteOdds)) homeAid = aidOf(it.homeAthleteOdds);
    for(const it of d.items||[]){
      const H = it.homeAthleteOdds||{}, A = it.awayAthleteOdds||{};
      const hA = aidOf(H) || homeAid || order1, aA = aidOf(A) || (hA===order1 ? order2 : order1);
      const isLive = /live/i.test((it.provider||{}).name||"") || String((it.provider||{}).id)==="200";
      if(isLive){
        const cur = o => am(o.moneyLine ?? o.current?.moneyLine?.american), open = o => am(o.open?.moneyLine?.american);
        out.live = {provider:(it.provider||{}).name, [hA]:{cur:cur(H), open:open(H)}, [aA]:{cur:cur(A), open:open(A)}};
      } else if(!Object.keys(out.pre).length){
        out.pre[hA] = am(H.moneyLine ?? H.close?.moneyLine?.american); out.pre[aA] = am(A.moneyLine ?? A.close?.moneyLine?.american);
        out.provider = (it.provider||{}).name;
      }
    }
    ODDS_CACHE[k] = out;
    if(out.live){ const h = ODDS_HIST[k] = ODDS_HIST[k]||[]; const snap = JSON.stringify([out.live[order1]?.cur,out.live[order2]?.cur]); if(!h.length || h[h.length-1].v!==snap) h.push({v:snap, t:Date.now(), a:out.live[order1]?.cur, b:out.live[order2]?.cur}); }
  }catch(e){}
  return ODDS_CACHE[k];
}

// ESPN's live event log for one fight: round starts/ends, knockdowns, takedowns, submission attempts, with the clock.
const SKIP = /^(Fight Open|Walkout|Tale of the tape|Staredown|Unofficial|Results)/i;
async function playsFor(eid, cid){
  try{
    const d = await getJSON(`https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/${eid}/competitions/${cid}/plays?limit=400&lang=en&region=us`, true);
    return (d.items||[]).filter(p=>p.type && !SKIP.test(p.type.text)).map(p=>({r:(p.period||{}).number||0, clock:(p.clock||{}).displayValue||"", t:p.type.text, text:p.text||p.shortText||""}));
  }catch(e){ return null; }
}
async function fromESPN(fc, ov){
  const ovF = ov ? ov.FIGHTS : []; const byKey = {}; ovF.forEach(f=>byKey[pairKey(f.red,f.blue)]=f);
  const fights = [], stats = {}; let live = null;
  const comps = [];
  for(const [segName, seg] of Object.entries(fc.cards||{})) for(const c of seg.competitions||[]) comps.push([segName,c]);
  comps.sort((x,y)=>(x[1].matchNumber||0)-(y[1].matchNumber||0));
  await Promise.all(comps.map(([,c])=>oddsFor(fc.event.id,c,(c.status&&c.status.type&&c.status.type.state)==='in')));
  for(const [segName,c] of comps){
    const cs = [...c.competitors].sort((x,y)=>(x.order||0)-(y.order||0));
    const [R,B] = cs; const st = c.status||{}; const ty = st.type||{};
    const titleTxt = (c.types&&c.types[0]&&c.types[0].text) || "";
    const f = {
      seg: SEG[segName]||"prelims",
      title: titleTxt ? titleTxt.replace(/^UFC /,"") : (c.type&&c.type.text || "Bout"),
      red: R.athlete.displayName, blue: B.athlete.displayName,
      rec: [R.displayRecord||"", B.displayRecord||""],
      img: {red: R.athlete.headshot&&R.athlete.headshot.href, blue: B.athlete.headshot&&B.athlete.headshot.href},
      link: {red: R.athlete.link&&R.athlete.link.href, blue: B.athlete.link&&B.athlete.link.href},
      aid: {red: R.athlete.id || R.id, blue: B.athlete.id || B.id},
      status: ty.state==="post" ? "final" : ty.state==="in" ? "live" : "next",
      odds: (()=>{ const o=ODDS_CACHE[c.id]; if(!o) return null; const r=o.pre[R.athlete.id], b=o.pre[B.athlete.id]; return (r==null&&b==null)?null:{red:r, blue:b}; })(),
      liveOdds: (()=>{ const o=ODDS_CACHE[c.id]; if(!o||!o.live||ty.state!=="in") return null; return {provider:o.live.provider, red:o.live[R.athlete.id]||{}, blue:o.live[B.athlete.id]||{}, hist:(ODDS_HIST[c.id]||[]).length}; })(),
      rounds: /title/i.test(titleTxt) ? 5 : 3,
    };
    if(f.status==="final"){
      const res = st.result||{};
      f.method = res.displayName || ty.detail || "Final";
      f.round = st.period; f.time = st.displayClock;
      if(/draw/i.test(res.name||res.displayName||"")) f.draw = true;
      else if(/no.?contest/i.test(res.name||"")) { f.draw = true; f.method = "No contest"; }
      else f.winner = R.winner ? "red" : B.winner ? "blue" : undefined;
      if(!f.winner && !f.draw) f.draw = true;
      if(c.judgesScores && /Decision|Draw/i.test(f.method)) f.scores = c.judgesScores.split("|").map(x=>{ const n=x.trim().split("-").map(Number); return n.length===2&&!isNaN(n[0])? Math.max(...n)+"-"+Math.min(...n) : x.trim(); }).join(", ");
      f.finish = /KO|TKO|Submission/i.test(f.method);
    }
    // hand-written overlay wins for text, tags and odds
    const o = findOv(ovF,f.red,f.blue);
    if(o){
      const flip = !same(o.red,f.red);
      const sw = obj => obj && (flip ? {red:obj.blue, blue:obj.red} : obj);
      if(o.odds) f.odds = sw(o.odds);
      ["note","retire","upset","redTag"].forEach(k=>{ if(o[k]!=null) f[k]=o[k]; });
      if(o.missedWeight) f.missedWeight = flip ? (o.missedWeight==="red"?"blue":"red") : o.missedWeight;
      if(o.redTag && flip){ delete f.redTag; }
      if(f.status!=="final" && o.status==="final"){ Object.assign(f,{status:"final",method:o.method,round:o.round,time:o.time,draw:o.draw,scores:o.scores}); if(o.winner) f.winner = flip ? (o.winner==="red"?"blue":"red") : o.winner; }
    }
    if(f.status==="final" && f.odds && f.winner && f.upset==null){
      const fav = (f.odds.red!=null && f.odds.red<0) ? "red" : (f.odds.blue!=null && f.odds.blue<0) ? "blue" : null;
      if(fav && fav!==f.winner) f.upset = true;
    }
    const s = statsOf(cs); if(s) stats[f.red+"-"+f.blue] = s;
    if(f.status==="live" && !live){
      live = {fight:f, detail: ty.description==="In Progress" || ty.state==="in" && st.period>0 ? `Round ${st.period}${st.displayClock&&st.displayClock!=="-"?" · "+st.displayClock:""}` : (ty.description||"Live"), stats:s};
      const lk = ov && ov.LIVE && ov.LIVE.key ? ov.LIVE.key.split("-") : null;
      const ol = lk && findOv([{red:lk[0],blue:lk[1]}],f.red,f.blue) ? ov.LIVE.rounds : [];
      live.rounds = ol;
      live.plays = await playsFor(fc.event.id, c.id);
      // ESPN only gives cumulative control time, so snapshot it at each round end while the app is open to get per-round splits.
      if(s && s.ctrl){
        const log = CTRL_LOG[c.id] = CTRL_LOG[c.id] || {};
        // Only snapshot between rounds (latest play is a Round End), so the number is exact for that round.
        const lastPlay = (live.plays||[]).slice(-1)[0];
        if(lastPlay && /Round End/i.test(lastPlay.t) && !log[lastPlay.r]) log[lastPlay.r] = s.ctrl.slice();
        try{ localStorage.setItem("ctrl-"+c.id, JSON.stringify(log)); }catch(e){}
        const secs = t => { const m=String(t||"").match(/(\d+):(\d+)/); return m ? (+m[1])*60+(+m[2]) : 0; };
        const fmt = n => Math.floor(n/60)+":"+String(n%60).padStart(2,"0");
        const rs = Object.keys(log).map(Number).sort((a,b)=>a-b); let prev=[0,0];
        live.ctrlRounds = {}; rs.forEach(r=>{ const cur=[secs(log[r][0]),secs(log[r][1])]; if(log[r-1]||r===1){ const base = r===1?[0,0]:[secs(log[r-1][0]),secs(log[r-1][1])]; live.ctrlRounds[r]=[fmt(Math.max(0,cur[0]-base[0])),fmt(Math.max(0,cur[1]-base[1])),'in R'+r]; } else live.ctrlRounds[r]=[fmt(cur[0]),fmt(cur[1]),'through R'+r]; });
      }
    }
    fights.push(f);
  }
  return {fights, stats, live, state: (fc.meta&&fc.meta.gameState) || "pre"};
}

async function showEvent(id){
  let fc=null, ov=null;
  try{ fc = await getJSON(FC(id), true); }catch(e){}
  try{ if(OVERLAYS[id]) ov = await getJSON(OVERLAYS[id], true); }catch(e){}
  if(!fc && !ov) throw new Error("no data");
  const meta = INDEX ? INDEX.events.find(e=>e.id===id) : null;
  let name, venue, date;
  if(fc){
    const m = await fromESPN(fc, ov);
    FIGHTS = m.fights; STATS = m.stats; LIVE_STATE = m.state;
    LIVE = m.live ? {key:"", round:m.live.detail, rounds:m.live.rounds, stats:m.live.stats, plays:m.live.plays, ctrlRounds:m.live.ctrlRounds||{}} : {round:"",rounds:[]};
    name = fc.event.name; venue = fc.venue && fc.venue.displayNameLocation; date = fc.event.date;
  } else {
    FIGHTS = ov.FIGHTS; STATS = ov.STATS||{}; LIVE = ov.LIVE; name = "UFC 334: Gane vs. Hokit"; venue = "Madison Square Garden, New York, NY"; date = "2026-11-14T22:00Z";
  }
  FIGHTERS = ov ? ov.FIGHTERS||{} : {};
  NOTES = ov ? ov.NOTES||[] : []; BONUSES = ov ? ov.BONUSES||[] : []; WEIGHINS = ov ? ov.WEIGHINS||{} : {};
  UPDATED = fc ? nowTime() : (ov ? ov.UPDATED : "");
  CUR = id;
  const [head, sub] = name.split(":").map(x=>x&&x.trim());
  const num = head.match(/(\d+)$/);
  document.querySelector(".brand").innerHTML = num ? head.slice(0,-num[1].length)+"<span>"+num[1]+"</span>" : head.replace("UFC Fight Night","UFC <span>Fight Night</span>");
  document.querySelector(".venue").textContent = [sub, venue, date && fmtDate(date)].filter(Boolean).join(" · ");
  document.title = name;
  render();
  if(!FIGHTS.length) document.getElementById("seg-main").innerHTML='<p class="note">The fight card has not been posted yet.</p>';
  document.getElementById("seg-early").closest("section").hidden = !FIGHTS.some(f=>f.seg==="early");
  document.getElementById("seg-prelims").closest("section").hidden = !FIGHTS.some(f=>f.seg==="prelims");
  document.getElementById("notes").parentElement.hidden = !NOTES.length;
  document.getElementById("bonuses").parentElement.hidden = !BONUSES.length;
  document.querySelector("section.two").hidden = !NOTES.length && !BONUSES.length;
  document.getElementById("odds").closest("section").hidden = !FIGHTS.some(f=>f.odds);
  document.getElementById("sync").textContent = LIVE_STATE==="in" ? "Live, refreshing every 20s" : "Auto-refresh on";
}

function pickDefault(){
  const evs = INDEX.events, now = Date.now();
  const live = evs.find(e=>e.state==="in"); if(live) return live.id;
  const next = evs.filter(e=>e.state==="pre").sort((a,b)=>a.date.localeCompare(b.date))[0];
  const done = evs.filter(e=>e.state==="post").sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(next && (!done || new Date(next.date)-now < 2*864e5)) return next.id;
  return (done||next||evs[0]).id;
}
function fillPicker(){
  const sel = document.getElementById("evpick"); if(!INDEX){ sel.hidden=true; return; }
  const up = INDEX.events.filter(e=>e.state!=="post").sort((a,b)=>a.date.localeCompare(b.date));
  const done = INDEX.events.filter(e=>e.state==="post").sort((a,b)=>b.date.localeCompare(a.date));
  const opt = e=>`<option value="${e.id}">${e.state==="in"?"LIVE · ":""}${e.name} · ${fmtDate(e.date)}</option>`;
  sel.innerHTML = (up.length?`<optgroup label="Live and upcoming">${up.map(opt).join("")}</optgroup>`:"")+`<optgroup label="Past events">${done.map(opt).join("")}</optgroup>`;
  if(!INDEX.events.some(e=>e.id===CUR)) sel.insertAdjacentHTML("afterbegin",`<option value="${CUR}">${document.title}</option>`);
  sel.value = CUR; sel.hidden=false;
}
function schedule(){ clearTimeout(TIMER); TIMER = setTimeout(()=>refresh(), LIVE_STATE==="in" ? 20000 : 120000); }
async function refresh(){
  try{ await showEvent(CUR); }catch(e){ document.getElementById("sync").textContent="Offline, showing last loaded results"; }
  schedule();
}
async function boot(){
  try{ INDEX = await getJSON("events/index.json", true); }catch(e){ INDEX = null; }
  // ESPN's scoreboard always points at the current or next event; use it to mark the live one.
  try{
    const sb = await getJSON(SB, true); const ev = sb.events && sb.events[0];
    if(ev){
      const st = ev.status&&ev.status.type&&ev.status.type.state || "pre";
      INDEX = INDEX || {events:[]};
      const hit = INDEX.events.find(e=>e.id===ev.id);
      if(hit) hit.state = st; else INDEX.events.push({id:ev.id,name:ev.name,date:ev.date,state:st});
    }
  }catch(e){}
  const h = location.hash.replace(/^#e-/,"");
  CUR = /^\d+$/.test(h) ? h : (INDEX && INDEX.events.length ? pickDefault() : "600061400");
  await refresh(); fillPicker();
}
document.getElementById("evpick").addEventListener("change", e=>{ location.hash="e-"+e.target.value; });
window.addEventListener("hashchange", ()=>{ const h=location.hash.replace(/^#e-/,""); if(h && h!==CUR){ CUR=h; refresh().then(fillPicker); } });
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) refresh(); });
boot();
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
