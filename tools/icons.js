const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();
for(const s of [180,192,512]){await p.setViewportSize({width:s,height:s});
await p.setContent(`<html><body style="margin:0"><div style="width:${s}px;height:${s}px;background:#0f1218;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial Narrow,Arial,sans-serif;font-weight:900;color:#fff;border-bottom:${s*0.06}px solid #d0021b;box-sizing:border-box"><div style="font-size:${s*0.26}px;letter-spacing:${s*0.01}px;line-height:1">UFC</div><div style="font-size:${s*0.34}px;color:#ff3b4e;line-height:1">334</div></div></body></html>`);
await p.screenshot({path:`icons/icon-${s}.png`});}await b.close()})();
