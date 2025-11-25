/* view-spacing-fix.js — Scale-to-fit (no H-scroll) + hard nowrap + vertical compaction + no inner V-scroll */
(() => {
  if (window.__VIEW_SPACING_FIX_V10__) return;
  window.__VIEW_SPACING_FIX_V10__ = true;
  const root = document.getElementById("wg-view") || document.querySelector(".weekly-grid") || document.getElementById("grid") || document.body;
  const imp=(el,p,v)=>{try{el.style.setProperty(p,v,"important")}catch{}}, qT=()=>root.querySelector("table");
  const clean=()=>{const old=document.getElementById("wg-no-scroll-style"); old&&old.remove(); const t=qT(); if(!t)return; const p=t.parentElement; if(p&&p.classList&&p.classList.contains("wg-scroll")) p.replaceWith(t);};
  const ensureWrap=()=>{const t=qT(); if(!t) return {}; let host=document.getElementById("wg-fit-host"); let wrap=document.getElementById("wg-fit-wrap");
    if(!host){host=document.createElement("div"); host.id="wg-fit-host"; host.style.position="relative"; host.style.width="100%"; host.style.overflow="hidden"; t.parentNode.insertBefore(host,t);}
    if(!wrap){wrap=document.createElement("div"); wrap.id="wg-fit-wrap"; wrap.style.transformOrigin="top left"; wrap.style.display="inline-block"; host.appendChild(wrap); wrap.appendChild(t);}
    return {host,wrap,tbl:t};
  };
  const normalize=({tbl:t})=>{ if(!t) return;
    imp(t,"table-layout","auto"); imp(t,"width","max-content"); imp(t,"max-width","none"); imp(t,"min-width","0");
    imp(t,"border-collapse","separate"); imp(t,"border-spacing","8px 3px");
    t.querySelectorAll("th,td").forEach(c=>{ imp(c,"white-space","nowrap"); imp(c,"vertical-align","top"); imp(c,"height","auto"); imp(c,"min-height","0"); imp(c,"padding","2px 6px"); imp(c,"min-width","0"); });
    t.querySelectorAll("th,td,td *").forEach(el=>imp(el,"white-space","nowrap"));
    t.querySelectorAll("td *").forEach(el=>{ const cs=getComputedStyle(el);
      if(cs.display==="flex"){ el.style.alignItems="flex-start"; el.style.flexWrap="nowrap"; const g=parseFloat(cs.gap)||0; if(g>6) el.style.gap="4px"; }
      if(el.classList&&el.classList.contains("cell")){ el.style.minHeight="0"; el.style.gridTemplateRows="none"; el.style.gridAutoRows="min-content"; el.style.alignContent="start"; const g=parseFloat(cs.gap)||0; if(g>4) el.style.gap="2px"; }
      if((+cs.minHeight||0)>0) el.style.minHeight="0";
      if((+cs.paddingTop||0)>8) el.style.paddingTop="2px"; if((+cs.paddingBottom||0)>8) el.style.paddingBottom="2px";
      if((+cs.marginTop||0)>8) el.style.marginTop="2px"; if((+cs.marginBottom||0)>8) el.style.marginBottom="2px";
    });
  };
  const relax=({host})=>{ let el=host; while(el&&el!==document.body){ imp(el,"max-height","none"); imp(el,"overflow-y","hidden"); el=el.parentElement; if(!el||el===root) break; } imp(root,"overflow-y","visible"); };
  const scale=({host,wrap,tbl:t},s=null)=>{ if(!host||!wrap||!t) return; wrap.style.transform="scale(1)"; void wrap.offsetWidth;
    const natW=t.scrollWidth, avail=host.clientWidth; const k=s!=null? s : Math.min(1, avail/Math.max(1,natW));
    wrap.style.transform=`scale(${k})`; const r=wrap.getBoundingClientRect(); host.style.height=`${Math.ceil(r.height)+2}px`; host.style.overflowX="hidden"; host.style.overflowY="hidden";
  };
  const toggle=(scope)=>{ if(document.getElementById("wg-width-toggle")) return; const b=document.createElement("button");
    b.id="wg-width-toggle"; b.textContent="Mode: Fit";
    Object.assign(b.style,{position:"fixed",right:"12px",bottom:"12px",zIndex:"2147483647",padding:"6px 10px",borderRadius:"999px",font:"600 12px/1 system-ui, sans-serif",background:"#0b1324",color:"#cde1ff",border:"1px solid #26406f",boxShadow:"0 2px 10px rgba(0,0,0,.35)",cursor:"pointer"});
    b.addEventListener("mouseenter",()=>b.style.background="#0f1a33"); b.addEventListener("mouseleave",()=>b.style.background="#0b1324");
    let fit=true; b.addEventListener("click",()=>{ fit=!fit; b.textContent="Mode: "+(fit?"Fit":"100%"); if(fit){ scale(scope,null); relax(scope);} else { scope.wrap.style.transform="scale(1)"; const r=scope.wrap.getBoundingClientRect(); scope.host.style.height=`${Math.ceil(r.height)+2}px`; scope.host.style.overflowX="auto"; scope.host.style.overflowY="hidden"; }});
    document.body.appendChild(b);
  };
  const run=()=>{ clean(); const s=ensureWrap(); if(!s.tbl) return; normalize(s); relax(s); toggle(s); scale(s,null); };
  const once=(()=>{let d=false; return()=>{ if(!d){ d=true; run(); } };})();
  window.addEventListener("csv:rendered", once, {once:true});
  window.addEventListener("csv:loaded",   once, {once:true});
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(once,250)); else setTimeout(once,250);
  let raf=null; const refit=()=>{ if(raf) return; raf=requestAnimationFrame(()=>{raf=null; run();}); };
  window.addEventListener("resize", refit); new MutationObserver(refit).observe(root,{childList:true,subtree:true,characterData:true});
})();
