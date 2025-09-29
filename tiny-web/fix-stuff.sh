cat > ~/tiny-web/patch-admin-save-from-dom.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail

ADMIN="$HOME/tiny-web/public/weekly-grind/cantina_admin.html"
ts="$(date +%s)"
[[ -f "$ADMIN" ]] || { echo "ERROR: $ADMIN not found"; exit 1; }
cp -f "$ADMIN" "$ADMIN.bak.$ts"

# Replace the Admin page with a version that:
# - Keeps your compact/5-column layout
# - Auto-populates techs from techs.json
# - Saves by READING THE DOM so what you typed is exactly what gets saved
# - Adds a "Download CSV" button for quick verification
cat > "$ADMIN" <<'HTML'
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Weekly Grind — Admin</title>
<style>
:root{
  --tech-col:150px; --gap:4px; --pad:4px; --font:14px;
  --soft:rgba(255,255,255,.08); --text:#e6e9ff; --muted:#8892b0;
  --bg:#0f1220; --card:#171a2b;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:var(--font)/1.4 system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{position:sticky;top:0;z-index:5;background:rgba(15,18,32,.9);border-bottom:1px solid var(--soft)}
.wrap{max-width:1400px;margin:0 auto;padding:10px 12px}
h1{margin:0;font-size:18px}
select,button,input,textarea{background:#0d1224;border:1px solid var(--soft);color:var(--text);border-radius:8px;padding:2px 6px}
button{cursor:pointer}
main{padding:12px}
.table-wrap{border:1px solid var(--soft);border-radius:14px;background:var(--card);overflow:hidden}
table{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0}
thead th{position:sticky;top:0;background:#1a1e33;color:#cbd5ff;border-bottom:1px solid var(--soft);font-weight:600;text-align:center;white-space:nowrap}
th,td{padding:6px;border-right:1px solid rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}
th:last-child,td:last-child{border-right:0}
.sticky-left{position:sticky;left:0;background:#1a1e33;color:var(--text);font-weight:600;z-index:3}
tbody .sticky-left{background:#151a2c;z-index:2}
.cell{display:grid;grid-template-rows:auto auto auto;gap:var(--gap);min-height:110px}
.row{display:grid;grid-template-columns:minmax(56px,max-content) 1fr;gap:var(--gap);align-items:center}
.row select{width:auto;min-width:4ch;height:26px}
input.s1p,input.s2p,textarea.text{padding:var(--pad)}
textarea.text{resize:vertical;min-height:28px}
.notes{grid-column:1 / -1}
@media (max-width:1280px){:root{--tech-col:130px;--font:13px}th,td{padding:4px}}
</style>
</head><body>
<header>
  <div class="wrap" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    <h1>Configuration Cantina — Admin</h1><div style="flex:1"></div>
    <label>Week: <select id="week"></select></label>
    <button id="save">Save to Server</button>
    <button id="dl">Download CSV</button>
    <a href="/weekly-grind/" style="margin-left:8px">View</a>
    <span id="hint" style="margin-left:8px;color:var(--muted)">Ready</span>
  </div>
</header>
<main class="wrap">
  <div class="table-wrap">
    <table>
      <colgroup>
        <col style="width:var(--tech-col)">
        <col span="5" style="width:calc((100% - var(--tech-col))/5)">
      </colgroup>
      <thead><tr id="head"></tr></thead>
      <tbody id="body"></tbody>
    </table>
  </div>
</main>

<script>
const TYPES=["","IMG","CFG","OnB","R/R","ADUM"];
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const head=$("#head"), body=$("#body"), week=$("#week"), hint=$("#hint"), saveBtn=$("#save"), dlBtn=$("#dl");

const isoLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function mondayLocal(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const w=x.getDay();x.setDate(x.getDate()+(w===0?-6:1-w));return x;}
function dayLabels(monISO){const [Y,M,D]=monISO.split('-').map(Number);const base=new Date(Y,M-1,D);
  return [0,1,2,3,4].map(n=>{const x=addDays(base,n);return{iso:isoLocal(x),label:x.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'2-digit'})};});}
function parseCSV(t){const r=[];let i=0,f='',row=[],q=false;while(i<t.length){const c=t[i];
  if(q){if(c=='"'&&t[i+1]=='"'){f+='"';i+=2;continue}if(c=='"'){q=false;i++;continue}f+=c;i++;continue}
  if(c=='"'){q=true;i++;continue} if(c===','){row.push(f);f='';i++;continue}
  if(c==='\\n'||c==='\\r'){if(f!==''||row.length){row.push(f);r.push(row)}row=[];f='';if(c==='\\r'&&t[i+1]==='\\n')i++;i++;continue}
  f+=c;i++} if(f!==''||row.length){row.push(f);r.push(row)} return r.filter(a=>a.length&&!(a.length===1&&a[0]===''))}
function normalize(rows){const trim=v=>String(v??'').replace(/[\\r\\n]+/g,'').trim();
  const h=rows[0].map(s=>trim(s)), ix=a=>h.indexOf(a);
  const I={week_start:ix('week_start'),tech:ix('tech'),day:ix('day'),slot:ix('slot'),type:ix('type'),details:ix('details'),notes:ix('notes'),status:ix('status')};
  if(Object.values(I).some(i=>i<0))return{rows:[]};
  return{rows:rows.slice(1).map(r=>({week_start:trim(r[I.week_start]),tech:trim(r[I.tech]),day:trim(r[I.day]),slot:parseInt(trim(r[I.slot]||'0'),10)||0,type:trim(r[I.type]||''),details:trim(r[I.details]||''),notes:trim(r[I.notes]||''),status:trim(r[I.status]||'')}))};}
async function fetchTechs(){try{const r=await fetch('/weekly-grind/techs.json',{cache:'no-store'});if(!r.ok)return[];const j=await r.json();return Array.isArray(j?.techs)?j.techs:(Array.isArray(j)?j:[])}catch{return[]}}

function initWeeks(){const start=mondayLocal(new Date());const opts=[];for(let i=12;i>=-12;i--){const d=addDays(start,-7*i);opts.push({v:isoLocal(d),l:d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'2-digit'})})}
week.innerHTML=opts.map(o=>`<option value="${o.v}">${o.l}</option>`).join('');week.value=isoLocal(start)}

/* Pre-auth Basic Auth via hidden iframe (so fetch() can POST) */
function ensureApiAuth(){return new Promise(res=>{const f=document.createElement('iframe');Object.assign(f.style,{width:0,height:0,border:0,position:'absolute',left:'-9999px'});f.onload=()=>setTimeout(()=>{f.remove();res();},150);f.src='/weekly-grind/api/auth-check?ts='+Date.now();document.body.appendChild(f)})}

/* -------- rendering -------- */
let DAYS=[], TECHS=[];
async function load(monISO){
  hint.textContent='Loading…';
  const url='/weekly-grind/cantina-schedule-'+monISO+'.csv';
  const [res, techsJson] = await Promise.all([fetch(url,{cache:'no-store'}), fetchTechs()]);
  const text = await res.text(); const {rows} = normalize(parseCSV(text));
  DAYS = dayLabels(monISO);
  const set = new Set([...(Array.isArray(techsJson)?techsJson:[]), ...rows.map(r=>r.tech)].filter(Boolean));
  TECHS = Array.from(set).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));

  head.innerHTML = '<th class="sticky-left">Technician</th>'+DAYS.map(d=>`<th>${d.label}</th>`).join('');
  body.innerHTML='';
  TECHS.forEach(tech=>{
    const tr=document.createElement('tr');
    const left=document.createElement('td'); left.className='sticky-left';
    left.innerHTML=`<input value="${tech}" style="width:110px"> <button class="del">Del</button>`;
    tr.appendChild(left);
    left.querySelector('.del').addEventListener('click',()=>{ if(!confirm('Remove '+tech+'?')) return; tr.remove(); hint.textContent='Unsaved changes'; });

    // build cells from existing rows
    DAYS.forEach(d=>{
      const td=document.createElement('td'); const f=(slot)=>rows.find(r=>r.tech===tech && r.day===d.iso && r.slot===slot);
      const r1=f(1)||{}, r2=f(2)||{};
      td.innerHTML = `
        <div class="cell">
          <div class="row"><select class="s1t">${TYPES.map(o=>`<option${(o===r1.type)?' selected':''}>${o}</option>`).join('')}</select><input class="s1p" placeholder="Project details" value="${(r1.details||'').replace(/"/g,'&quot;')}"></div>
          <div class="row"><select class="s2t">${TYPES.map(o=>`<option${(o===r2.type)?' selected':''}>${o}</option>`).join('')}</select><input class="s2p" placeholder="Project details" value="${(r2.details||'').replace(/"/g,'&quot;')}"></div>
          <div class="row notes"><textarea class="notes" placeholder="Notes">${(r1.notes||r2.notes||'').replace(/</g,'&lt;')}</textarea></div>
        </div>`;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  // footer row: add + save
  const tr=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=6;
  td.innerHTML='<button id="addTech">Add Tech</button> <button id="saveBtn2">Save to Server</button>';
  tr.appendChild(td); body.appendChild(tr);

  document.querySelector('#addTech').addEventListener('click',()=>{
    const name=prompt('Technician name:'); if(!name) return;
    const nv=name.trim(); if(!nv) return;
    // add a blank row
    const row=document.createElement('tr');
    row.innerHTML='<td class="sticky-left"><input value="'+nv+'" style="width:110px"> <button class="del">Del</button></td>'
      +DAYS.map(()=>'<td><div class="cell">'
          +'<div class="row"><select class="s1t">'+TYPES.map(o=>'<option>'+o+'</option>').join('')+'</select><input class="s1p" placeholder="Project details"></div>'
          +'<div class="row"><select class="s2t">'+TYPES.map(o=>'<option>'+o+'</option>').join('')+'</select><input class="s2p" placeholder="Project details"></div>'
          +'<div class="row notes"><textarea class="notes" placeholder="Notes"></textarea></div>'
        +'</div></td>').join('');
    body.insertBefore(row,tr);
    row.querySelector('.del').addEventListener('click',()=>{ if(!confirm('Remove '+nv+'?')) return; row.remove(); hint.textContent='Unsaved changes'; });
    hint.textContent='Unsaved changes';
  });

  document.querySelector('#saveBtn2').addEventListener('click', saveNow);
  hint.textContent='Loaded';
}

/* -------- build CSV directly from the DOM -------- */
function toCSV(rows){
  const esc=s=>(/[",\n\r]/.test(s)?`"${String(s).replace(/"/g,'""')}"`:String(s));
  return rows.map(r=>r.map(esc).join(',')).join('\r\n')+'\r\n';
}
function gatherFromDOM(monISO){
  const rows=[["week_start","tech","day","slot","type","details","notes","status"]];
  const techRows = Array.from(body.querySelectorAll('tr')).slice(0,-1); // skip footer row
  techRows.forEach(tr=>{
    const tech = tr.querySelector('.sticky-left input')?.value?.trim() || '';
    if(!tech) return;
    const tds = tr.querySelectorAll('td'); // [0]=left, 1..5 = days
    for(let di=1; di<tds.length; di++){
      const td = tds[di], dayISO = dayByIndex(di-1); // 0..4
      const s1t = td.querySelector('.s1t')?.value || '';
      const s1p = td.querySelector('.s1p')?.value || '';
      const s2t = td.querySelector('.s2t')?.value || '';
      const s2p = td.querySelector('.s2p')?.value || '';
      const notes= td.querySelector('.notes')?.value || '';
      rows.push([monISO,tech,dayISO,'1',s1t,s1p,notes,'']);
      rows.push([monISO,tech,dayISO,'2',s2t,s2p,notes,'']);
    }
  });
  return rows;

  function dayByIndex(i){
    // read the header cells to get ISO from data-iso attribute
    const th = head.querySelectorAll('th')[i+1]; // skip "Technician"
    return th?.dataset?.iso || ''; // will be set in render header
  }
}

/* -------- save / download -------- */
async function postSave(monISO,csv){
  return fetch('/weekly-grind/api/save',{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ mondayISO: monISO, csv })
  });
}
async function saveNow(){
  try{
    const monISO = week.value;
    hint.textContent='Saving…'; saveBtn.disabled=true;
    const csv = toCSV(gatherFromDOM(monISO));
    let res = await postSave(monISO,csv);
    if(res.status===401){ await ensureApiAuth(); res = await postSave(monISO,csv); }
    if(!res.ok){ const t=await res.text(); throw new Error(`HTTP ${res.status}: ${t}`); }
    hint.textContent='Saved';
  }catch(e){ console.error(e); hint.textContent='Save failed'; alert('Save failed: '+e.message); }
  finally{ saveBtn.disabled=false; }
}
dlBtn.addEventListener('click',()=>{
  const monISO=week.value; const csv=toCSV(gatherFromDOM(monISO));
  const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=`cantina-schedule-${monISO}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
});

/* -------- boot -------- */
function bootWeeks(){const start=mondayLocal(new Date());const opts=[];for(let i=12;i>=-12;i--){const d=addDays(start,-7*i);opts.push({v:isoLocal(d),l:d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'2-digit'})})}
week.innerHTML=opts.map(o=>`<option value="${o.v}">${o.l}</option>`).join('');week.value=isoLocal(start)}
bootWeeks();
week.addEventListener('change', e=>load(e.target.value));
ensureApiAuth().then(()=>load(week.value));
/* add data-iso to headers after each render */
const origHeadAppend = head.appendChild.bind(head);
head.appendChild = function(node){ const r = origHeadAppend(node); setTimeout(()=>{ const days = dayLabels(week.value); const ths = head.querySelectorAll('th'); for(let i=0;i<days.length;i++){ const th=ths[i+1]; if(th) th.dataset.iso = days[i].iso; } }, 0); return r; };
</script>
</body></html>
HTML

echo "Patched Admin. Backup: $ADMIN.bak.$ts"
SH

bash ~/tiny-web/patch-admin-save-from-dom.sh
