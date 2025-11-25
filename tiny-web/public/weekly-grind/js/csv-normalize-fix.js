(function(){
  function trim(v){
    return String(v == null ? '' : v)
      .replace(/[\r\n]+/g,'')
      .replace(/^\uFEFF/,'')
      .trim();
  }
  function robustNormalize(rows){
    if(!rows || !rows.length) return { rows: [] };
    var h = rows[0].map(function(s){ return trim(s).toLowerCase(); });
    function ix(a){ return h.indexOf(a); }
    var I = {
      week_start: ix('week_start'),
      tech:       ix('tech'),
      day:        ix('day'),
      slot:       ix('slot'),
      type:       ix('type'),
      details:    ix('details'),
      notes:      ix('notes'),
      status:     ix('status')
    };
    if(Object.keys(I).some(function(k){ return I[k] < 0; })) return { rows: [] };
    var out = rows.slice(1).map(function(r){
      return {
        week_start: trim(r[I.week_start]),
        tech:       trim(r[I.tech]),
        day:        trim(r[I.day]),
        slot:       parseInt(trim(r[I.slot] || '0'),10) || 0,
        type:       trim(r[I.type] || ''),
        details:    trim(r[I.details] || ''),
        notes:      trim(r[I.notes] || ''),
        status:     trim(r[I.status] || '')
      };
    });
    return { rows: out };
  }
  if (typeof window !== 'undefined') {
    window._orig_normalize = window.normalize || null;
    window.normalize = robustNormalize;
    console.info('[csv-fix] robust normalize active');
  }
})();
