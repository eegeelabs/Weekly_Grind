/* notes-fix.js — robust gatherFromDOM override
   Captures all real data rows (those with textarea.notes), and writes Notes
   to both slots 1 & 2 as expected by the View page.
*/
(function () {
  // Uses page-provided helpers: dayLabels(monISO)
  window.gatherFromDOM = function (monISO) {
    const rows = [["week_start","tech","day","slot","type","details","notes","status"]];
    const trs  = Array.from(document.querySelectorAll('#body > tr'));
    const days = dayLabels(monISO);

    // Only keep rows that actually have notes cells (i.e., real data rows)
    const dataRows = trs.filter(tr => tr.querySelector('textarea.notes'));

    dataRows.forEach(tr => {
      const tech = tr.querySelector('.sticky-left input')?.value?.trim() || '';
      if (!tech) return;

      const tds = tr.querySelectorAll('td'); // [0]=left, 1..5 day cells
      for (let di = 1; di < tds.length; di++) {
        const td     = tds[di];
        const dayISO = days[di-1]?.iso || '';
        const s1t = td.querySelector('.s1t')?.value || '';
        const s1p = td.querySelector('.s1p')?.value || '';
        const s2t = td.querySelector('.s2t')?.value || '';
        const s2p = td.querySelector('.s2p')?.value || '';
        const notes = td.querySelector('textarea.notes')?.value || '';
        rows.push([monISO, tech, dayISO, '1', s1t, s1p, notes, '']);
        rows.push([monISO, tech, dayISO, '2', s2t, s2p, notes, '']);
      }
    });

    return rows;
  };

  console.info('[notes-fix] robust gatherFromDOM override active');
})();
