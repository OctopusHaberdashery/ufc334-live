// Builds index.html + data.json from source.html (the single source of truth).
const fs=require('fs'), vm=require('vm'), path=require('path');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'source.html'),'utf8');
const a=src.indexOf('/* ===== DATA'), b=src.indexOf('/* ===== END DATA ===== */');
const dataJs=src.slice(a,b);
const ctx={}; vm.createContext(ctx);
vm.runInContext(dataJs+';this.__d={UPDATED,FIGHTS,STATS,FIGHTERS,LIVE,NOTES,BONUSES};',ctx);
fs.writeFileSync(path.join(root,'data.json'),JSON.stringify(ctx.__d,null,1));
const helpers=`const slug = n => n.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z ]/g,"").trim().replace(/ +/g,"-");
const initials = n => n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
let UPDATED, FIGHTS, STATS, FIGHTERS, LIVE, NOTES, BONUSES;`;
let page=src.slice(0,a)+helpers+src.slice(b+'/* ===== END DATA ===== */'.length);
page=page.replace(/\nrender\(\);\s*<\/script>/,`
async function load(){
  try{
    const r=await fetch('data.json?t='+Date.now(),{cache:'no-store'});
    const d=await r.json();
    ({UPDATED,FIGHTS,STATS,FIGHTERS,LIVE,NOTES,BONUSES}=d);
    render(); document.getElementById('sync').textContent='Auto-refresh on';
  }catch(e){ document.getElementById('sync').textContent='Offline, showing last saved results'; if(FIGHTS) render(); }
}
load(); setInterval(load,30000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) load(); });
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
</script>`);
page=page.replace('<div class="updated" id="updated"></div>','<div class="updated"><span id="updated"></span> · <span id="sync">Loading</span></div>');
const title=(page.match(/<title>.*?<\/title>/)||[''])[0];
page=page.replace(title,'').replace('<meta name="claude:viewport-fit-sides" content="cover">','');
const head=`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${title}
<meta name="description" content="Live results, odds, stats and notable moments from UFC 334.">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0f1218">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="UFC 334">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<link rel="icon" href="icons/icon-192.png">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px;font-family:system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>
`;
fs.writeFileSync(path.join(root,'index.html'),head+page+'\n</body></html>\n');
console.log('built', Object.keys(ctx.__d).join(','));
