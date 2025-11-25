(function(){
  // Robust CSV parser: handles \r\n, quotes, "" escapes
  function parseCSV2(text){
    var rows=[], row=[], field='', i=0, inQ=false, c;
    while(i<text.length){
      c=text[i];
      if(inQ){
        if(c=='"'){ if(text[i+1]=='"'){ field+='"'; i+=2; continue; } inQ=false; i++; continue; }
        field+=c; i++; continue;
      }else{
        if(c=='"'){ inQ=true; i++; continue; }
        if(c==','){ row.push(field); field=''; i++; continue; }
        if(c=='\n'){ row.push(field); rows.push(row); row=[]; field=''; i++; continue; }
        if(c=='\r'){ if(text[i+1]=='\n') i++; row.push(field); rows.push(row); row=[]; field=''; i++; continue; }
        field+=c; i++; continue;
      }
    }
    if(field.length||row.length){ row.push(field); rows.push(row); }
    return rows;
  }
  function trim(v){ return String(v==null?'':v).replace(/[\r\n]+/g,'').replace(/^\uFEFF/,'').trim(); }
  function normalize2(rows){
    if(!rows||!rows.length) return {rows:[]};
    var h=rows[0].map(function(s){return trim(s).toLowerCase();});
    function ix(k){ return h.indexOf(k); }
    var I={week_start:ix('week_start'),tech:ix('tech'),day:ix('day'),slot:ix('slot'),
           type:ix('type'),details:ix('details'),notes:ix('notes'),status:ix('status')};
    if(Object.keys(I).some(function(k){return I[k]<0;})) return {rows:[]};
    return { rows: rows.slice(1).map(function(r){ return {
      week_start: trim(r[I.week_start]), tech: trim(r[I.tech]), day: trim(r[I.day]),
      slot: parseInt(trim(r[I.slot]||'0'),10)||0, type: trim(r[I.type]||''),
      details: trim(r[I.details]||''), notes: trim(r[I.notes]||''), status: trim(r[I.status]||'')
    };})};
  }
  // Export/override
  window.parseCSV  = parseCSV2;     // force our robust parser
  window.parseCSV2 = parseCSV2;
  window.normalize = normalize2;    // force robust normalizer
  console.info('[csv-fix] robust parser/normalizer active');
})();
