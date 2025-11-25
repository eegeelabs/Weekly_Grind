/* view-spacing-fix.js — Scale-to-fit (no H-scroll) + hard nowrap + vertical compaction + no inner V-scroll */
(() => {
  if (window.__VIEW_SPACING_FIX_V10__) return;
  window.__VIEW_SPACING_FIX_V10__ = true;
  const root = document.getElementById("wg-view") || document.querySelector(".weekly-grid") || document.getElementById("grid") || document.body;
  const imp=(el,p,v)=>{try{el.style.setProperty(p,v,"important")}catch{}}, qT=()=>root.querySelector("table");
  const clean=()=>{const old=document.getElementById("wg-no-scroll-style"); old&&old.remove(); const t=qT(); if(!t)return; const p=t.parentElement; if(p&&p.classList&&p.classList.contains("wg-scroll")) p.replaceWith(t);};
  const ensureWrap=()=>{const t=qT(); if(!t) return {}; let host=document.getElementById("wg-fit-host"); let wrap=document.getElementById("wg-fit-wrap");
    if(!host){host=document.createElement("div"); host.id="wg-fit-host"; host.style.position="relative"; host.style.width="100%"; host.style.overflow="hidden"; t.parentNode.insertBefore(host,t)
